# Graph Report - agentic-worktrees  (2026-09-02)

## Corpus Check

- 81 files · ~354,333 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary

- 2654 nodes · 5513 edges · 195 communities (115 shown, 80 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 121 edges (avg confidence: 0.84)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)

- IPC Contracts Schemas
- IPC Contracts
- Coding Agents Schemas
- Conflict Intelligence UI
- Renderer UI
- Renderer UI
- IPC Contracts Schemas
- Renderer UI
- Workspace Services
- Renderer UI
- Capability Platform Runtime
- Renderer UI
- Conflict Intelligence Schemas
- Conflict Intelligence Services
- Renderer UI
- Capability Platform Schemas
- Coding Agents Tests
- Renderer UI
- Coding Agents Services
- Coding Agents Services
- Renderer UI
- IPC Contracts Schemas
- Conflict Intelligence Tests
- Coding Agents Services
- Capability Platform Runtime
- Authentication Services
- Capability Platform UI
- Renderer UI
- Capability Platform Security
- Renderer UI Tests
- Conflict Intelligence Runtime
- Capability Platform Services
- Workspace Services
- Renderer UI
- Capability Platform Tests
- Coding Agents Services
- Conflict Intelligence Schemas
- Conflict Intelligence Services
- Capability Platform Runtime
- Renderer UI
- Renderer UI
- Authentication Tests
- Capability Platform Configuration
- URL Fetch Tests
- Capability Platform Schemas
- Coding Agents Schemas
- Editor Integration Services
- Skill Runtime Services
- Renderer UI
- Renderer UI
- Web Search Tests
- Renderer UI
- Build Tooling Configuration
- Capability Platform Services
- Coding Agents Services
- Coding Agents Services
- Coding Agents Schemas
- Conflict Intelligence UI
- Skill Runtime Documentation
- Build Tooling Schemas
- Coding Agents Services
- Conflict Intelligence Services
- Git Worktrees Services
- Authentication Services
- Conflict Intelligence Schemas
- Skill Runtime Schemas
- Capability SDK Schemas
- Database
- Capability Platform Services
- Coding Agents Services
- Git Worktrees Configuration
- Authentication Security
- Renderer UI
- Build Tooling Configuration
- Skill Runtime Tests
- Skill Runtime Services
- Coding Agents Services
- Authentication Services
- Capability Platform Documentation
- Workspace Services
- Conflict Intelligence Services
- Skill Runtime Services
- Skill Runtime Tests
- Conflict Intelligence Services
- Conflict Intelligence Services
- Conflict Intelligence Tests
- Skill Runtime Tests
- Build Tooling Configuration
- Git Worktrees Tests
- IPC Contracts
- Renderer UI
- Capability SDK Configuration
- Git Worktrees Services
- Build Tooling Configuration
- Build Tooling Configuration
- Coding Agents Tests
- Renderer UI
- Renderer UI
- Conflict Intelligence Documentation
- Capability Platform Configuration
- Renderer UI
- Capability Platform Documentation
- Build Tooling Configuration
- Git Worktrees Services
- Project Infrastructure Tests
- Capability Platform Schemas
- Conflict Intelligence Documentation
- Conflict Intelligence UI
- Workspace UI
- Coding Agents UI
- Build Tooling Configuration
- Coding Agents Documentation
- Git Worktrees Documentation
- Build Tooling Configuration
- Database Configuration
- Authentication Configuration
- Build Tooling Configuration
- Git Worktrees
- Project Infrastructure Documentation
- Workspace Documentation
- Project Infrastructure UI
- Build Tooling Configuration
- Database Configuration
- Build Tooling Configuration
- Build Tooling Configuration
- Build Tooling Configuration
- Build Tooling Configuration
- Build Tooling Configuration
- Build Tooling Configuration
- Build Tooling Configuration
- Build Tooling Configuration
- Build Tooling Configuration
- Build Tooling Configuration
- Build Tooling Configuration
- Build Tooling Schemas
- Build Tooling Configuration
- Build Tooling Configuration
- Build Tooling Configuration
- Build Tooling Configuration
- Build Tooling Configuration
- Build Tooling Configuration
- Build Tooling Configuration
- Design System Configuration
- Build Tooling Configuration
- Build Tooling Configuration
- Coding Agents Configuration
- Build Tooling Configuration
- Build Tooling Configuration
- Build Tooling Configuration
- Build Tooling Configuration
- Build Tooling Configuration
- Build Tooling Configuration
- Build Tooling Configuration
- Design System Configuration
- Build Tooling Configuration
- Build Tooling Configuration
- Build Tooling Configuration
- Build Tooling Configuration
- Build Tooling Configuration
- Build Tooling Configuration
- Design System Configuration
- Build Tooling Configuration
- Build Tooling Configuration
- Build Tooling Configuration
- Renderer UI
- Build Tooling Schemas
- Build Tooling Schemas
- Build Tooling Schemas
- Build Tooling Schemas
- Build Tooling Schemas
- Build Tooling Configuration
- Build Tooling Configuration
- Build Tooling Configuration
- Design System Tests
- Capability Platform Runtime
- Git Worktrees Documentation
- Project Infrastructure
- Project Infrastructure
- Project Infrastructure
- Project Infrastructure
- Workspace Documentation
- Renderer UI
- Renderer UI
- Editor Integration
- Renderer UI
- Renderer UI
- Editor Integration
- Editor Integration
- Renderer UI

