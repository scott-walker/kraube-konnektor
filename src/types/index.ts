export type {
  ClientOptions,
  QueryOptions,
  PermissionMode,
  EffortLevel,
  McpServerConfig,
  McpSdkServerConfig,
  AgentConfig,
  HookEntry,
  HookMatcher,
  HooksConfig,
  // New SDK-level types
  CanUseTool,
  PermissionResult,
  PermissionUpdate,
  PermissionBehavior,
  PermissionRuleValue,
  PermissionUpdateDestination,
  ThinkingConfig,
  ThinkingAdaptive,
  ThinkingEnabled,
  ThinkingDisabled,
  HookEvent,
  HookCallback,
  HookCallbackMatcher,
  HookInput,
  HookJSONOutput,
  SyncHookJSONOutput,
  AsyncHookJSONOutput,
  OnElicitation,
  ElicitationRequest,
  SettingSource,
  PluginConfig,
  SpawnOptions,
  SpawnedProcess,
} from './client.js';

export type {
  QueryResult,
  StreamEvent,
  StreamTextEvent,
  StreamToolUseEvent,
  StreamResultEvent,
  StreamErrorEvent,
  StreamSystemEvent,
  // New task events
  StreamTaskStartedEvent,
  StreamTaskProgressEvent,
  StreamTaskNotificationEvent,
  StreamRateLimitEvent,
  // Tool progress & summary
  StreamToolProgressEvent,
  StreamToolUseSummaryEvent,
  // Auth status
  StreamAuthStatusEvent,
  // Hook lifecycle
  StreamHookStartedEvent,
  StreamHookProgressEvent,
  StreamHookResponseEvent,
  // File persistence
  StreamFilesPersistedEvent,
  // Context compaction
  StreamCompactBoundaryEvent,
  // Local command output
  StreamLocalCommandOutputEvent,
  // Info types
  AccountInfo,
  ModelInfo,
  SlashCommand,
  AgentInfo,
  McpServerStatus,
  McpSetServersResult,
  RewindFilesResult,
  TokenUsage,
  Message,
  ContentBlock,
  TextBlock,
  ToolUseBlock,
  ToolResultBlock,
} from './result.js';

export type {
  SessionOptions,
  SessionInfo,
} from './session.js';
