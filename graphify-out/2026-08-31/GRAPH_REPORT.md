# Graph Report - agentic-worktrees  (2026-08-30)

## Corpus Check
- 352 files · ~314,380 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 2312 nodes · 4953 edges · 185 communities (111 shown, 74 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 119 edges (avg confidence: 0.84)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- schemas.ts
- SecondarySessionSelector.tsx
- ipc/index.ts
- Dashboard.tsx
- WorkspacePanel.tsx
- codex-protocol.ts
- codex-adapter.ts
- capability-host-manager.ts
- intelligence-repository.ts
- button.tsx
- db/schema.ts
- CodexAppServerClient
- NewSessionDialog.test.tsx
- conflict-intelligence-service.ts
- cn()
- integration-git-adapter.ts
- git-change-collector.ts
- api.ts
- coding-agent-service.ts
- CapabilityError
- compilerOptions
- auth-service.ts
- capability-credential-store.ts
- preload.ts
- exa-client.ts
- integration-worktree-service.ts
- workspace-terminal-service.ts
- CapabilityRepository
- getDatabase()
- capability-service.ts
- intelligence-service.ts
- opencode-adapter.ts
- App.tsx
- AppShell.tsx
- auth-state.ts
- CodingAgentSession.tsx
- SessionComposer.tsx
- dependencies
- OpenCodeAdapter
- components.json
- extends
- FakeCodexClient
- editor-service.ts
- GitHubAuthService
- overlap-classifier.ts
- WorkspaceGitService
- intelligence-components.test.tsx
- capability-sdk/src/index.ts
- src/types.ts
- coding-agents/types.ts
- CodingAgentAdapter
- conflict-resolution-repository.ts
- credential-store.ts
- workspace-file-service.ts
- ConflictResolutionSessionDto
- Intelligence.tsx
- main.ts
- CapabilityService
- Capability SDK v0.1
- getHarnessForInstallation()
- coding-agent-service.test.ts
- auth-service.test.ts
- symbol-analyzer.ts
- utils.ts
- IntelligenceOverlapDto
- package.json
- client.ts
- IntelligenceSnapshotDto
- workspace-git-service.ts
- SessionMessages.tsx
- schemas.test.ts
- scripts
- smoke-capability-web-search.mjs
- opencode-utils.ts
- worktree.ts
- reconcileAgentSession()
- git-process.ts
- repos.ts
- github-auth-handlers.test.ts
- capability-sdk/package.json
- CoalescingTaskScheduler
- SessionStatusPopup.tsx
- ToolCallGroup.tsx
- conflict-workspace.test.tsx
- web-search/package.json
- devDependencies
- conflicts/index.ts
- repository-service.ts
- CapabilityPicker.tsx
- useCodingAgentSession.ts
- Deterministic Overlap Intelligence
- useCapabilities.ts
- changes-summary.ts
- main-lifecycle.test.ts
- PickerMenu.tsx
- codex-utils.ts
- isLocalRepository()
- CodingAgentDiffDto
- CoalescingTaskQueue
- Conflict Room
- Cross-Worktree Conflicts UI
- CommandApprovalCard.tsx
- use-worktree-chat-summary.test.tsx
- Intelligence.test.tsx
- Integrated Workspace Tools
- Agent-Neutral Composer Commands
- CodingAgentAccountUsage
- AIMessage.tsx
- SessionThought.tsx
- Workspace Side Panel
- Cross-worktree Intelligence
- better-sqlite3
- class-variance-authority
- Agentic Worktrees Logo
- Route Section Transition
- Branches-First Repository Workspace
- Dual Chat Panel Transition
- drizzle-orm
- @electron-forge/cli
- @electron-forge/maker-deb
- @electron-forge/maker-rpm
- @electron-forge/maker-squirrel
- @electron-forge/maker-zip
- @electron-forge/plugin-fuses
- @electron-forge/plugin-vite
- @electron/fuses
- electron-squirrel-startup
- eslint
- eslint-import-resolver-typescript
- eslint-plugin-import
- @fontsource-variable/geist-mono
- @fontsource-variable/instrument-sans
- config
- jsdom
- lucide-react
- @modelcontextprotocol/sdk
- node-pty
- octokit
- @opencode-ai/sdk
- react
- react-dom
- react-markdown
- shadcn
- shiki
- simple-git
- tw-animate-css
- @xterm/addon-fit
- zod
- @playwright/test
- tailwindcss
- @tailwindcss/vite
- @testing-library/react
- @testing-library/user-event
- @types/better-sqlite3
- @types/electron-squirrel-startup
- @types/react
- @types/react-dom
- typescript
- @typescript-eslint/eslint-plugin
- @typescript-eslint/parser
- vite
- @vitejs/plugin-react
- vitest
- stylesheet
- nodeBuiltins
- Comment Icon
- Folder Icon
- Pull Request Icon
- Settings Icon
- Dashboard Main Workspace Redesign
- Red Black Waves Background
- Android Studio Icon
- Cursor Icon
- IntelliJ IDEA Icon
- Sublime Text Icon
- Visual Studio Code Icon
- WebStorm Icon
- Zed Icon

## God Nodes (most connected - your core abstractions)
1. `cn()` - 72 edges
2. `registerIpcHandlers()` - 62 edges
3. `Api` - 43 edges
4. `CapabilityError` - 41 edges
5. `getDatabase()` - 40 edges
6. `Button()` - 33 edges
7. `CodexAdapter` - 28 edges
8. `CodexAppServerClient` - 27 edges
9. `OpenCodeAdapter` - 26 edges
10. `CodingAgentAdapter` - 25 edges

## Surprising Connections (you probably didn't know these)
- `Agentic Worktrees Logo` --semantically_similar_to--> `Agentic Worktrees Logo`  [INFERRED] [semantically similar]
  docs/assets/agentic-worktrees-logo.png → src/renderer/assets/agentic-worktrees-logo.png
- `decodeExaTransportPayload()` --calls--> `CapabilityError`  [EXTRACTED]
  capabilities/web-search/src/exa-client.ts → packages/capability-sdk/src/errors.ts
- `parseJsonOrSse()` --calls--> `CapabilityError`  [EXTRACTED]
  capabilities/web-search/src/exa-client.ts → packages/capability-sdk/src/errors.ts
- `unwrapMcp()` --calls--> `CapabilityError`  [EXTRACTED]
  capabilities/web-search/src/exa-client.ts → packages/capability-sdk/src/errors.ts
- `normalizeFailure()` --calls--> `CapabilityError`  [EXTRACTED]
  capabilities/web-search/src/exa-client.ts → packages/capability-sdk/src/errors.ts

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Capability SDK Delivery Flow** — docs_capabilities_2026_08_27_capability_sdk_web_search_design_capabilitysdk, docs_capabilities_2026_08_27_capability_sdk_web_search_implementation_plan_implementationplan, docs_capabilities_authoring_capabilities_bundledcapabilityauthoring [INFERRED 0.95]
- **Capability Activation Runtime** — docs_capabilities_2026_08_27_capability_sdk_web_search_design_capabilitymanager, docs_capabilities_2026_08_27_capability_sdk_web_search_design_capabilityhost, docs_capabilities_2026_08_27_capability_sdk_web_search_design_activationadapters [EXTRACTED 1.00]
- **Human-Controlled Conflict Resolution** — docs_conflict_panel_cross_worktree_conflicts_product_ideas_conflictroom, docs_conflict_panel_cross_worktree_conflicts_product_ideas_conflictbrief, docs_conflict_panel_cross_worktree_conflicts_product_ideas_conflictroommvp [EXTRACTED 1.00]
- **Coding-Agent Workspace Experience** — docs_superpowers_plans_2026_07_28_workspace_side_panel_integrated_workspace_tools, docs_superpowers_plans_2026_08_06_codex_slash_commands_file_mentions_agent_neutral_composer_commands, docs_superpowers_plans_2026_08_07_dual_chat_panel_transition_synchronized_dual_chat_transition, docs_superpowers_plans_2026_08_22_primary_checkout_coding_agent_primary_checkout_workspace [INFERRED 0.75]
- **Conflict Intelligence Workflow** — docs_superpowers_plans_2026_08_09_cross_worktree_intelligence_deterministic_overlap_intelligence, docs_superpowers_plans_2026_08_09_cross_worktree_conflicts_ui_three_column_conflict_workspace, docs_superpowers_plans_2026_08_09_conflict_confirmation_preparation_git_conflict_confirmation, docs_superpowers_plans_2026_08_09_clickable_conflict_chat_cards_worktree_card_chat_navigation [INFERRED 0.85]
- **Cross Worktree Conflict Workflow** — docs_superpowers_specs_2026_08_09_cross_worktree_intelligence_design_cross_worktree_intelligence, docs_superpowers_specs_2026_08_09_conflict_confirmation_preparation_design_conflict_confirmation_preparation, docs_superpowers_specs_2026_08_25_ai_conflict_resolution_design_supervised_ai_conflict_resolution [EXTRACTED 1.00]

## Communities (185 total, 74 thin omitted)

### Community 0 - "schemas.ts"
Cohesion: 0.02
Nodes (87): availableEditorSchema, branchSchema, capabilityCompatibilitySchema, capabilityIdSchema, capabilitySettingDetailSchema, capabilityStateSchema, codingAgentAccountUsageRequestSchema, codingAgentDiffSchema (+79 more)

### Community 1 - "SecondarySessionSelector.tsx"
Cohesion: 0.06
Nodes (53): CodingAgentLayoutControls(), CodingAgentLayoutMode, Props, buildProjectGroups(), CodingAgentProjectSidebar(), ProjectGroup, ProjectSession, Props (+45 more)

### Community 2 - "ipc/index.ts"
Cohesion: 0.07
Nodes (64): listAgentWorktrees(), subscribeToAgentEvents(), listAvailableEditors(), openEditor(), isGitHubOperationError(), listRemoteRepositories(), authStatusResponse(), capabilityHandlers() (+56 more)

### Community 3 - "Dashboard.tsx"
Cohesion: 0.08
Nodes (37): Skeleton(), chatSummary, repository, worktree, BranchChatStatus, BranchRow(), getChatStatusPresentation(), RepositoryBranchListState (+29 more)

### Community 4 - "WorkspacePanel.tsx"
Cohesion: 0.07
Nodes (33): CommitDialog(), DirectoryState, errorMessage(), FileBrowserPanel(), initialDirectoryState, FilePreview(), FilePreviewProps, formatBytes() (+25 more)

### Community 5 - "codex-protocol.ts"
Cohesion: 0.06
Nodes (41): codexAccountRateLimitsSchema, codexCommandApprovalSchema, codexCompletedNotificationSchema, codexDeltaNotificationSchema, codexFailedNotificationSchema, codexFileApprovalSchema, codexFileChangeSchema, codexFileSystemPermissionsSchema (+33 more)

### Community 6 - "codex-adapter.ts"
Cohesion: 0.09
Nodes (22): approvalDecision(), capabilityConfig(), CodexAdapter, CodexClient, errorMessage(), execFile, hasExpectedCapabilityServer(), PendingApproval (+14 more)

### Community 7 - "capability-host-manager.ts"
Cohesion: 0.10
Nodes (18): adaptElectronUtilityProcess(), CapabilityHostConnection, CapabilityHostManager, CapabilityHostManagerDependencies, CapabilityUtilityProcess, HostRecord, isDeclaredSecret(), reject() (+10 more)

### Community 8 - "intelligence-repository.ts"
Cohesion: 0.10
Nodes (25): asChangeType(), asRisk(), asTargetType(), createIntelligenceRepository(), Database, IntelligenceRepository, loadSnapshot(), parseJson() (+17 more)

### Community 9 - "button.tsx"
Cohesion: 0.14
Nodes (25): Button(), ButtonProps, Size, sizes, Variant, variants, Dialog(), DialogDescription() (+17 more)

### Community 10 - "db/schema.ts"
Cohesion: 0.06
Nodes (35): CapabilityInstallation, capabilityInstallations, CapabilitySettingRecord, capabilitySettings, CodingAgentInstallation, CodingAgentSession, CodingAgentSessionDiff, ConflictResolutionFile (+27 more)

### Community 11 - "CodexAppServerClient"
Cohesion: 0.12
Nodes (10): CodexAppServerClient, errorMessage(), isRecord(), isRequestId(), PendingRequest, SpawnCodex, createFakeCodexTransport(), FakeTransportOptions (+2 more)

### Community 12 - "NewSessionDialog.test.tsx"
Cohesion: 0.08
Nodes (9): contexts, findAll(), installations, Listener, TestDocument, TestElement, TestNode, TestText (+1 more)

### Community 13 - "conflict-intelligence-service.ts"
Cohesion: 0.09
Nodes (13): ConflictIntelligenceService, ConflictIntelligenceServiceDependencies, ConflictSessionChangedEvent, createConflictIntelligenceService(), RepositorySource, terminalStates, overlapDetails, WorktreeSource (+5 more)

### Community 14 - "cn()"
Cohesion: 0.14
Nodes (28): Alert(), AlertAction(), AlertDescription(), AlertTitle(), alertVariants, AlertDialog(), AlertDialogAction(), AlertDialogCancel() (+20 more)

### Community 15 - "integration-git-adapter.ts"
Cohesion: 0.08
Nodes (16): GitProcess, createIntegrationGitAdapter(), indexPathFor(), IntegrationGitAdapter, IntegrationWorktreeResult, safeSessionId(), SyntheticSnapshotResult, git() (+8 more)

### Community 16 - "git-change-collector.ts"
Cohesion: 0.12
Nodes (26): addedFilePatch(), collectEntries(), collectTrackedFile(), collectUntrackedFile(), completeFileChange(), countLines(), createFingerprint(), createGitChangeCollector() (+18 more)

### Community 17 - "api.ts"
Cohesion: 0.12
Nodes (25): WorkspaceFileService, Window, Api, AvailableEditorDto, CapabilityActivateRequest, CapabilityChangedEventDto, CapabilityDeactivateRequest, CodingAgentAccountUsageDto (+17 more)

### Community 18 - "coding-agent-service.ts"
Cohesion: 0.10
Nodes (26): AgentInstallationStatus, AgentSessionCapabilitySnapshot, AgentSessionSummary, AgentStatus, capabilityConnectionStates, capabilityPreparedRuns, capabilityProfileId(), CodingAgentHarness (+18 more)

### Community 19 - "CapabilityError"
Cohesion: 0.12
Nodes (18): CapabilityError, CapabilityDefinition, CapabilityTool, ActiveTool, authorized(), body(), CapabilityHostServer, CapabilityHostServerOptions (+10 more)

### Community 20 - "compilerOptions"
Cohesion: 0.07
Nodes (27): DOM, DOM.Iterable, ESNext, scripts, compilerOptions, allowJs, allowSyntheticDefaultImports, baseUrl (+19 more)

### Community 21 - "auth-service.ts"
Cohesion: 0.12
Nodes (23): ClassifiedAuthError, classifyAuthError(), createCredentials(), createGitHubAuthService(), DeviceAuthorization, DeviceCodeResponse, formRequest(), getAuthenticatedOctokit() (+15 more)

### Community 22 - "capability-credential-store.ts"
Cohesion: 0.15
Nodes (8): CapabilityCredentialPayload, CapabilityCredentialStore, CapabilityCredentialStoreDependencies, emptyPayload(), isPayload(), missing(), redact(), SafeLogCause

### Community 23 - "preload.ts"
Cohesion: 0.09
Nodes (24): createCapabilityHandlers(), api, capabilityActivateRequestSchema, capabilityChangedEventSchema, capabilityConfigureRequestSchema, capabilityDeactivateRequestSchema, capabilityDetailSchema, capabilityGetRequestSchema (+16 more)

### Community 24 - "exa-client.ts"
Cohesion: 0.14
Nodes (20): basicFallbackInput(), buildAdvancedArguments(), decodeExaTransportPayload(), directSearch(), ExaTransportPayload, hostedSearch(), isExaTransportPayload(), normalizeFailure() (+12 more)

### Community 25 - "integration-worktree-service.ts"
Cohesion: 0.14
Nodes (18): assertResolutionTransition(), classifyConfirmedConflict(), reviewReasonCodes, transitions, IntegrationParticipantInput, IntegrationPreparationInput, IntegrationPreparationResult, mergeFiles() (+10 more)

### Community 26 - "workspace-terminal-service.ts"
Cohesion: 0.10
Nodes (10): createWorkspaceTerminalService(), Disposable, getShell(), PtySpawnOptions, TerminalDimensions, TerminalIdentity, TerminalRecord, WorkspacePty (+2 more)

### Community 27 - "CapabilityRepository"
Cohesion: 0.13
Nodes (10): allowedTransitions, CapabilityInstallationRecord, CapabilityRepository, CapabilitySettingRecord, installationFromRow(), InstallationRow, parseStoredSetting(), PersistedCapabilityStatus (+2 more)

### Community 28 - "getDatabase()"
Cohesion: 0.16
Nodes (20): appendOutputEvent(), createAgentSession(), getInstallation(), listAgentSessions(), listCapabilityReloadSessions(), toSummary(), AgentWorktreeContext, getPrimaryWorkspaceId() (+12 more)

### Community 29 - "capability-service.ts"
Cohesion: 0.20
Nodes (15): webSearchManifest, MINIMUM_AGENT_VERSIONS, recordState(), bundledCapabilities, BundledCapability, entry, getBundledCapability(), listBundledCapabilities() (+7 more)

### Community 30 - "intelligence-service.ts"
Cohesion: 0.13
Nodes (21): GitChangeCollector, ACTIVE_STATUSES, collectOne(), collectRepositoryChanges(), createIntelligenceService(), diffFiles(), enrichSymbols(), IntelligenceServiceDependencies (+13 more)

### Community 31 - "opencode-adapter.ts"
Cohesion: 0.15
Nodes (18): normalizeDiff(), NormalizedOpenCodePayload, normalizeOpenCodePayload(), normalizePermissionRequest(), OpenCodeDiffPayload, OpenCodePermissionReplyProtocol, readPatchContent(), readReasoningVariants() (+10 more)

### Community 32 - "App.tsx"
Cohesion: 0.15
Nodes (14): App(), Integration, AuthBootstrap(), AuthGate(), AuthGateContent(), GitHubLogin(), useRemainingSeconds(), useGitHubAuth() (+6 more)

### Community 33 - "AppShell.tsx"
Cohesion: 0.18
Nodes (15): clampDashboardSidebarWidth(), DASHBOARD_SIDEBAR_DEFAULT_WIDTH, DASHBOARD_SIDEBAR_EXPANDED_MIN_WIDTH, DASHBOARD_SIDEBAR_MAX_WIDTH, DASHBOARD_SIDEBAR_MIN_WIDTH, isDashboardSidebarCollapsed(), isDashboardWorkspace(), AppShell() (+7 more)

### Community 34 - "auth-state.ts"
Cohesion: 0.20
Nodes (18): AuthAction, AuthActionErrorKind, authReducer(), AuthState, AuthView, createInitialAuthState(), emptyStatus(), getAuthView() (+10 more)

### Community 35 - "CodingAgentSession.tsx"
Cohesion: 0.13
Nodes (16): ActiveCapabilities(), ActiveCapability, AccountUsagePopup(), costFormat, formatReset(), formatWindow(), Props, session (+8 more)

### Community 36 - "SessionComposer.tsx"
Cohesion: 0.17
Nodes (13): Props, SessionComposer(), emptyState, FileMentionSuggestionState, useFileMentionSuggestions(), ActiveFileMention, findActiveFileMention(), formatFileReference() (+5 more)

### Community 37 - "dependencies"
Cohesion: 0.10
Nodes (21): @base-ui/react, clsx, dotenv, nanoid, next-themes, dependencies, ajv, @base-ui/react (+13 more)

### Community 39 - "components.json"
Cohesion: 0.10
Nodes (19): aliases, components, hooks, lib, ui, utils, iconLibrary, registries (+11 more)

### Community 40 - "extends"
Cohesion: 0.10
Nodes (19): env, browser, es6, node, extends, typescript, parser, rules (+11 more)

### Community 41 - "FakeCodexClient"
Cohesion: 0.14
Nodes (7): createAdapter(), emitTokenUsage(), FakeCodexClient, RecordedRequest, RecordedResponse, threadResponse(), CodexIncomingMessage

### Community 42 - "editor-service.ts"
Cohesion: 0.12
Nodes (13): AvailableEditor, commandExists(), createEditorService(), EDITOR_CATALOG, EDITOR_COMMANDS, EditorCommand, EditorId, EditorService (+5 more)

### Community 43 - "GitHubAuthService"
Cohesion: 0.13
Nodes (9): cancelGitHubLogin(), completeGitHubLogin(), CompletionState, getAuthStatus(), GitHubAuthService, logoutFromGitHub(), refreshGitHubInstallations(), startGitHubLogin() (+1 more)

### Community 44 - "overlap-classifier.ts"
Cohesion: 0.20
Nodes (18): bestTarget(), classifyWorktreeOverlaps(), commonFolder(), compareFilePair(), compareWorktreePair(), countModuleWorktrees(), overlappingRangeTarget(), overlapSummary() (+10 more)

### Community 45 - "WorkspaceGitService"
Cohesion: 0.16
Nodes (6): createWorkspaceGitService(), parseCount(), WorkspaceGitClient, WorkspaceGitContext, WorkspaceGitService, WorkspaceGitStatusDto

### Community 46 - "intelligence-components.test.tsx"
Cohesion: 0.13
Nodes (14): DiffComparison(), emptySnapshot, fiveWorktreeSnapshot, high, low, mediumPassive, IntelligenceSummary(), IntelligenceWorktreeNode() (+6 more)

### Community 47 - "capability-sdk/src/index.ts"
Cohesion: 0.16
Nodes (10): createWebSearchCapability(), CapabilityErrorCode, defineCapability(), defineTool(), manifest, validateCapabilityDefinition(), CapabilityManifest, echo (+2 more)

### Community 48 - "src/types.ts"
Cohesion: 0.14
Nodes (11): boundedDetails(), CAPABILITY_OUTPUT_MAX_BYTES, CAPABILITY_OUTPUT_MAX_LINES, limitCapabilityOutput(), truncateText(), CapabilityAgentKind, CapabilityCompatibility, CapabilityExecutionContext (+3 more)

### Community 49 - "coding-agents/types.ts"
Cohesion: 0.13
Nodes (10): CodingAgentCapabilityActivator, AgentSessionSnapshot, CodingAgentAccountUsageWindow, CodingAgentCapabilityConnection, CodingAgentDiff, CodingAgentMessage, CodingAgentRunStatus, CodingAgentSessionUsage (+2 more)

### Community 51 - "conflict-resolution-repository.ts"
Cohesion: 0.16
Nodes (13): activeStates, classification(), createConflictResolutionRepository(), Database, fileKind(), loadSession(), operationStatus(), parseJson() (+5 more)

### Community 52 - "credential-store.ts"
Cohesion: 0.14
Nodes (12): getDefaultService(), createElectronGitHubCredentialStore(), createGitHubCredentialStore(), DecryptionResult, GitHubCredentialPayload, GitHubCredentialStoreDependencies, isMissingFileError(), StorageBackend (+4 more)

### Community 53 - "workspace-file-service.ts"
Cohesion: 0.15
Nodes (11): createWorkspaceFileService(), execFileAsync, listGitVisibleFiles(), ListWorkspaceFiles, WorkspaceFileServiceDependencies, isInsideRoot(), normalizeRelativePath(), productionDependencies (+3 more)

### Community 54 - "ConflictResolutionSessionDto"
Cohesion: 0.19
Nodes (11): overlap, ConflictFileEvidence(), Props, rangeLabel(), ConflictPreparation(), Props, transient, message() (+3 more)

### Community 55 - "Intelligence.tsx"
Cohesion: 0.20
Nodes (11): ConflictDisplayKind, conflictFileCount(), ConflictPresentation, predictedReasons, riskRank, selectConflicts(), worktreeFor(), ConflictList() (+3 more)

### Community 56 - "main.ts"
Cohesion: 0.21
Nodes (13): createElectronCapabilityCredentialStore(), createElectronCapabilityHostManager(), applyCodingAgentCapabilities(), autoDiscoverAgent(), configureAgent(), configureCodingAgentCapabilityBridge(), getAgentInstallationStatus(), getCodingAgentCapabilitySession() (+5 more)

### Community 57 - "CapabilityService"
Cohesion: 0.22
Nodes (6): SessionCapabilityRecord, CapabilityService, CapabilityServiceDependencies, isVersionAtLeast(), sessionDto(), CapabilitySessionStateDto

### Community 58 - "Capability SDK v0.1"
Cohesion: 0.14
Nodes (16): Provider Activation Adapters, Capability Host, Capability Manager, Capability SDK v0.1, Capability Credential Vault, Keyless Web Search Pilot, Capability Workspace Packages, Capability SDK Implementation Plan (+8 more)

### Community 59 - "getHarnessForInstallation()"
Cohesion: 0.35
Nodes (16): abortAgentSession(), compactAgentSession(), ensureStarted(), findRunIdForExternalSession(), getAgentAccountUsage(), getAgentSessionUsage(), getContext(), getHarnessForInstallation() (+8 more)

### Community 60 - "coding-agent-service.test.ts"
Cohesion: 0.12
Nodes (10): AgentUiEvent, markAgentSessionViewed(), AppDatabase, EventListener, mocks, codingAgentInstallations, codingAgentSessionDiffs, codingAgentSessions (+2 more)

### Community 61 - "auth-service.test.ts"
Cohesion: 0.13
Nodes (8): GitHubAuthServiceDependencies, config, credentials, deferredJsonResponse(), deviceChallenge, jsonResponse(), successfulToken, GitHubCredentialStore

### Community 62 - "symbol-analyzer.ts"
Cohesion: 0.23
Nodes (13): analyzeChangedSymbols(), AnalyzeChangedSymbolsInput, candidateKind(), changedSpan(), collectCandidates(), declarationName(), executableInitializer(), identifierName() (+5 more)

### Community 63 - "utils.ts"
Cohesion: 0.18
Nodes (10): Badge(), BadgeProps, Variant, variants, DropdownMenu(), DropdownMenuItem, DropdownMenuProps, Select (+2 more)

### Community 64 - "IntelligenceOverlapDto"
Cohesion: 0.22
Nodes (12): AttentionPanel(), Props, ConflictDetails(), Props, titleCase(), number, Props, Risk (+4 more)

### Community 65 - "package.json"
Cohesion: 0.13
Nodes (14): author, email, name, description, capabilities/*, packages/*, keywords, license (+6 more)

### Community 66 - "client.ts"
Cohesion: 0.23
Nodes (9): bootstrapSchemaSql, bootstrapStatements, getDatabasePath(), getSqlite(), applyDatabaseUpgrades(), initDatabase(), TableInfoRow, AppDatabase (+1 more)

### Community 67 - "IntelligenceSnapshotDto"
Cohesion: 0.17
Nodes (5): IntelligenceService, errorMessage(), repository, useIntelligence(), IntelligenceSnapshotDto

### Community 68 - "workspace-git-service.ts"
Cohesion: 0.22
Nodes (13): getRepositoryById(), setRepositoryCloneStatus(), getProductionContext(), GitRemote, GitStatusSnapshot, PullRequestClient, WorkspaceGitServiceDependencies, createWorktree() (+5 more)

### Community 69 - "SessionMessages.tsx"
Cohesion: 0.21
Nodes (8): Props, SessionMessages(), buildSessionMessageEntries(), mergeToolCalls(), SessionMessageEntry, ThoughtEntry, ToolEntry, CodingAgentMessageDto

### Community 70 - "schemas.test.ts"
Cohesion: 0.13
Nodes (14): codingAgentAccountUsageSchema, codingAgentKindSchema, codingAgentModelsRequestSchema, codingAgentSessionCreateRequestSchema, codingAgentSessionUsageSchema, codingAgentSessionViewedRequestSchema, conflictPrepareRequestSchema, editorOpenRequestSchema (+6 more)

### Community 71 - "scripts"
Cohesion: 0.14
Nodes (14): scripts, build:capability-host, db:generate, db:migrate, lint, make, package, prestart (+6 more)

### Community 72 - "smoke-capability-web-search.mjs"
Cohesion: 0.26
Nodes (9): createElectronCapabilitySmokeDriver(), smokeSessionIsIdle(), assistantMessages(), atLeast(), messages(), minimums, runCapabilitySmoke(), snapshotMessages() (+1 more)

### Community 73 - "opencode-utils.ts"
Cohesion: 0.21
Nodes (7): toOpenCodeRunStatus(), COMMON_PATHS, execFileAsync, findOpenCodeInSystem(), parseOpenCodeVersion(), readOpenCodeSessionId(), reserveLocalPort()

### Community 74 - "worktree.ts"
Cohesion: 0.29
Nodes (11): { getGitHubAccessToken, simpleGit }, repository, createAuthenticatedGitClient(), CreatedWorktree, createWorktreeFromBranch(), ensureClone(), ensureDirFor(), getRepoSourcePath() (+3 more)

### Community 75 - "reconcileAgentSession()"
Cohesion: 0.26
Nodes (7): CodingAgentCapabilityBridge, getAgentSessionSnapshot(), getPersistedSessionDiffs(), persistSessionDiffs(), reconcileAgentSession(), replaceProjectedMessages(), sessionNeedsCapabilityConnection()

### Community 76 - "git-process.ts"
Cohesion: 0.21
Nodes (8): containsUnsafeRefCharacter(), createGitProcess(), GitCommandError, GitRunner, GitRunnerOptions, GitRunOptions, GitRunResult, isUnsafeRef()

### Community 77 - "repos.ts"
Cohesion: 0.24
Nodes (7): listBranches(), RemoteBranch, getAuthenticatedOctokit(), InstallationRepo, InstallationRepositoriesResponse, { getAuthenticatedOctokit }, UserInstallationsResponse

### Community 78 - "github-auth-handlers.test.ts"
Cohesion: 0.22
Nodes (6): authChannels, IpcHandler, mocks, mocks, IPC_CHANNELS, IpcChannel

### Community 79 - "capability-sdk/package.json"
Cohesion: 0.20
Nodes (9): dependencies, ajv, exports, files, ajv, src, name, type (+1 more)

### Community 80 - "CoalescingTaskScheduler"
Cohesion: 0.27
Nodes (3): CoalescingTaskScheduler, ScheduledTaskState, stopCodingAgents()

### Community 81 - "SessionStatusPopup.tsx"
Cohesion: 0.27
Nodes (7): createSession(), InteractiveComposer(), renderComposer(), costFormat, Props, SessionStatusPopup(), tokenFormat

### Community 82 - "ToolCallGroup.tsx"
Cohesion: 0.24
Nodes (5): Props, TOOL_ICONS, ToolCallGroup(), ToolRow(), CodingAgentToolCallDto

### Community 83 - "conflict-workspace.test.tsx"
Cohesion: 0.22
Nodes (6): conflict, left, right, ConflictActions(), number, Props

### Community 84 - "web-search/package.json"
Cohesion: 0.22
Nodes (8): @agentic-worktrees/capability-sdk, dependencies, @agentic-worktrees/capability-sdk, exports, name, private, type, version

### Community 85 - "devDependencies"
Cohesion: 0.22
Nodes (9): drizzle-kit, electron, @electron-forge/plugin-auto-unpack-natives, @electron/rebuild, devDependencies, drizzle-kit, electron, @electron-forge/plugin-auto-unpack-natives (+1 more)

### Community 86 - "conflicts/index.ts"
Cohesion: 0.31
Nodes (7): EnvConfig, getEnvConfig(), requireEnv(), resolveUserPath(), conflictIntelligenceService, git, integrationRoot

### Community 87 - "repository-service.ts"
Cohesion: 0.39
Nodes (7): assertGitMetadataExists(), detectDefaultBranch(), importLocalRepository(), getLocalRepositoryFullName(), getStableLocalGithubRepoId(), LocalCloneStatus, upsertLocalRepository()

### Community 88 - "CapabilityPicker.tsx"
Cohesion: 0.31
Nodes (5): activeStates, CapabilityPicker(), groupFor(), label(), detail

### Community 89 - "useCodingAgentSession.ts"
Cohesion: 0.44
Nodes (5): useCodingAgentSession(), getAgentDisplay(), readPermission(), readToolActivity(), PendingPermission

### Community 90 - "Deterministic Overlap Intelligence"
Cohesion: 0.25
Nodes (8): Clickable Conflict Chat Cards Plan, Worktree Card Chat Navigation, Conflict Confirmation and Integration Preparation Plan, Git Conflict Confirmation, Cross-Worktree Conflicts UI Plan, Three-Column Conflict Workspace, Cross-Worktree Intelligence Plan, Deterministic Overlap Intelligence

### Community 91 - "useCapabilities.ts"
Cohesion: 0.29
Nodes (4): useCapabilities(), Capabilities(), detail, summary

### Community 92 - "changes-summary.ts"
Cohesion: 0.36
Nodes (5): ChangesSummarySnapshot, ChangesSummaryUpdate, isBusyLikeStatus(), nextChangesSummaryUpdate(), diff

### Community 93 - "main-lifecycle.test.ts"
Cohesion: 0.29
Nodes (3): AppListener, BrowserWindow, mocks

### Community 94 - "PickerMenu.tsx"
Cohesion: 0.38
Nodes (4): PickerMenu(), PickerOption, Props, options

### Community 95 - "codex-utils.ts"
Cohesion: 0.60
Nodes (4): execFile, findCodexInSystem(), getCodexCandidates(), parseCodexVersion()

### Community 96 - "isLocalRepository()"
Cohesion: 0.40
Nodes (5): createLocalBranch(), listLocalBranches(), handleCreateLocalBranch(), handleGithubListBranches(), isLocalRepository()

### Community 97 - "CodingAgentDiffDto"
Cohesion: 0.47
Nodes (4): Props, SessionChangesSummary(), diff, CodingAgentDiffDto

### Community 99 - "Conflict Room"
Cohesion: 0.40
Nodes (5): Electron Architecture Rules, Conflict Brief, Conflict Room, Guided Conflict Room MVP, Integration Agent

### Community 100 - "Cross-Worktree Conflicts UI"
Cohesion: 0.50
Nodes (5): Clickable Conflict Chat Cards, Conflict Confirmation and Integration Preparation, Cross-Worktree Conflicts UI, Cross-Worktree Intelligence, Supervised AI Conflict Resolution

### Community 101 - "CommandApprovalCard.tsx"
Cohesion: 0.60
Nodes (3): CommandApprovalCard(), Props, readString()

### Community 102 - "use-worktree-chat-summary.test.tsx"
Cohesion: 0.50
Nodes (3): createSession(), createSnapshot(), repository

### Community 104 - "Integrated Workspace Tools"
Cohesion: 0.50
Nodes (4): Integrated Workspace Tools, Workspace Side Panel Plan, Primary Checkout Coding-Agent Sessions Plan, Primary Checkout Workspace

### Community 105 - "Agent-Neutral Composer Commands"
Cohesion: 0.50
Nodes (4): Agent-Neutral Composer Commands, Codex Slash Commands and File Mentions Plan, Dual-Chat Panel Transition Plan, Synchronized Dual-Chat Transition

### Community 109 - "Workspace Side Panel"
Cohesion: 0.67
Nodes (3): Workspace Side Panel, Codex Slash Commands and File Mentions, Primary Checkout Coding-Agent Sessions

### Community 111 - "Cross-worktree Intelligence"
Cohesion: 0.67
Nodes (3): Cross-Worktree Intelligence Delivery, Agentic Worktrees, Cross-worktree Intelligence

## Knowledge Gaps
- **608 isolated node(s):** `browser`, `es6`, `node`, `eslint:recommended`, `plugin:@typescript-eslint/eslint-recommended` (+603 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **74 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `CapabilityError` connect `CapabilityError` to `OpenCodeAdapter`, `capability-host-manager.ts`, `capability-sdk/src/index.ts`, `capability-credential-store.ts`, `exa-client.ts`, `CapabilityService`, `CapabilityRepository`, `capability-service.ts`, `opencode-adapter.ts`?**
  _High betweenness centrality (0.040) - this node is a cross-community bridge._
- **Why does `cn()` connect `cn()` to `IntelligenceOverlapDto`, `AppShell.tsx`, `Dashboard.tsx`, `WorkspacePanel.tsx`, `button.tsx`, `SessionThought.tsx`, `intelligence-components.test.tsx`, `ToolCallGroup.tsx`, `Intelligence.tsx`, `PickerMenu.tsx`, `utils.ts`?**
  _High betweenness centrality (0.025) - this node is a cross-community bridge._
- **Why does `CodexAppServerClient` connect `CodexAppServerClient` to `codex-adapter.ts`?**
  _High betweenness centrality (0.018) - this node is a cross-community bridge._
- **Are the 51 inferred relationships involving `registerIpcHandlers()` (e.g. with `handleCapabilityActivate()` and `handleCapabilityConfigure()`) actually correct?**
  _`registerIpcHandlers()` has 51 INFERRED edges - model-reasoned connections that need verification._
- **What connects `browser`, `es6`, `node` to the rest of the system?**
  _608 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `schemas.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.022727272727272728 - nodes in this community are weakly interconnected._
- **Should `SecondarySessionSelector.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.05583308845136644 - nodes in this community are weakly interconnected._