## God Nodes (most connected - your core abstractions)

1. `cn()` - 70 edges
2. `registerIpcHandlers()` - 60 edges
3. `Api` - 46 edges
4. `Button()` - 36 edges
5. `CodexAdapter` - 35 edges
6. `OpenCodeAdapter` - 29 edges
7. `CodexAppServerClient` - 27 edges
8. `CodingAgentAdapter` - 27 edges
9. `CapabilityError` - 25 edges
10. `Repository` - 23 edges

## Surprising Connections (you probably didn't know these)

- `Agentic Worktrees Logo` --semantically_similar_to--> `Agentic Worktrees Logo`  [INFERRED] [semantically similar]
  docs/assets/agentic-worktrees-logo.png → src/renderer/assets/agentic-worktrees-logo.png
- `IPC Security Boundary` --semantically_similar_to--> `Managed Skill Storage`  [INFERRED] [semantically similar]
  AGENTS.md → docs/capabilities/2026-09-01-skills-runtime-design.md
- `decodeExaTransportPayload()` --calls--> `CapabilityError`  [EXTRACTED]
  capabilities/web-search/src/exa-client.ts → packages/capability-sdk/src/errors.ts
- `normalizeFailure()` --calls--> `CapabilityError`  [EXTRACTED]
  capabilities/web-search/src/exa-client.ts → packages/capability-sdk/src/errors.ts
- `parseJsonOrSse()` --calls--> `CapabilityError`  [EXTRACTED]
  capabilities/web-search/src/exa-client.ts → packages/capability-sdk/src/errors.ts

## Import Cycles

- None detected.

## Hyperedges (group relationships)

- **Capability Activation Runtime** — docs_capabilities_2026_08_27_capability_sdk_web_search_design_capabilitymanager, docs_capabilities_2026_08_27_capability_sdk_web_search_design_capabilityhost, docs_capabilities_2026_08_27_capability_sdk_web_search_design_activationadapters [EXTRACTED 1.00]
- **Cross Worktree Conflict Workflow** — docs_superpowers_specs_2026_08_09_cross_worktree_intelligence_design_cross_worktree_intelligence, docs_superpowers_specs_2026_08_09_conflict_confirmation_preparation_design_conflict_confirmation_preparation, docs_superpowers_specs_2026_08_25_ai_conflict_resolution_design_supervised_ai_conflict_resolution [EXTRACTED 1.00]
- **Human-Controlled Conflict Resolution** — docs_conflict_panel_cross_worktree_conflicts_product_ideas_conflictroom, docs_conflict_panel_cross_worktree_conflicts_product_ideas_conflictbrief, docs_conflict_panel_cross_worktree_conflicts_product_ideas_conflictroommvp [EXTRACTED 1.00]
- **Coding-Agent Workspace Experience** — docs_superpowers_plans_2026_07_28_workspace_side_panel_integrated_workspace_tools, docs_superpowers_plans_2026_08_06_codex_slash_commands_file_mentions_agent_neutral_composer_commands, docs_superpowers_plans_2026_08_07_dual_chat_panel_transition_synchronized_dual_chat_transition, docs_superpowers_plans_2026_08_22_primary_checkout_coding_agent_primary_checkout_workspace [INFERRED 0.75]
- **Conflict Intelligence Workflow** — docs_superpowers_plans_2026_08_09_cross_worktree_intelligence_deterministic_overlap_intelligence, docs_superpowers_plans_2026_08_09_cross_worktree_conflicts_ui_three_column_conflict_workspace, docs_superpowers_plans_2026_08_09_conflict_confirmation_preparation_git_conflict_confirmation, docs_superpowers_plans_2026_08_09_clickable_conflict_chat_cards_worktree_card_chat_navigation [INFERRED 0.85]
- **Capability SDK Delivery Flow** — docs_capabilities_2026_08_27_capability_sdk_web_search_design_capabilitysdk, docs_capabilities_2026_08_27_capability_sdk_web_search_implementation_plan_implementationplan [INFERRED 0.95]
- **Portable Agent Skills Flow** — docs_capabilities_2026_09_01_skills_runtime_design_agent_skills_runtime, docs_capabilities_authoring_skills_agent_skill_authoring, scripts_skill_smoke_fixtures_deterministic_review_skill_deterministic_review, skills_ui_check_skill_ui_check [INFERRED 0.85]
- **Secure Capability Delivery** — docs_capabilities_authoring_capabilities_bundled_capability_authoring, docs_superpowers_plans_2026_08_31_capability_starter_kit_url_fetch_ssrf_safe_url_fetch, docs_superpowers_specs_2026_08_31_capability_starter_kit_url_fetch_design_public_web_permission, docs_superpowers_specs_2026_08_31_capability_starter_kit_url_fetch_design_dns_pinning [INFERRED 0.95]
- **Electron Trust Boundaries** — agents_electron_application_architecture, agents_ipc_security_boundary, docs_capabilities_2026_09_01_skills_runtime_design_managed_skill_storage, docs_capabilities_authoring_capabilities_reviewed_registry_separation [INFERRED 0.85]

## Communities (195 total, 80 thin omitted)

