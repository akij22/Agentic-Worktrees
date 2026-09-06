import type Database from "better-sqlite3";
import { updateRecoverySchema, type UpdateRecovery } from "../../shared/packages/update-recovery";
import { getSqlite } from "../database/client";
import type {
	ManagedPackageInstallationRecord,
	ManagedPackageState,
	PackageErrorCode,
	PackageItemKind,
	PackageOperationAction,
	PackageOperationRecord,
	PackageOperationStage,
	PackageReviewStatus,
	PackageTrust,
} from "../../shared/packages/schemas";

export interface MigrationPendingInput {
	packageName: string; itemKind: PackageItemKind; itemId: string; requestedSpec: string;
	trust: PackageTrust; reviewStatus: PackageReviewStatus; permissionDigest?: string;
}
export interface BeginPackageOperationInput {
	operationId: string; action: PackageOperationAction; stage: PackageOperationStage;
	packageName?: string; requestedSpec: string;
}
export interface PackageCandidateMetadata {
	packageName: string; version: string; integrity: string; contentDigest: string;
}
export interface StableInstallationInput extends MigrationPendingInput {
	activeVersion: string; activeIntegrity: string; activeContentDigest: string;
	permissionDigest: string; state: Exclude<ManagedPackageState, "migration_pending">;
}

type InstallationRow = {
	packageName: string; itemKind: PackageItemKind; itemId: string; requestedSpec: string;
	activeVersion: string | null; activeIntegrity: string | null; activeContentDigest: string | null;
	trust: PackageTrust; reviewStatus: PackageReviewStatus; acceptedPermissionDigest: string | null;
	state: ManagedPackageState; errorCode: PackageErrorCode | null; createdAt: number; updatedAt: number;
};
type OperationRow = {
	operationId: string; action: PackageOperationAction; stage: PackageOperationStage;
	status: PackageOperationRecord["status"]; packageName: string | null; requestedSpec: string;
	candidateVersion: string | null; candidateIntegrity: string | null; candidateContentDigest: string | null;
	errorCode: PackageErrorCode | null; createdAt: number; updatedAt: number;
};
const installationSelect = `SELECT package_name packageName, item_kind itemKind, item_id itemId, requested_spec requestedSpec,
 active_version activeVersion, active_integrity activeIntegrity, active_content_digest activeContentDigest,
 trust, review_status reviewStatus, accepted_permission_digest acceptedPermissionDigest, state, error_code errorCode,
 created_at createdAt, updated_at updatedAt FROM managed_package_installations`;
const operationSelect = `SELECT operation_id operationId, action, stage, status, package_name packageName, requested_spec requestedSpec,
 candidate_version candidateVersion, candidate_integrity candidateIntegrity, candidate_content_digest candidateContentDigest,
 error_code errorCode, created_at createdAt, updated_at updatedAt FROM managed_package_operations`;

function installationFromRow(row: InstallationRow): ManagedPackageInstallationRecord {
	return {
		packageName: row.packageName, itemKind: row.itemKind, itemId: row.itemId, requestedSpec: row.requestedSpec,
		activeVersion: row.activeVersion ?? undefined,
		activeIntegrity: row.activeIntegrity ?? undefined,
		activeContentDigest: row.activeContentDigest ?? undefined,
		trust: row.trust, reviewStatus: row.reviewStatus,
		...(row.acceptedPermissionDigest !== null ? { acceptedPermissionDigest: row.acceptedPermissionDigest } : {}),
		state: row.state, ...(row.errorCode !== null ? { errorCode: row.errorCode } : {}),
		createdAt: new Date(row.createdAt), updatedAt: new Date(row.updatedAt),
	};
}
function operationFromRow(row: OperationRow): PackageOperationRecord {
	return {
		operationId: row.operationId, action: row.action, stage: row.stage, status: row.status,
		...(row.packageName !== null ? { packageName: row.packageName } : {}), requestedSpec: row.requestedSpec,
		...(row.candidateVersion !== null ? { candidateVersion: row.candidateVersion } : {}),
		...(row.candidateIntegrity !== null ? { candidateIntegrity: row.candidateIntegrity } : {}),
		...(row.candidateContentDigest !== null ? { candidateContentDigest: row.candidateContentDigest } : {}),
		...(row.errorCode !== null ? { errorCode: row.errorCode } : {}),
		createdAt: new Date(row.createdAt), updatedAt: new Date(row.updatedAt),
	};
}

