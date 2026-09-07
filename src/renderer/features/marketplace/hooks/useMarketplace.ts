import { useCallback, useEffect, useMemo, useReducer, useRef } from "react";
import type {
  CapabilityDetailDto,
  MarketplaceItemDto,
} from "../../../../shared/ipc/schemas";
import type {
  CapabilityDistributionProgress,
  CapabilityPackageInspectionDto,
  CapabilityRemovalInspection,
} from "../../../../shared/packages/schemas";
import type { SkillDetailDto } from "../../../../shared/skills/schemas";

type Filter = "all" | "capability" | "skill" | "installed";
type Phase =
  | "loading"
  | "ready"
  | "inspecting"
  | "review"
  | "installing"
  | "updating"
  | "removing"
  | "error";
type State = {
  items: MarketplaceItemDto[];
  selected?: MarketplaceItemDto;
  detail?: CapabilityDetailDto | SkillDetailDto;
  inspection?: CapabilityPackageInspectionDto;
  progress?: CapabilityDistributionProgress;
  removalReview?: CapabilityRemovalInspection;
  filter: Filter;
  query: string;
  phase: Phase;
  error?: string;
};
type Action = { type: "patch"; value: Partial<State> };

const initialState: State = {
  items: [],
  filter: "all",
  query: "",
  phase: "loading",
};
const exactSpecPattern =
  /^(?:@[a-z0-9][a-z0-9._-]*\/[a-z0-9][a-z0-9._-]*|[a-z0-9][a-z0-9._-]*)(?:@[^\s/]+)?$/;
const operationError =
  "The package operation could not be completed. Please try again.";

function reducer(state: State, action: Action): State {
  return { ...state, ...action.value };
}