### Community 0 - "IPC Contracts Schemas"

Cohesion: 0.02
Nodes (92): availableEditorSchema, branchSchema, capabilityCompatibilitySchema, capabilityConfigurationKeySchema, capabilityIdSchema, capabilitySecretValueSchema, capabilitySettingDetailSchema, capabilitySettingValueSchema (+84 more)

### Community 1 - "IPC Contracts"

Cohesion: 0.06
Nodes (63): listAgentWorktrees(), subscribeToAgentEvents(), createLocalBranch(), listLocalBranches(), authStatusResponse(), capabilityHandlers(), handleCapabilityActivate(), handleCapabilityConfigure() (+55 more)

### Community 2 - "Coding Agents Schemas"

Cohesion: 0.05
Nodes (54): CodexClient, execFile, PendingApproval, ReadCodexVersion, readVersionFromExecutable(), codexAccountRateLimitsSchema, CodexApprovalRequest, codexCommandApprovalSchema (+46 more)

### Community 3 - "Conflict Intelligence UI"

Cohesion: 0.08
Nodes (32): overlap, ConflictDisplayKind, conflictFileCount(), ConflictPresentation, predictedReasons, riskRank, selectConflicts(), worktreeFor() (+24 more)

### Community 4 - "Renderer UI"

Cohesion: 0.07
Nodes (28): activeStates, CapabilityPicker(), groupFor(), label(), detail, PickerMenu(), PickerOption, Props (+20 more)

### Community 5 - "Renderer UI"

Cohesion: 0.07
Nodes (32): CommitDialog(), DirectoryState, errorMessage(), FileBrowserPanel(), initialDirectoryState, FilePreview(), FilePreviewProps, formatBytes() (+24 more)

### Community 6 - "IPC Contracts Schemas"

Cohesion: 0.05
Nodes (41): createCapabilityHandlers(), api, capabilityActivateRequestSchema, capabilityChangedEventSchema, capabilityConfigureRequestSchema, capabilityDeactivateRequestSchema, capabilityDetailSchema, capabilityGetRequestSchema (+33 more)

### Community 7 - "Renderer UI"

Cohesion: 0.08
Nodes (34): Skeleton(), chatSummary, repository, worktree, BranchChatStatus, BranchRow(), getChatStatusPresentation(), RepositoryBranchListState (+26 more)

### Community 8 - "Workspace Services"

Cohesion: 0.06
Nodes (21): createWorkspaceFileService(), execFileAsync, listGitVisibleFiles(), ListWorkspaceFiles, WorkspaceFileServiceDependencies, isInsideRoot(), normalizeRelativePath(), productionDependencies (+13 more)

### Community 9 - "Renderer UI"

Cohesion: 0.11
Nodes (34): Alert(), AlertAction(), AlertDescription(), AlertTitle(), alertVariants, AlertDialog(), AlertDialogAction(), AlertDialogCancel() (+26 more)

### Community 10 - "Capability Platform Runtime"

Cohesion: 0.10
Nodes (19): adaptElectronUtilityProcess(), CapabilityHostConnection, CapabilityHostManager, CapabilityHostManagerDependencies, CapabilityUtilityProcess, createElectronCapabilityHostManager(), HostRecord, isDeclaredSecret() (+11 more)

### Community 11 - "Renderer UI"

Cohesion: 0.08
Nodes (21): AIMessage(), Props, CommandApprovalCard(), Props, readString(), Props, SessionMessages(), Props (+13 more)

### Community 12 - "Conflict Intelligence Schemas"

Cohesion: 0.05
Nodes (37): CapabilityInstallation, capabilityInstallations, CapabilitySettingRecord, capabilitySettings, CodingAgentInstallation, CodingAgentSession, CodingAgentSessionDiff, ConflictResolutionFile (+29 more)

### Community 13 - "Conflict Intelligence Services"

Cohesion: 0.10
Nodes (24): asChangeType(), asRisk(), asTargetType(), Database, IntelligenceRepository, loadSnapshot(), parseJson(), changedFile() (+16 more)

### Community 14 - "Renderer UI"

Cohesion: 0.15
Nodes (26): Button(), ButtonProps, Size, sizes, Variant, variants, Dialog(), DialogDescription() (+18 more)

### Community 15 - "Capability Platform Schemas"

Cohesion: 0.11
Nodes (15): CapabilityCreateCliIo, runCapabilityCreateCli(), createCapability(), inside(), native, acronyms, deriveCapabilityNames(), createRepositoryRegistrationPatches() (+7 more)

### Community 16 - "Coding Agents Tests"

Cohesion: 0.12
Nodes (11): CodexAppServerClient, CodexRequestId, errorMessage(), isRecord(), isRequestId(), PendingRequest, SpawnCodex, createFakeCodexTransport() (+3 more)

### Community 17 - "Renderer UI"

Cohesion: 0.09
Nodes (27): AttentionPanel(), Props, DiffComparison(), emptySnapshot, fiveWorktreeSnapshot, high, low, mediumPassive (+19 more)

### Community 18 - "Coding Agents Services"

Cohesion: 0.08
Nodes (29): execFile, findCodexInSystem(), getCodexCandidates(), parseCodexVersion(), AgentInstallationStatus, AgentSessionCapabilitySnapshot, AgentSessionSummary, AgentStatus (+21 more)