export class ManagedPackageRepository {
	constructor(private readonly sqlite: Database.Database = getSqlite()) {}
  createUpdateRecovery(input: UpdateRecovery): void {
    try {
      const snapshot = updateRecoverySchema.parse(input);
      this.sqlite.transaction(() => {
        if (this.listUpdateRecoveries().some((row) => row.packageName === snapshot.packageName && !["conflict", "cleanup_pending"].includes(row.stage)))
          throw new Error("package_update_failed");
        this.sqlite.prepare("INSERT INTO managed_package_update_recoveries (operation_id, owner_token, package_name, snapshot) VALUES (?, ?, ?, ?)")
          .run(snapshot.operationId, snapshot.ownerToken, snapshot.packageName, JSON.stringify(snapshot));
      })();
    } catch { throw new Error("package_update_failed"); }
  }
  listUpdateRecoveries(): UpdateRecovery[] {
    try {
      return (this.sqlite.prepare("SELECT snapshot FROM managed_package_update_recoveries ORDER BY operation_id").all() as { snapshot: string }[])
        .map((row) => updateRecoverySchema.parse(JSON.parse(row.snapshot)));
    } catch { throw new Error("package_update_failed"); }
  }
  advanceUpdateRecovery(operationId: string, ownerToken: string, stage: UpdateRecovery["stage"], errorCode?: PackageErrorCode): void {
    this.sqlite.transaction(() => this.advanceUpdateRecoveryWithinTransaction(operationId, ownerToken, stage, errorCode))();
  }
  private advanceUpdateRecoveryWithinTransaction(operationId: string, ownerToken: string, stage: UpdateRecovery["stage"], errorCode?: PackageErrorCode): void {
    if (!this.sqlite.inTransaction) throw new Error("package_update_failed");
    const current = this.listUpdateRecoveries().find((row) => row.operationId === operationId && row.ownerToken === ownerToken);
    if (!current) throw new Error("package_update_failed");
    const next = updateRecoverySchema.parse({ ...current, stage, ...(errorCode ? { errorCode } : {}) });
    this.sqlite.prepare("UPDATE managed_package_update_recoveries SET snapshot=? WHERE operation_id=? AND owner_token=?")
      .run(JSON.stringify(next), operationId, ownerToken);
  }
  finishUpdateRecovery(operationId: string, ownerToken: string): void {
    this.sqlite.transaction(() => this.finishUpdateRecoveryWithinTransaction(operationId, ownerToken))();
  }
  private finishUpdateRecoveryWithinTransaction(operationId: string, ownerToken: string): void {
    if (!this.sqlite.inTransaction) throw new Error("package_update_failed");
    if (this.sqlite.prepare("DELETE FROM managed_package_update_recoveries WHERE operation_id=? AND owner_token=?").run(operationId, ownerToken).changes !== 1)
      throw new Error("package_update_failed");
  }
  completeRecoveredCleanup(operationId: string, ownerToken: string): void {
    this.sqlite.transaction(() => {
      const recovery = this.listUpdateRecoveries().find((row) => row.operationId === operationId && row.ownerToken === ownerToken && row.stage === "cleanup_pending");
      if (!recovery) throw new Error("package_update_failed");
      this.finishUpdateRecoveryWithinTransaction(operationId, ownerToken);
      if (!this.listUpdateRecoveries().some((row) => row.packageName === recovery.packageName)) {
        this.sqlite.prepare("UPDATE managed_package_installations SET state='installed', error_code=NULL WHERE package_name=? AND item_id=? AND active_version=? AND active_integrity=? AND active_content_digest=? AND state='blocked' AND error_code='package_update_failed'")
          .run(recovery.packageName, recovery.capabilityId, recovery.candidatePointer.version, recovery.candidatePointer.integrity, recovery.candidatePointer.contentDigest);
      }
    })();
  }
  quarantineUpdateRecoveries(): void {
    this.sqlite.transaction(() => {
      for (const row of this.listUpdateRecoveries()) {
        this.sqlite.prepare("UPDATE managed_package_installations SET state='blocked', error_code='package_update_failed' WHERE package_name=? AND item_id=?")
          .run(row.packageName, row.capabilityId);
        this.sqlite.prepare("UPDATE managed_package_operations SET status='failed', error_code='package_update_failed', updated_at=? WHERE operation_id=?")
          .run(Date.now(), row.operationId);
        if (row.stage !== "cleanup_pending") this.advanceUpdateRecoveryWithinTransaction(row.operationId, row.ownerToken, "conflict", "package_update_failed");
      }
    })();
  }
	getByPackageName(packageName: string): ManagedPackageInstallationRecord | undefined {
		const row = this.sqlite.prepare(`${installationSelect} WHERE package_name = ?`).get(packageName) as InstallationRow | undefined;
		return row ? installationFromRow(row) : undefined;
	}
	getByItemId(kind: PackageItemKind, itemId: string): ManagedPackageInstallationRecord | undefined {
		const row = this.sqlite.prepare(`${installationSelect} WHERE item_kind = ? AND item_id = ?`).get(kind, itemId) as InstallationRow | undefined;
		return row ? installationFromRow(row) : undefined;
	}
	list(kind?: PackageItemKind): ManagedPackageInstallationRecord[] {
		const rows = (kind
			? this.sqlite.prepare(`${installationSelect} WHERE item_kind = ? ORDER BY package_name`).all(kind)
			: this.sqlite.prepare(`${installationSelect} ORDER BY package_name`).all()) as InstallationRow[];
		return rows.map(installationFromRow);
	}
	saveMigrationPending(input: MigrationPendingInput): ManagedPackageInstallationRecord {
		return this.sqlite.transaction(() => {
			const now = Date.now();
			this.sqlite.prepare(`INSERT INTO managed_package_installations
				(package_name, item_kind, item_id, requested_spec, trust, review_status, accepted_permission_digest, state, created_at, updated_at)
				VALUES (?, ?, ?, ?, ?, ?, ?, 'migration_pending', ?, ?)
				ON CONFLICT(package_name) DO UPDATE SET item_kind=excluded.item_kind, item_id=excluded.item_id,
				requested_spec=excluded.requested_spec, active_version=NULL, active_integrity=NULL, active_content_digest=NULL,
				trust=excluded.trust, review_status=excluded.review_status, accepted_permission_digest=excluded.accepted_permission_digest,
				state='migration_pending', error_code=NULL, updated_at=excluded.updated_at`)
				.run(input.packageName, input.itemKind, input.itemId, input.requestedSpec, input.trust, input.reviewStatus, input.permissionDigest ?? null, now, now);
			return this.requireInstallation(input.packageName);
		})();
	}
	snapshotOperation(operationId: string): PackageOperationRecord | undefined {
		const row = this.sqlite.prepare(`${operationSelect} WHERE operation_id = ?`).get(operationId) as OperationRow | undefined;
		return row ? operationFromRow(row) : undefined;
	}
	beginOperation(input: BeginPackageOperationInput): PackageOperationRecord {
		return this.sqlite.transaction(() => {
			const now = Date.now();
			this.sqlite.prepare(`INSERT INTO managed_package_operations
				(operation_id, action, stage, status, package_name, requested_spec, created_at, updated_at)
				VALUES (?, ?, ?, 'in_progress', ?, ?, ?, ?)`)
				.run(input.operationId, input.action, input.stage, input.packageName ?? null, input.requestedSpec, now, now);
			return this.requireOperation(input.operationId);
		})();
	}
	markAwaitingConsent(operationId: string, candidate: PackageCandidateMetadata): PackageOperationRecord {
		return this.sqlite.transaction(() => {
			this.requireMutableOperation(operationId);
			this.sqlite.prepare(`UPDATE managed_package_operations SET status='awaiting_consent', package_name=?, candidate_version=?, candidate_integrity=?, candidate_content_digest=?, updated_at=? WHERE operation_id=?`)
				.run(candidate.packageName, candidate.version, candidate.integrity, candidate.contentDigest, Date.now(), operationId);
			return this.requireOperation(operationId);
		})();
	}
	commitInstallation(operationId: string, input: StableInstallationInput): ManagedPackageInstallationRecord {
		return this.sqlite.transaction(() => {
			this.requireMutableOperation(operationId);
			const existing = this.getByPackageName(input.packageName);
			if (existing && (existing.itemKind !== input.itemKind || existing.itemId !== input.itemId)) {
				throw new Error("Managed package identity conflicts with the existing installation.");
			}
			const now = Date.now();
			this.sqlite.prepare(`INSERT INTO managed_package_installations
				(package_name,item_kind,item_id,requested_spec,active_version,active_integrity,active_content_digest,trust,review_status,accepted_permission_digest,state,error_code,created_at,updated_at)
				VALUES (?,?,?,?,?,?,?,?,?,?,?,NULL,?,?)
				ON CONFLICT(package_name) DO UPDATE SET requested_spec=excluded.requested_spec,
				active_version=excluded.active_version, active_integrity=excluded.active_integrity,
				active_content_digest=excluded.active_content_digest, trust=excluded.trust,
				review_status=excluded.review_status, accepted_permission_digest=excluded.accepted_permission_digest,
				state=excluded.state, error_code=NULL, updated_at=excluded.updated_at`)
				.run(input.packageName, input.itemKind, input.itemId, input.requestedSpec, input.activeVersion, input.activeIntegrity, input.activeContentDigest, input.trust, input.reviewStatus, input.permissionDigest, input.state, now, now);
			this.sqlite.prepare("UPDATE managed_package_operations SET status='completed', stage='installing', error_code=NULL, updated_at=? WHERE operation_id=?").run(now, operationId);
			return this.requireInstallation(input.packageName);
		})();
	}
	markInstallationInvalid(input: StableInstallationInput, code: PackageErrorCode): ManagedPackageInstallationRecord {
		const now = Date.now();
		this.sqlite.prepare(`INSERT INTO managed_package_installations
			(package_name,item_kind,item_id,requested_spec,active_version,active_integrity,active_content_digest,trust,review_status,accepted_permission_digest,state,error_code,created_at,updated_at)
			VALUES (?,?,?,?,?,?,?,?,?,?,'invalid',?,?,?) ON CONFLICT(package_name) DO UPDATE SET item_kind=excluded.item_kind,item_id=excluded.item_id,requested_spec=excluded.requested_spec,active_version=excluded.active_version,active_integrity=excluded.active_integrity,active_content_digest=excluded.active_content_digest,trust=excluded.trust,review_status=excluded.review_status,accepted_permission_digest=excluded.accepted_permission_digest,state='invalid',error_code=excluded.error_code,updated_at=excluded.updated_at`)
			.run(input.packageName, input.itemKind, input.itemId, input.requestedSpec, input.activeVersion, input.activeIntegrity, input.activeContentDigest, input.trust, input.reviewStatus, input.permissionDigest, code, now, now);
		return this.requireInstallation(input.packageName);
	}
	failOperation(operationId: string, code: PackageErrorCode): PackageOperationRecord {
		return this.finishOperation(operationId, "failed", code);
	}
	/**
	 * Compensates only the operation that was proven to belong to this install attempt.
	 * The immutable snapshot prevents a partially acquired journal from targeting an
	 * unrelated operation after an identity collision.
	 */
	compensateFailedInstall(operationSnapshot: PackageOperationRecord, expected: { operationId: string; packageName: string; requestedSpec: string }, code: PackageErrorCode): PackageOperationRecord {
		if (operationSnapshot.operationId !== expected.operationId || operationSnapshot.packageName !== expected.packageName || operationSnapshot.requestedSpec !== expected.requestedSpec || !["install", "update"].includes(operationSnapshot.action)) {
			throw new Error("Managed package operation identity mismatch.");
		}
		const current = this.snapshotOperation(expected.operationId);
		if (!current || current.packageName !== operationSnapshot.packageName || current.requestedSpec !== operationSnapshot.requestedSpec || current.action !== operationSnapshot.action) {
			throw new Error("Managed package operation identity changed.");
		}
		return this.failOperationCoherently(expected.operationId, code);
	}
	/** Marks an attempted install failed even when its installation row was already committed. */
	failOperationCoherently(operationId: string, code: PackageErrorCode): PackageOperationRecord {
		return this.sqlite.transaction(() => {
			this.requireOperation(operationId);
			this.sqlite.prepare("UPDATE managed_package_operations SET status='failed', stage='installing', error_code=?, updated_at=? WHERE operation_id=?")
				.run(code, Date.now(), operationId);
			return this.requireOperation(operationId);
		})();
	}
	cancelOperation(operationId: string): PackageOperationRecord {
		return this.finishOperation(operationId, "cancelled");
	}
	deleteInstallation(packageName: string): void {
		this.sqlite.transaction(() => { this.sqlite.prepare("DELETE FROM managed_package_installations WHERE package_name = ?").run(packageName); })();
	}
	restoreInstallation(packageName: string, record: ManagedPackageInstallationRecord | undefined): void {
		this.sqlite.transaction(() => {
			if (!record) { this.sqlite.prepare("DELETE FROM managed_package_installations WHERE package_name = ?").run(packageName); return; }
			this.sqlite.prepare(`INSERT INTO managed_package_installations
			(package_name,item_kind,item_id,requested_spec,active_version,active_integrity,active_content_digest,trust,review_status,accepted_permission_digest,state,error_code,created_at,updated_at)
			VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(package_name) DO UPDATE SET item_kind=excluded.item_kind,item_id=excluded.item_id,requested_spec=excluded.requested_spec,active_version=excluded.active_version,active_integrity=excluded.active_integrity,active_content_digest=excluded.active_content_digest,trust=excluded.trust,review_status=excluded.review_status,accepted_permission_digest=excluded.accepted_permission_digest,state=excluded.state,error_code=excluded.error_code,created_at=excluded.created_at,updated_at=excluded.updated_at`)
			.run(record.packageName, record.itemKind, record.itemId, record.requestedSpec, record.activeVersion ?? null, record.activeIntegrity ?? null, record.activeContentDigest ?? null, record.trust, record.reviewStatus, record.acceptedPermissionDigest ?? null, record.state, record.errorCode ?? null, record.createdAt.getTime(), record.updatedAt.getTime());
		})();
	}
	listInterruptedOperations(): PackageOperationRecord[] {
		return (this.sqlite.prepare(`${operationSelect} WHERE status IN ('in_progress','awaiting_consent') ORDER BY updated_at, operation_id`).all() as OperationRow[]).map(operationFromRow);
	}
	private finishOperation(operationId: string, status: "failed" | "cancelled", code?: PackageErrorCode): PackageOperationRecord {
		return this.sqlite.transaction(() => {
			this.requireMutableOperation(operationId);
			this.sqlite.prepare("UPDATE managed_package_operations SET status=?, error_code=?, updated_at=? WHERE operation_id=?").run(status, code ?? null, Date.now(), operationId);
			return this.requireOperation(operationId);
		})();
	}
	private requireInstallation(packageName: string): ManagedPackageInstallationRecord {
		const record = this.getByPackageName(packageName);
		if (!record) throw new Error("Managed package installation was not found.");
		return record;
	}
	private requireOperation(operationId: string): PackageOperationRecord {
		const row = this.sqlite.prepare(`${operationSelect} WHERE operation_id = ?`).get(operationId) as OperationRow | undefined;
		if (!row) throw new Error("Managed package operation was not found.");
		return operationFromRow(row);
	}
	private requireMutableOperation(operationId: string): PackageOperationRecord {
		const operation = this.requireOperation(operationId);
		if (operation.status !== "in_progress" && operation.status !== "awaiting_consent") throw new Error("Managed package operation is already complete.");
		return operation;
	}
}