export function useMarketplace(runId?: string) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const generation = useRef(0);
  const patch = useCallback(
    (value: Partial<State>) => dispatch({ type: "patch", value }),
    [],
  );

  const refresh = useCallback(async () => {
    const request = ++generation.current;
    try {
      const items = await window.api.marketplace.list();
      if (request === generation.current)
        patch({ items, phase: "ready", error: undefined });
    } catch {
      if (request === generation.current)
        patch({
          phase: "error",
          error:
            "Could not load Marketplace items. Check your connection and retry.",
        });
    }
  }, [patch]);

  useEffect(() => {
    void refresh();
    const unsubscribePackages = window.api.marketplace.onPackageChanged(
      (progress) => {
        const phase =
          progress.status === "failed"
            ? "error"
            : progress.status === "completed"
              ? "ready"
              : progress.action === "update"
                ? "updating"
                : progress.action === "remove"
                  ? "removing"
                  : "installing";
        patch({
          progress,
          phase,
          error: progress.status === "failed" ? operationError : undefined,
        });
        if (progress.status === "completed") void refresh();
      },
    );
    const unsubscribeCatalog = window.api.capabilities.onChanged((event) => {
      if (event.scope === "catalog") void refresh();
    });
    const retryMigration = () => {
      void window.api.marketplace
        .retryPendingMigrations()
        .then(refresh)
        .catch(() => patch({ error: operationError }));
    };
    window.addEventListener("online", retryMigration);
    return () => {
      generation.current += 1;
      unsubscribePackages();
      unsubscribeCatalog();
      window.removeEventListener("online", retryMigration);
    };
  }, [patch, refresh]);

  const inspectPackage = useCallback(
    async (
      sourceSpec: string,
      officialCapabilityId?: string,
      intent: "install" | "update" = "install",
    ) => {
      patch({ phase: "inspecting", error: undefined });
      try {
        const inspection = await window.api.marketplace.inspect({
          sourceSpec,
          officialCapabilityId,
          intent,
        });
        patch({ inspection, detail: inspection.capability, phase: "review" });
        return inspection;
      } catch {
        patch({ phase: "error", error: operationError });
      }
    },
    [patch],
  );

  const select = useCallback(
    async (item: MarketplaceItemDto) => {
      patch({
        selected: item,
        inspection: undefined,
        progress: undefined,
        error: undefined,
      });
      try {
        if (item.kind === "skill") {
          patch({
            detail: await window.api.skills.get({ skillId: item.skill.id }),
            phase: "ready",
          });
        } else if (
          item.capability.installationState === "available" &&
          item.capability.packageName
        ) {
          await inspectPackage(item.capability.packageName, item.capability.id);
        } else {
          patch({
            detail: await window.api.capabilities.get({
              capabilityId: item.capability.id,
              ...(runId ? { runId } : {}),
            }),
            phase: "ready",
          });
        }
      } catch {
        patch({
          phase: "error",
          error: "Could not load Marketplace item details.",
        });
      }
    },
    [inspectPackage, patch, runId],
  );

  const installCapability = useCallback(async () => {
    const inspection = state.inspection;
    if (!inspection) return;
    patch({ phase: "installing" });
    try {
      const detail = await window.api.marketplace.install({
        inspectionId: inspection.inspectionId,
        acceptedPackageName: inspection.packageName,
        acceptedVersion: inspection.resolvedVersion,
        acceptedIntegrity: inspection.integrity,
        acceptedPermissionDigest: inspection.permissionDigest,
      });
      patch({ detail, inspection: undefined, phase: "ready" });
      await refresh();
    } catch {
      patch({ phase: "error", error: operationError });
    }
  }, [patch, refresh, state.inspection]);

  const requestUpdate = useCallback(async () => {
    const detail =
      state.detail && !("instructionPreview" in state.detail)
        ? state.detail
        : undefined;
    if (detail?.packageName)
      await inspectPackage(detail.packageName, detail.id, "update");
  }, [inspectPackage, state.detail]);

  const updateCapability = useCallback(async () => {
    const inspection = state.inspection;
    if (!inspection?.update) return;
    patch({ phase: "updating" });
    try {
      const detail = await window.api.marketplace.update({
        inspectionId: inspection.inspectionId,
        packageName: inspection.packageName,
        acceptedPackageName: inspection.packageName,
        acceptedVersion: inspection.resolvedVersion,
        acceptedIntegrity: inspection.integrity,
        acceptedPermissionDigest: inspection.permissionDigest,
        acceptedDowngrade: inspection.update.downgrade,
        acceptedActiveRunCount: inspection.update.activeRunCount,
      });
      patch({ detail, inspection: undefined, phase: "ready" });
      await refresh();
    } catch {
      patch({ phase: "error", error: operationError });
    }
  }, [patch, refresh, state.inspection]);

  const requestRemoval = useCallback(async () => {
    const capability =
      state.detail && !("instructionPreview" in state.detail)
        ? state.detail
        : undefined;
    if (!capability?.packageName) return;
    patch({ error: undefined });
    try {
      const removalReview = await window.api.marketplace.inspectRemoval({
        packageName: capability.packageName,
      });
      patch({ removalReview, phase: "review" });
    } catch {
      patch({ phase: "error", error: operationError });
    }
  }, [patch, state.detail]);

  const cancelRemoval = useCallback(() => {
    patch({ removalReview: undefined, phase: "ready" });
  }, [patch]);

  const confirmRemoval = useCallback(async () => {
    const review = state.removalReview;
    if (!review) return;
    patch({ phase: "removing" });
    try {
      await window.api.marketplace.remove({
        inspectionId: review.inspectionId,
        packageName: review.packageName,
        acceptedActiveVersion: review.activeVersion,
        acceptedActiveRunCount: review.activeRunCount,
      });
      patch({
        detail: undefined,
        selected: undefined,
        removalReview: undefined,
        phase: "ready",
      });
      await refresh();
    } catch {
      patch({ phase: "error", error: operationError });
    }
  }, [patch, refresh, state.removalReview]);

  const cancelOperation = useCallback(async () => {
    if (!state.progress) return;
    try {
      await window.api.marketplace.cancel({
        operationId: state.progress.operationId,
      });
      patch({ phase: "ready", progress: undefined });
    } catch {
      patch({ error: operationError });
    }
  }, [patch, state.progress]);

  const installSkill = useCallback(async () => {
    try {
      await window.api.skills.install();
      await refresh();
    } catch {
      patch({ error: "Could not import the Skill." });
    }
  }, [patch, refresh]);
  const removeSkill = useCallback(
    async (id: string) => {
      try {
        await window.api.skills.remove({ skillId: id });
        patch({ detail: undefined, selected: undefined });
        await refresh();
      } catch {
        patch({ error: "Could not remove the Skill." });
      }
    },
    [patch, refresh],
  );

  const isExactSpec = exactSpecPattern.test(state.query.trim());
  const items = useMemo(
    () =>
      state.items.filter((item) => {
        const value = item.kind === "skill" ? item.skill : item.capability;
        const installed =
          item.kind === "skill"
            ? item.skill.installationState === "installed"
            : item.capability.installationState !== "available";
        const matchesFilter =
          state.filter === "all" ||
          state.filter === item.kind ||
          (state.filter === "installed" && installed);
        return (
          matchesFilter &&
          (isExactSpec ||
            `${value.name} ${value.description}`
              .toLowerCase()
              .includes(state.query.toLowerCase()))
        );
      }),
    [isExactSpec, state.filter, state.items, state.query],
  );

  return {
    ...state,
    items,
    loading: state.phase === "loading",
    isExactSpec,
    setFilter: (filter: Filter) => patch({ filter }),
    setQuery: (query: string) => patch({ query }),
    refresh,
    select,
    inspectPackage,
    installCapability,
    requestUpdate,
    updateCapability,
    requestRemoval,
    cancelRemoval,
    confirmRemoval,
    cancelOperation,
    installSkill,
    removeSkill,
  };
}