### Community 19 - "Coding Agents Services"

Cohesion: 0.16
Nodes (30): abortAgentSession(), capabilityProfileId(), CodingAgentCapabilityBridge, compactAgentSession(), configuredCapabilityProfileId(), createAgentSession(), ensureStarted(), findRunIdForExternalSession() (+22 more)

### Community 20 - "Renderer UI"

Cohesion: 0.08
Nodes (10): NewSessionDialog(), contexts, findAll(), installations, Listener, TestDocument, TestElement, TestNode (+2 more)

### Community 21 - "IPC Contracts Schemas"

Cohesion: 0.11
Nodes (28): WorkspaceFileService, Window, Api, AvailableEditorDto, CapabilityActivateRequest, CapabilityDeactivateRequest, CapabilitySessionStateDto, CodingAgentAccountUsageDto (+20 more)

### Community 22 - "Conflict Intelligence Tests"

Cohesion: 0.12
Nodes (26): addedFilePatch(), collectEntries(), collectTrackedFile(), collectUntrackedFile(), completeFileChange(), countLines(), createFingerprint(), createGitChangeCollector() (+18 more)

### Community 23 - "Coding Agents Services"

Cohesion: 0.12
Nodes (9): approvalDecision(), capabilityConfig(), CodexAdapter, errorMessage(), hasExpectedCapabilityServer(), threadStatus(), CodingAgentCapabilityConnection, CodingAgentSessionOptions (+1 more)

### Community 24 - "Capability Platform Runtime"

Cohesion: 0.12
Nodes (19): CapabilityError, CapabilityDefinition, CapabilityTool, ActiveTool, authorized(), body(), CapabilityHostServer, CapabilityHostServerOptions (+11 more)

### Community 25 - "Authentication Services"

Cohesion: 0.12
Nodes (24): ClassifiedAuthError, classifyAuthError(), createCredentials(), createGitHubAuthService(), DeviceAuthorization, DeviceCodeResponse, formRequest(), getAuthenticatedOctokit() (+16 more)

### Community 26 - "Capability Platform UI"

Cohesion: 0.11
Nodes (19): CapabilityDetail(), format(), stateTone, CapabilitySetupDialog(), urlFetch, webSearch, useCapabilities(), capabilityConfigureRequest() (+11 more)

### Community 27 - "Renderer UI"

Cohesion: 0.16
Nodes (17): GridIcon(), GridIconName, getSessionStatus(), Props, SecondarySessionSelector(), SessionStatus, Props, SessionCard() (+9 more)

### Community 28 - "Capability Platform Security"

Cohesion: 0.15
Nodes (9): CapabilityCredentialPayload, CapabilityCredentialStore, CapabilityCredentialStoreDependencies, createElectronCapabilityCredentialStore(), emptyPayload(), isPayload(), missing(), redact() (+1 more)

### Community 29 - "Renderer UI Tests"

Cohesion: 0.12
Nodes (14): Props, SessionChangesSummary(), diff, getAgentDisplay(), readPermission(), readToolActivity(), ChangesSummarySnapshot, ChangesSummaryUpdate (+6 more)

### Community 30 - "Conflict Intelligence Runtime"

Cohesion: 0.10
Nodes (17): containsUnsafeRefCharacter(), createGitProcess(), GitCommandError, GitProcess, GitRunner, GitRunnerOptions, GitRunOptions, GitRunResult (+9 more)

### Community 31 - "Capability Platform Services"

Cohesion: 0.13
Nodes (11): allowedTransitions, CapabilityInstallationRecord, CapabilityRepository, CapabilitySettingValue, installationFromRow(), InstallationRow, parseStoredSetting(), PersistedCapabilityStatus (+3 more)

### Community 32 - "Workspace Services"

Cohesion: 0.14
Nodes (11): isLocalRepository(), createWorkspaceGitService(), GitRemote, GitStatusSnapshot, parseCount(), PullRequestClient, WorkspaceGitClient, WorkspaceGitContext (+3 more)

### Community 33 - "Renderer UI"

Cohesion: 0.17
Nodes (15): CodingAgentLayoutControls(), CodingAgentLayoutMode, Props, DUAL_CHAT_TRANSITION_DURATION_MS, useDualChatTransition(), clampPrimaryPanelWidth(), DUAL_CHAT_DIVIDER_WIDTH, DUAL_CHAT_MIN_PANEL_WIDTH (+7 more)

### Community 34 - "Capability Platform Tests"

Cohesion: 0.13
Nodes (16): createElectronCapabilitySmokeDriver(), smokeSessionIsIdle(), atLeast(), messageText(), minimums, runCapabilitySmokes(), snapshotMessages(), toolCalls() (+8 more)

### Community 36 - "Conflict Intelligence Schemas"

Cohesion: 0.15
Nodes (17): assertResolutionTransition(), classifyConfirmedConflict(), reviewReasonCodes, transitions, IntegrationPreparationInput, IntegrationPreparationResult, mergeFiles(), riskRank (+9 more)

### Community 37 - "Conflict Intelligence Services"

Cohesion: 0.13
Nodes (21): GitChangeCollector, ACTIVE_STATUSES, collectOne(), collectRepositoryChanges(), createIntelligenceService(), diffFiles(), enrichSymbols(), IntelligenceServiceDependencies (+13 more)

### Community 38 - "Capability Platform Runtime"

Cohesion: 0.14
Nodes (13): extractReadableResource(), normalize(), ReadableResource, capability, createUrlFetchCapability(), context, urlFetchManifest, createUrlTransport() (+5 more)

### Community 39 - "Renderer UI"

Cohesion: 0.15
Nodes (14): App(), Integration, AuthBootstrap(), AuthGate(), AuthGateContent(), GitHubLogin(), useRemainingSeconds(), useGitHubAuth() (+6 more)

### Community 40 - "Renderer UI"

Cohesion: 0.17
Nodes (14): clampDashboardSidebarWidth(), DASHBOARD_SIDEBAR_DEFAULT_WIDTH, DASHBOARD_SIDEBAR_EXPANDED_MIN_WIDTH, DASHBOARD_SIDEBAR_MAX_WIDTH, DASHBOARD_SIDEBAR_MIN_WIDTH, isDashboardSidebarCollapsed(), isDashboardWorkspace(), AppShell() (+6 more)

### Community 41 - "Authentication Tests"

Cohesion: 0.20
Nodes (18): AuthAction, AuthActionErrorKind, authReducer(), AuthState, AuthView, createInitialAuthState(), emptyStatus(), getAuthView() (+10 more)

### Community 42 - "Capability Platform Configuration"

Cohesion: 0.10
Nodes (19): @agentic-worktrees/capability-sdk, dependencies, @agentic-worktrees/capability-sdk, htmlparser2, ipaddr.js, exports, name, private (+11 more)

### Community 43 - "URL Fetch Tests"

Cohesion: 0.15
Nodes (12): createPinnedLookup(), RawHttpResponse, RequestOnce, requestResolvedTarget(), UrlTransport, assertPublicAddress(), denied(), parsePublicWebUrl() (+4 more)

### Community 44 - "Capability Platform Schemas"

Cohesion: 0.14
Nodes (13): WebSearchInput, WebSearchOutput, WebSearchResult, createWebSearchCapability(), webSearchInputSchema, webSearchManifest, CapabilityErrorCode, defineCapability() (+5 more)

### Community 45 - "Coding Agents Schemas"

Cohesion: 0.10
Nodes (13): AgentSessionSnapshot, CodingAgentAccountUsage, CodingAgentAccountUsageWindow, CodingAgentDiff, CodingAgentMessage, CodingAgentModel, CodingAgentPermission, CodingAgentRunStatus (+5 more)

### Community 46 - "Editor Integration Services"

Cohesion: 0.11
Nodes (15): AvailableEditor, commandExists(), createEditorService(), EDITOR_CATALOG, EDITOR_COMMANDS, EditorCommand, EditorId, EditorService (+7 more)

### Community 47 - "Skill Runtime Services"

Cohesion: 0.13
Nodes (10): installation(), InstallationInput, invocation(), Row, SkillCompatibility, SkillInstallationRecord, SkillInstallationState, SkillInvocationRecord (+2 more)

### Community 48 - "Renderer UI"

Cohesion: 0.12
Nodes (15): DropdownMenu(), DropdownMenuItem, DropdownMenuProps, ActiveCapabilities(), ActiveCapability, snapshot, useCodingAgentSession(), getLinkedDiffFile() (+7 more)

### Community 49 - "Renderer UI"

Cohesion: 0.16
Nodes (15): buildProjectGroups(), CodingAgentProjectSidebar(), ProjectGroup, ProjectSession, Props, sessionStatus(), never, session (+7 more)

### Community 50 - "Web Search Tests"

Cohesion: 0.18
Nodes (16): basicFallbackInput(), buildAdvancedArguments(), decodeExaTransportPayload(), directSearch(), ExaTransportPayload, hostedSearch(), isExaTransportPayload(), normalizeFailure() (+8 more)

### Community 51 - "Renderer UI"

Cohesion: 0.10
Nodes (19): aliases, components, hooks, lib, ui, utils, iconLibrary, registries (+11 more)

### Community 52 - "Build Tooling Configuration"

Cohesion: 0.10
Nodes (20): scripts, build:capability-host, capability:create, db:generate, db:migrate, lint, make, package (+12 more)

### Community 53 - "Capability Platform Services"

Cohesion: 0.20
Nodes (14): isVersionAtLeast(), MINIMUM_AGENT_VERSIONS, recordState(), bundledCapabilities, BundledCapability, bundledCapabilityEntries, createBundledCapability(), deepFreeze() (+6 more)

### Community 54 - "Coding Agents Services"

Cohesion: 0.13
Nodes (7): createAdapter(), emitTokenUsage(), FakeCodexClient, RecordedRequest, RecordedResponse, threadResponse(), CodexIncomingMessage

### Community 55 - "Coding Agents Services"

Cohesion: 0.17
Nodes (17): normalizeDiff(), NormalizedOpenCodePayload, normalizeOpenCodePayload(), normalizePermissionRequest(), OpenCodeDiffPayload, OpenCodePermissionReplyProtocol, readPatchContent(), readReasoningVariants() (+9 more)

### Community 57 - "Conflict Intelligence UI"

Cohesion: 0.12
Nodes (7): IntelligenceService, errorMessage(), repository, useIntelligence(), mocks, repository, IntelligenceSnapshotDto

### Community 58 - "Skill Runtime Documentation"

Cohesion: 0.11
Nodes (19): Electron Application Architecture, IPC Security Boundary, Agent Skills Runtime, Managed Skill Storage, Progressive Skill Disclosure, Provider-Native Skill Integration, Skill and Capability Separation, Structured Skill Invocation (+11 more)

### Community 59 - "Build Tooling Schemas"

Cohesion: 0.11
Nodes (18): env, browser, es6, node, extends, typescript, parser, rules (+10 more)

### Community 60 - "Coding Agents Services"

Cohesion: 0.19
Nodes (16): applyCodingAgentCapabilities(), autoDiscoverAgent(), configureAgent(), configureCodingAgentCapabilityBridge(), configureCodingAgentSkillCatalog(), configureCodingAgentSkillInvocationSource(), getAgentInstallationStatus(), getCodingAgentCapabilitySession() (+8 more)

### Community 61 - "Conflict Intelligence Services"

Cohesion: 0.13
Nodes (9): ConflictIntelligenceServiceDependencies, ConflictSessionChangedEvent, createConflictIntelligenceService(), RepositorySource, terminalStates, overlapDetails, WorktreeSource, IntegrationWorktreeService (+1 more)

### Community 62 - "Git Worktrees Services"

Cohesion: 0.22
Nodes (15): conflictIntelligenceService, git, integrationRoot, getDatabase(), createIntelligenceRepository(), getRepositoryById(), listRepositories(), setRepositoryCloneStatus() (+7 more)

### Community 63 - "Authentication Services"

Cohesion: 0.13
Nodes (9): cancelGitHubLogin(), completeGitHubLogin(), CompletionState, getAuthStatus(), GitHubAuthService, logoutFromGitHub(), refreshGitHubInstallations(), startGitHubLogin() (+1 more)

### Community 64 - "Conflict Intelligence Schemas"

Cohesion: 0.20
Nodes (18): bestTarget(), classifyWorktreeOverlaps(), commonFolder(), compareFilePair(), compareWorktreePair(), countModuleWorktrees(), overlappingRangeTarget(), overlapSummary() (+10 more)

### Community 65 - "Skill Runtime Schemas"

Cohesion: 0.15
Nodes (14): SkillHandlerDependencies, detail, skillGetRequestSchema, skillInstallRequestSchema, skillRemoveRequestSchema, CodingAgentTurnRequest, codingAgentTurnRequestSchema, skillCompatibilitySchema (+6 more)

### Community 66 - "Capability SDK Schemas"

Cohesion: 0.14
Nodes (11): boundedDetails(), CAPABILITY_OUTPUT_MAX_BYTES, CAPABILITY_OUTPUT_MAX_LINES, limitCapabilityOutput(), truncateText(), CapabilityAgentKind, CapabilityCompatibility, CapabilityExecutionContext (+3 more)

### Community 67 - "Database"

Cohesion: 0.18
Nodes (10): createConflictResolutionRepository(), session(), bootstrapSchemaSql, bootstrapStatements, getDatabasePath(), getSqlite(), applyDatabaseUpgrades(), initDatabase() (+2 more)

### Community 68 - "Capability Platform Services"

Cohesion: 0.22
Nodes (5): CapabilityService, CapabilityServiceDependencies, sessionDto(), getBundledCapability(), CapabilityChangedEventDto

### Community 69 - "Coding Agents Services"

Cohesion: 0.11
Nodes (12): AgentUiEvent, listAgentSessions(), markAgentSessionViewed(), AppDatabase, EventListener, mocks, intelligenceService, codingAgentInstallations (+4 more)

### Community 70 - "Git Worktrees Configuration"

Cohesion: 0.22
Nodes (15): EnvConfig, getEnvConfig(), requireEnv(), resolveUserPath(), { getGitHubAccessToken, simpleGit }, repository, createAuthenticatedGitClient(), CreatedWorktree (+7 more)

### Community 71 - "Authentication Security"

Cohesion: 0.14
Nodes (12): getDefaultService(), createElectronGitHubCredentialStore(), createGitHubCredentialStore(), DecryptionResult, GitHubCredentialPayload, GitHubCredentialStoreDependencies, isMissingFileError(), StorageBackend (+4 more)

### Community 72 - "Renderer UI"

Cohesion: 0.16
Nodes (12): ActionProbe(), capability, Probe(), skill, useMarketplace(), SkillDetail(), Marketplace(), capability (+4 more)

### Community 73 - "Build Tooling Configuration"

Cohesion: 0.11
Nodes (18): compilerOptions, allowJs, allowSyntheticDefaultImports, baseUrl, esModuleInterop, forceConsistentCasingInFileNames, jsx, module (+10 more)

### Community 74 - "Skill Runtime Tests"

Cohesion: 0.20
Nodes (10): contained(), createSkillStorageLayout(), InstalledSkillPaths, openCodeProjection(), removeInstalledSkill(), safeVersion(), SkillInstallTransaction, stageSkillInstallation() (+2 more)

### Community 75 - "Skill Runtime Services"

Cohesion: 0.19
Nodes (5): instructionBody(), persisted(), SkillError, SkillService, summary()

### Community 76 - "Coding Agents Services"

Cohesion: 0.16
Nodes (8): toOpenCodeRunStatus(), COMMON_PATHS, execFileAsync, findOpenCodeInSystem(), parseOpenCodeVersion(), readOpenCodeSessionId(), reserveLocalPort(), CodingAgentEvent

### Community 77 - "Authentication Services"

Cohesion: 0.13
Nodes (8): GitHubAuthServiceDependencies, config, credentials, deferredJsonResponse(), deviceChallenge, jsonResponse(), successfulToken, GitHubCredentialStore

### Community 78 - "Capability Platform Documentation"

Cohesion: 0.14
Nodes (15): Provider Activation Adapters, Capability Host, Capability Manager, Capability SDK v0.1, Capability Credential Vault, Keyless Web Search Pilot, Capability Workspace Packages, Capability SDK Implementation Plan (+7 more)

### Community 79 - "Workspace Services"

Cohesion: 0.25
Nodes (12): AgentWorktreeContext, getPrimaryWorkspaceId(), inspectPrimaryWorkspace(), persistPrimaryWorkspace(), PrimaryWorkspaceMetadata, Repository, revalidatePrimaryWorkspace(), synchronizePrimaryWorkspaces() (+4 more)

### Community 80 - "Conflict Intelligence Services"

Cohesion: 0.13
Nodes (7): IntegrationGitAdapter, IntegrationParticipantInput, ConflictParticipantSide, GitConflictFile, MergeSimulationResult, AnalyzeChangedSymbolsInput, ChangedRange

### Community 81 - "Skill Runtime Services"

Cohesion: 0.18
Nodes (8): SkillStorageLayout, MAX_SKILL_INSTRUCTION_PREVIEW_LENGTH, ResolvedSkill, SkillChangedEvent, SkillErrorCode, SkillRuntimeBridge, SkillServiceDependencies, SkillInvocationRequest

### Community 82 - "Skill Runtime Tests"

Cohesion: 0.20
Nodes (12): allowedExtensions, frontmatter(), invalid(), MAX_SKILL_DEPTH, MAX_SKILL_DESCRIPTION_LENGTH, MAX_SKILL_FILE_BYTES, MAX_SKILL_FILES, MAX_SKILL_PACKAGE_BYTES (+4 more)

### Community 83 - "Conflict Intelligence Services"

Cohesion: 0.21
Nodes (3): ConflictIntelligenceService, ConflictResolutionRepository, PreparedConflictSession

### Community 84 - "Conflict Intelligence Services"

Cohesion: 0.22
Nodes (11): activeStates, classification(), Database, fileKind(), loadSession(), operationStatus(), parseJson(), risk() (+3 more)

### Community 85 - "Conflict Intelligence Tests"

Cohesion: 0.26
Nodes (11): analyzeChangedSymbols(), candidateKind(), changedSpan(), collectCandidates(), declarationName(), executableInitializer(), identifierName(), intersects() (+3 more)

### Community 86 - "Skill Runtime Tests"

Cohesion: 0.26
Nodes (9): fixture, minimumVersions, runPackagedSkillScenarios(), mocks, versionAtLeast(), versionParts(), parseArguments(), redact() (+1 more)

### Community 87 - "Build Tooling Configuration"

Cohesion: 0.17
Nodes (11): author, email, name, description, keywords, license, main, name (+3 more)

### Community 88 - "Git Worktrees Tests"

Cohesion: 0.24
Nodes (8): listBranches(), RemoteBranch, getAuthenticatedOctokit(), InstallationRepo, InstallationRepositoriesResponse, listRemoteRepositories(), { getAuthenticatedOctokit }, UserInstallationsResponse

### Community 89 - "IPC Contracts"

Cohesion: 0.22
Nodes (6): authChannels, IpcHandler, mocks, mocks, IPC_CHANNELS, IpcChannel

### Community 90 - "Renderer UI"

Cohesion: 0.25
Nodes (8): createSession(), InteractiveComposer(), renderComposer(), Subject(), costFormat, Props, SessionStatusPopup(), tokenFormat

### Community 91 - "Capability SDK Configuration"

Cohesion: 0.20
Nodes (9): dependencies, ajv, exports, files, ajv, src, name, type (+1 more)

### Community 92 - "Git Worktrees Services"

Cohesion: 0.33
Nodes (8): assertGitMetadataExists(), detectDefaultBranch(), importLocalRepository(), getLocalRepositoryFullName(), getStableLocalGithubRepoId(), LocalCloneStatus, upsertLocalRepository(), upsertRepositoriesFromRemote()

### Community 93 - "Build Tooling Configuration"

Cohesion: 0.22
Nodes (9): ajv, electron-squirrel-startup, @modelcontextprotocol/sdk, dependencies, ajv, electron-squirrel-startup, @modelcontextprotocol/sdk, shadcn (+1 more)

### Community 94 - "Build Tooling Configuration"

Cohesion: 0.22
Nodes (9): drizzle-kit, @electron-forge/plugin-vite, devDependencies, drizzle-kit, @electron-forge/plugin-vite, @types/better-sqlite3, @types/react-dom, @types/better-sqlite3 (+1 more)

### Community 96 - "Renderer UI"

Cohesion: 0.31
Nodes (7): AccountUsagePopup(), costFormat, formatReset(), formatWindow(), Props, session, tokenFormat

### Community 97 - "Renderer UI"

Cohesion: 0.31
Nodes (6): RepositoryWorkspaceProps, createSession(), createSnapshot(), repository, WorktreeChatSummaryState, Worktree

### Community 98 - "Conflict Intelligence Documentation"

Cohesion: 0.25
Nodes (8): Clickable Conflict Chat Cards Plan, Worktree Card Chat Navigation, Conflict Confirmation and Integration Preparation Plan, Git Conflict Confirmation, Cross-Worktree Conflicts UI Plan, Three-Column Conflict Workspace, Cross-Worktree Intelligence Plan, Deterministic Overlap Intelligence

### Community 99 - "Capability Platform Configuration"

Cohesion: 0.36
Nodes (6): invalid(), prepareCapabilityConfiguration(), PreparedCapabilityConfiguration, PreparedSecretChange, emptyManifest, CapabilitySettingRecord

### Community 100 - "Renderer UI"

Cohesion: 0.39
Nodes (5): DiffPreview(), Props, createDiffLines(), splitDiffLines(), DiffLine

### Community 101 - "Capability Platform Documentation"

Cohesion: 0.29
Nodes (7): Bundled Capability Authoring, Capability Starter Kit and URL Fetch Implementation Plan, Local Capability Generator, SSRF-Safe URL Fetch, Capability Starter Kit and URL Fetch Design, DNS Pinning and Redirect Revalidation, Public-Web Permission

### Community 102 - "Build Tooling Configuration"

Cohesion: 0.33
Nodes (6): workspaces, capabilities/*, packages/*, scripts, include, src

### Community 103 - "Git Worktrees Services"

Cohesion: 0.33
Nodes (4): SyntheticSnapshotResult, createIntegrationWorktreeService(), adapter(), snapshot()

### Community 104 - "Project Infrastructure Tests"

Cohesion: 0.29
Nodes (3): AppListener, BrowserWindow, mocks

### Community 106 - "Conflict Intelligence Documentation"

Cohesion: 0.50
Nodes (5): Clickable Conflict Chat Cards, Conflict Confirmation and Integration Preparation, Cross-Worktree Conflicts UI, Cross-Worktree Intelligence, Supervised AI Conflict Resolution

### Community 107 - "Conflict Intelligence UI"

Cohesion: 0.50
Nodes (4): Conflict Brief, Conflict Room, Guided Conflict Room MVP, Integration Agent

### Community 108 - "Workspace UI"

Cohesion: 0.50
Nodes (4): Integrated Workspace Tools, Workspace Side Panel Plan, Primary Checkout Coding-Agent Sessions Plan, Primary Checkout Workspace

### Community 109 - "Coding Agents UI"

Cohesion: 0.50
Nodes (4): Agent-Neutral Composer Commands, Codex Slash Commands and File Mentions Plan, Dual-Chat Panel Transition Plan, Synchronized Dual-Chat Transition

### Community 110 - "Build Tooling Configuration"

Cohesion: 0.50
Nodes (4): DOM, DOM.Iterable, ESNext, lib

### Community 111 - "Coding Agents Documentation"

Cohesion: 0.67
Nodes (3): Workspace Side Panel, Codex Slash Commands and File Mentions, Primary Checkout Coding-Agent Sessions

### Community 112 - "Git Worktrees Documentation"

Cohesion: 0.67
Nodes (3): Cross-Worktree Intelligence Delivery, Agentic Worktrees, Cross-worktree Intelligence

## Knowledge Gaps

- **688 isolated node(s):** `RemoteBranch`, `CapabilityHostConnection`, `Props`, `FileMentionSuggestionState`, `SlashCommand` (+683 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **80 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions

_Questions this graph is uniquely positioned to answer:*

- **Why does `CodexAppServerClient` connect `Coding Agents Tests` to `Coding Agents Schemas`?**
  *High betweenness centrality (0.033) - this node is a cross-community bridge.*
- **Why does `cn()` connect `Renderer UI` to `Conflict Intelligence UI`, `Renderer UI`, `Renderer UI`, `Renderer UI`, `Renderer UI`, `Renderer UI`, `Renderer UI`, `Renderer UI`, `Renderer UI`?**
  *High betweenness centrality (0.021) - this node is a cross-community bridge.*
- **Why does `SkillRepository` connect `Skill Runtime Services` to `Skill Runtime Services`, `Skill Runtime Services`, `Database`, `Coding Agents Services`?**
  *High betweenness centrality (0.013) - this node is a cross-community bridge.*
- **Are the 51 inferred relationships involving `registerIpcHandlers()` (e.g. with `handleCapabilityActivate()` and `handleCapabilityConfigure()`) actually correct?**
  *`registerIpcHandlers()` has 51 INFERRED edges - model-reasoned connections that need verification.*
- **What connects `RemoteBranch`, `CapabilityHostConnection`, `Props` to the rest of the system?**
  *688 weakly-connected nodes found - possible documentation gaps or missing edges.*
- **Should `IPC Contracts Schemas` be split into smaller, more focused modules?**
  *Cohesion score 0.021505376344086023 - nodes in this community are weakly interconnected.*
- **Should `IPC Contracts` be split into smaller, more focused modules?**
  *Cohesion score 0.06394230769230769 - nodes in this community are weakly interconnected.*
