# Types

All TypeScript interfaces and type aliases exported by the package.

```typescript
import type {
  ClientOptions,
  QueryOptions,
  QueryResult,
  StreamEvent,
  TokenUsage,
  Message,
  PermissionMode,
  EffortLevel,
  // Permission types
  CanUseTool,
  PermissionResult,
  PermissionUpdate,
  PermissionBehavior,
  PermissionRuleValue,
  PermissionUpdateDestination,
  // Thinking types
  ThinkingConfig,
  ThinkingAdaptive,
  ThinkingEnabled,
  ThinkingDisabled,
  // Hook types
  HookEvent,
  HookCallback,
  HookCallbackMatcher,
  HookInput,
  HookJSONOutput,
  // MCP types
  McpServerConfig,
  McpSdkServerConfig,
  // Config types
  SettingSource,
  PluginConfig,
  SpawnOptions,
  SpawnedProcess,
  OnElicitation,
  ElicitationRequest,
  // Info / result types
  AccountInfo,
  ModelInfo,
  SlashCommand,
  AgentInfo,
  McpServerStatus,
  McpSetServersResult,
  RewindFilesResult,
} from '@scottwalker/claude-connector'
```

## ClientOptions

Configuration for the Claude client instance. Options set here act as defaults for all queries.

```typescript
interface ClientOptions {
  useSdk?: boolean
  executable?: string
  cwd?: string
  model?: string
  effortLevel?: EffortLevel
  fallbackModel?: string
  permissionMode?: PermissionMode
  allowedTools?: readonly string[]
  disallowedTools?: readonly string[]
  tools?: readonly string[]
  systemPrompt?: string
  appendSystemPrompt?: string
  maxTurns?: number
  maxBudget?: number
  additionalDirs?: readonly string[]
  mcpConfig?: string | readonly string[]
  mcpServers?: Record<string, McpServerConfig | McpSdkServerConfig>
  agents?: Record<string, AgentConfig>
  agent?: string
  hooks?: HooksConfig
  hookCallbacks?: Partial<Record<HookEvent, readonly HookCallbackMatcher[]>>
  canUseTool?: CanUseTool
  thinking?: ThinkingConfig
  enableFileCheckpointing?: boolean
  onElicitation?: OnElicitation
  env?: Record<string, string>
  noSessionPersistence?: boolean
  name?: string
  strictMcpConfig?: boolean
  settingSources?: readonly SettingSource[]
  settings?: string | Record<string, unknown>
  plugins?: readonly PluginConfig[]
  spawnClaudeCodeProcess?: (options: SpawnOptions) => SpawnedProcess
  stderr?: (data: string) => void
  allowDangerouslySkipPermissions?: boolean
  betas?: readonly string[]
  agentProgressSummaries?: boolean
  includePartialMessages?: boolean
  promptSuggestions?: boolean
  debug?: boolean
  debugFile?: string
}
```

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `useSdk` | `boolean` | `true` | Use Agent SDK (persistent session) instead of CLI mode |
| `executable` | `string` | `'claude'` | Path to CLI binary |
| `cwd` | `string` | `process.cwd()` | Working directory |
| `model` | `string` | `'sonnet'` | Model: `'opus'`, `'sonnet'`, `'haiku'`, or full ID |
| `effortLevel` | [`EffortLevel`](#effortlevel) | -- | Thinking depth |
| `fallbackModel` | `string` | -- | Auto-fallback model on failure |
| `permissionMode` | [`PermissionMode`](#permissionmode) | `'default'` | Tool approval behavior |
| `allowedTools` | `string[]` | -- | Auto-approved tools (supports glob patterns) |
| `disallowedTools` | `string[]` | -- | Always-denied tools |
| `tools` | `string[]` | -- | Restrict available built-in tools (`--tools`) |
| `systemPrompt` | `string` | -- | Replace entire system prompt |
| `appendSystemPrompt` | `string` | -- | Append to default system prompt |
| `maxTurns` | `number` | -- | Max agentic turns per query |
| `maxBudget` | `number` | -- | Max spend in USD per query |
| `additionalDirs` | `string[]` | -- | Extra working directories |
| `mcpConfig` | `string \| string[]` | -- | Path(s) to MCP config JSON files |
| `mcpServers` | `Record<string, McpServerConfig \| McpSdkServerConfig>` | -- | Inline MCP server definitions |
| `agents` | `Record<string, AgentConfig>` | -- | Custom subagent definitions |
| `agent` | `string` | -- | Select preconfigured agent |
| `hooks` | [`HooksConfig`](#hooksconfig) | -- | Lifecycle hooks (shell commands, CLI mode) |
| `hookCallbacks` | `Partial<Record<HookEvent, HookCallbackMatcher[]>>` | -- | Lifecycle hook callbacks (JS functions, SDK mode) |
| `canUseTool` | [`CanUseTool`](#canusecool) | -- | Custom permission handler (SDK mode) |
| `thinking` | [`ThinkingConfig`](#thinkingconfig) | -- | Thinking/reasoning behavior (SDK mode) |
| `enableFileCheckpointing` | `boolean` | -- | Track file changes for rewind (SDK mode) |
| `onElicitation` | [`OnElicitation`](#onelicitation) | -- | MCP elicitation request handler (SDK mode) |
| `env` | `Record<string, string>` | -- | Extra environment variables |
| `noSessionPersistence` | `boolean` | -- | Don't save sessions to disk |
| `name` | `string` | -- | Display name for the session |
| `strictMcpConfig` | `boolean` | -- | Ignore MCP servers not in `mcpConfig` |
| `settingSources` | [`SettingSource[]`](#settingsource) | -- | Which settings files to load (SDK mode) |
| `settings` | `string \| Record<string, unknown>` | -- | Additional settings to apply (SDK mode) |
| `plugins` | [`PluginConfig[]`](#pluginconfig) | -- | Plugins to load (SDK mode) |
| `spawnClaudeCodeProcess` | `(options: SpawnOptions) => SpawnedProcess` | -- | Custom process spawner for VMs/containers (SDK mode) |
| `stderr` | `(data: string) => void` | -- | Callback for stderr output (SDK mode) |
| `allowDangerouslySkipPermissions` | `boolean` | -- | Required when using `bypassPermissions` (SDK mode) |
| `betas` | `string[]` | -- | Enable beta features (SDK mode) |
| `agentProgressSummaries` | `boolean` | -- | AI-generated progress summaries for subagents (SDK mode) |
| `includePartialMessages` | `boolean` | -- | Include streaming text deltas (SDK mode) |
| `promptSuggestions` | `boolean` | -- | Enable prompt suggestions after each turn (SDK mode) |
| `debug` | `boolean` | -- | Enable debug logging (SDK mode) |
| `debugFile` | `string` | -- | Write debug logs to file, implies `debug: true` (SDK mode) |

::: tip tools vs allowedTools
`tools` limits which tools **exist** (are available to Claude). `allowedTools` controls which existing tools are **auto-approved** without prompting.
:::

::: tip settingSources
When omitted in SDK mode, no settings files are loaded and **CLAUDE.md files are not read**. Include `'project'` to load project instructions.
:::

## QueryOptions

Per-query overrides. Any field set here takes precedence over `ClientOptions` for the duration of a single query.

```typescript
interface QueryOptions {
  cwd?: string
  model?: string
  effortLevel?: EffortLevel
  permissionMode?: PermissionMode
  allowedTools?: readonly string[]
  disallowedTools?: readonly string[]
  tools?: readonly string[]
  systemPrompt?: string
  appendSystemPrompt?: string
  maxTurns?: number
  maxBudget?: number
  input?: string
  schema?: Record<string, unknown>
  worktree?: boolean | string
  additionalDirs?: readonly string[]
  env?: Record<string, string>
  agent?: string
  signal?: AbortSignal
  thinking?: ThinkingConfig
}
```

| Field | Type | Description |
|-------|------|-------------|
| `cwd` | `string` | Override working directory |
| `model` | `string` | Override model |
| `effortLevel` | [`EffortLevel`](#effortlevel) | Override effort level |
| `permissionMode` | [`PermissionMode`](#permissionmode) | Override permission mode |
| `allowedTools` | `string[]` | Override allowed tools |
| `disallowedTools` | `string[]` | Override disallowed tools |
| `tools` | `string[]` | Override available built-in tools |
| `systemPrompt` | `string` | Override system prompt |
| `appendSystemPrompt` | `string` | Override appended system prompt |
| `maxTurns` | `number` | Override max turns |
| `maxBudget` | `number` | Override max budget |
| `input` | `string` | Piped stdin data (like `echo data \| claude`) |
| `schema` | `object` | JSON Schema for structured output |
| `worktree` | `boolean \| string` | Run in isolated git worktree (`true` for auto name) |
| `additionalDirs` | `string[]` | Override additional directories |
| `env` | `Record<string, string>` | Override environment variables |
| `agent` | `string` | Override agent for this query |
| `signal` | `AbortSignal` | Abort signal for cancelling this query |
| `thinking` | [`ThinkingConfig`](#thinkingconfig) | Override thinking config (SDK mode) |

## QueryResult

Returned from [`claude.query()`](./#query) and [`session.query()`](./session#query).

```typescript
interface QueryResult {
  readonly text: string
  readonly sessionId: string
  readonly usage: TokenUsage
  readonly cost: number | null
  readonly durationMs: number
  readonly messages: readonly Message[]
  readonly structured: unknown | null
  readonly raw: Record<string, unknown>
}
```

| Field | Type | Description |
|-------|------|-------------|
| `text` | `string` | Text response from Claude |
| `sessionId` | `string` | Session ID for resuming |
| `usage` | [`TokenUsage`](#tokenusage) | Token usage statistics |
| `cost` | `number \| null` | Cost in USD |
| `durationMs` | `number` | Wall-clock duration in milliseconds |
| `messages` | [`Message[]`](#message) | Full conversation history |
| `structured` | `unknown \| null` | Structured output (when `schema` is used) |
| `raw` | `object` | Raw CLI JSON response (for advanced use) |

## StreamEvent

Discriminated union of all streaming event types. Check `event.type` to narrow.

```typescript
type StreamEvent =
  | StreamTextEvent
  | StreamToolUseEvent
  | StreamResultEvent
  | StreamErrorEvent
  | StreamSystemEvent
  | StreamTaskStartedEvent
  | StreamTaskProgressEvent
  | StreamTaskNotificationEvent
```

| Type | Constant | Key Fields |
|------|----------|------------|
| `StreamTextEvent` | `EVENT_TEXT` | `text: string` |
| `StreamToolUseEvent` | `EVENT_TOOL_USE` | `toolName: string`, `toolInput: object` |
| `StreamResultEvent` | `EVENT_RESULT` | `text`, `sessionId`, `usage`, `cost`, `durationMs` |
| `StreamErrorEvent` | `EVENT_ERROR` | `message: string`, `code?: string` |
| `StreamSystemEvent` | `EVENT_SYSTEM` | `subtype: string`, `data: object` |
| `StreamTaskStartedEvent` | `EVENT_TASK_STARTED` | `taskId`, `description`, `taskType?`, `prompt?` |
| `StreamTaskProgressEvent` | `EVENT_TASK_PROGRESS` | `taskId`, `description`, `usage`, `summary?` |
| `StreamTaskNotificationEvent` | `EVENT_TASK_NOTIFICATION` | `taskId`, `status`, `outputFile`, `summary` |

### StreamTextEvent

```typescript
interface StreamTextEvent {
  readonly type: 'text'
  readonly text: string // incremental text chunk
}
```

### StreamToolUseEvent

```typescript
interface StreamToolUseEvent {
  readonly type: 'tool_use'
  readonly toolName: string // e.g. 'Read', 'Bash'
  readonly toolInput: Record<string, unknown>
}
```

### StreamResultEvent

```typescript
interface StreamResultEvent {
  readonly type: 'result'
  readonly text: string
  readonly sessionId: string
  readonly usage: TokenUsage
  readonly cost: number | null
  readonly durationMs: number
}
```

### StreamErrorEvent

```typescript
interface StreamErrorEvent {
  readonly type: 'error'
  readonly message: string
  readonly code?: string
}
```

### StreamSystemEvent

```typescript
interface StreamSystemEvent {
  readonly type: 'system'
  readonly subtype: string
  readonly data: Record<string, unknown>
}
```

### StreamTaskStartedEvent

```typescript
interface StreamTaskStartedEvent {
  readonly type: 'task_started'
  readonly taskId: string
  readonly toolUseId?: string
  readonly description: string
  readonly taskType?: string
  readonly prompt?: string
}
```

### StreamTaskProgressEvent

```typescript
interface StreamTaskProgressEvent {
  readonly type: 'task_progress'
  readonly taskId: string
  readonly toolUseId?: string
  readonly description: string
  readonly usage: {
    totalTokens: number
    toolUses: number
    durationMs: number
  }
  readonly lastToolName?: string
  readonly summary?: string
}
```

### StreamTaskNotificationEvent

```typescript
interface StreamTaskNotificationEvent {
  readonly type: 'task_notification'
  readonly taskId: string
  readonly toolUseId?: string
  readonly status: 'completed' | 'failed' | 'stopped'
  readonly outputFile: string
  readonly summary: string
  readonly usage?: {
    totalTokens: number
    toolUses: number
    durationMs: number
  }
}
```

## TokenUsage

```typescript
interface TokenUsage {
  readonly inputTokens: number
  readonly outputTokens: number
}
```

## Message

A single message in the conversation history.

```typescript
interface Message {
  readonly role: 'user' | 'assistant'
  readonly content: string | readonly ContentBlock[]
}
```

## ContentBlock

Discriminated union of content block types within a message.

```typescript
type ContentBlock = TextBlock | ToolUseBlock | ToolResultBlock
```

### TextBlock

```typescript
interface TextBlock {
  readonly type: 'text'
  readonly text: string
}
```

### ToolUseBlock

```typescript
interface ToolUseBlock {
  readonly type: 'tool_use'
  readonly id: string
  readonly name: string
  readonly input: Record<string, unknown>
}
```

### ToolResultBlock

```typescript
interface ToolResultBlock {
  readonly type: 'tool_result'
  readonly tool_use_id: string
  readonly content: string
}
```

## PermissionMode

```typescript
type PermissionMode =
  | 'default'
  | 'acceptEdits'
  | 'plan'
  | 'dontAsk'
  | 'bypassPermissions'
  | 'auto'
```

| Value | Constant | Description |
|-------|----------|-------------|
| `'default'` | `PERMISSION_DEFAULT` | Prompt on first use |
| `'acceptEdits'` | `PERMISSION_ACCEPT_EDITS` | Auto-accept file edits |
| `'plan'` | `PERMISSION_PLAN` | Read-only, no modifications |
| `'dontAsk'` | `PERMISSION_DONT_ASK` | Skip permission prompts |
| `'bypassPermissions'` | `PERMISSION_BYPASS` | Skip all checks (dangerous) |
| `'auto'` | `PERMISSION_AUTO` | Automatically approve tools |

## CanUseTool

Custom permission handler for controlling tool usage. Called before each tool execution in SDK mode.

```typescript
type CanUseTool = (
  toolName: string,
  input: Record<string, unknown>,
  options: {
    signal: AbortSignal
    suggestions?: PermissionUpdate[]
    blockedPath?: string
    decisionReason?: string
    toolUseID: string
    agentID?: string
  },
) => Promise<PermissionResult>
```

```typescript
const claude = new Claude({
  canUseTool: async (toolName, input, { signal }) => {
    if (toolName === 'Bash' && String(input.command).includes('rm -rf'))
      return { behavior: 'deny', message: 'Dangerous command blocked' }
    return { behavior: 'allow' }
  },
})
```

## PermissionResult

Result returned from a [`CanUseTool`](#canusecool) handler.

```typescript
type PermissionResult =
  | {
      behavior: 'allow'
      updatedInput?: Record<string, unknown>
      updatedPermissions?: PermissionUpdate[]
      toolUseID?: string
    }
  | {
      behavior: 'deny'
      message: string
      interrupt?: boolean
      toolUseID?: string
    }
```

## PermissionBehavior

```typescript
type PermissionBehavior = 'allow' | 'deny' | 'ask'
```

## PermissionUpdate

Permission rule update, used to modify permissions at runtime.

```typescript
type PermissionUpdate =
  | { type: 'addRules'; rules: PermissionRuleValue[]; behavior: PermissionBehavior; destination: PermissionUpdateDestination }
  | { type: 'replaceRules'; rules: PermissionRuleValue[]; behavior: PermissionBehavior; destination: PermissionUpdateDestination }
  | { type: 'removeRules'; rules: PermissionRuleValue[]; behavior: PermissionBehavior; destination: PermissionUpdateDestination }
  | { type: 'setMode'; mode: PermissionMode; destination: PermissionUpdateDestination }
  | { type: 'addDirectories'; directories: string[]; destination: PermissionUpdateDestination }
  | { type: 'removeDirectories'; directories: string[]; destination: PermissionUpdateDestination }
```

## PermissionRuleValue

```typescript
type PermissionRuleValue = {
  toolName: string
  ruleContent?: string
}
```

## PermissionUpdateDestination

```typescript
type PermissionUpdateDestination =
  | 'userSettings'
  | 'projectSettings'
  | 'localSettings'
  | 'session'
  | 'cliArg'
```

## ThinkingConfig

Controls Claude's thinking/reasoning behavior. SDK mode only.

```typescript
type ThinkingConfig = ThinkingAdaptive | ThinkingEnabled | ThinkingDisabled
```

### ThinkingAdaptive

```typescript
type ThinkingAdaptive = { type: 'adaptive' }
```

Claude decides when and how much to think.

### ThinkingEnabled

```typescript
type ThinkingEnabled = { type: 'enabled'; budgetTokens: number }
```

Fixed token budget for extended thinking.

### ThinkingDisabled

```typescript
type ThinkingDisabled = { type: 'disabled' }
```

No extended thinking.

## EffortLevel

```typescript
type EffortLevel = 'low' | 'medium' | 'high' | 'max'
```

| Value | Constant | Description |
|-------|----------|-------------|
| `'low'` | `EFFORT_LOW` | Quick, minimal thinking |
| `'medium'` | `EFFORT_MEDIUM` | Balanced |
| `'high'` | `EFFORT_HIGH` | Deep analysis |
| `'max'` | `EFFORT_MAX` | Maximum depth |

## McpServerConfig

Configuration for an inline MCP server definition.

```typescript
interface McpServerConfig {
  readonly type?: 'stdio' | 'http' | 'sse'
  readonly command?: string
  readonly args?: readonly string[]
  readonly url?: string
  readonly env?: Record<string, string>
  readonly headers?: Record<string, string>
}
```

| Field | Type | Description |
|-------|------|-------------|
| `type` | `'stdio' \| 'http' \| 'sse'` | Transport type |
| `command` | `string` | Command to start stdio server |
| `args` | `string[]` | Arguments for stdio server command |
| `url` | `string` | URL for http/sse server |
| `env` | `Record<string, string>` | Environment variables for the server process |
| `headers` | `Record<string, string>` | HTTP headers for http/sse servers |

```typescript
import { Claude } from '@scottwalker/claude-connector'

const claude = new Claude({
  mcpServers: {
    filesystem: {
      type: 'stdio',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-filesystem', '/tmp'],
    },
    remote: {
      type: 'sse',
      url: 'https://mcp.example.com/sse',
      headers: { Authorization: 'Bearer token' },
    },
  },
})
```

## McpSdkServerConfig

In-process MCP server config for SDK mode. Created via `createSdkMcpServer()`.

```typescript
interface McpSdkServerConfig {
  readonly type: 'sdk'
  readonly name: string
  readonly instance: unknown // McpServer instance
}
```

| Field | Type | Description |
|-------|------|-------------|
| `type` | `'sdk'` | Always `'sdk'` for in-process servers |
| `name` | `string` | Server name |
| `instance` | `unknown` | McpServer instance (opaque to avoid hard dependency) |

## AgentConfig

Configuration for a custom subagent.

```typescript
interface AgentConfig {
  readonly description: string
  readonly prompt?: string
  readonly model?: string
  readonly tools?: readonly string[]
  readonly disallowedTools?: readonly string[]
  readonly permissionMode?: PermissionMode
  readonly maxTurns?: number
  readonly isolation?: 'worktree'
  readonly background?: boolean
}
```

| Field | Type | Description |
|-------|------|-------------|
| `description` | `string` | When to delegate to this agent |
| `prompt` | `string` | Initial prompt / instructions |
| `model` | `string` | Model: `'opus'`, `'sonnet'`, `'haiku'`, `'inherit'` |
| `tools` | `string[]` | Tools available to this agent |
| `disallowedTools` | `string[]` | Tools denied to this agent |
| `permissionMode` | [`PermissionMode`](#permissionmode) | Permission mode for this agent |
| `maxTurns` | `number` | Max agentic turns |
| `isolation` | `'worktree'` | Run in isolated git worktree |
| `background` | `boolean` | Always run as background task |

```typescript
import { Claude, PERMISSION_PLAN } from '@scottwalker/claude-connector'

const claude = new Claude({
  agents: {
    reviewer: {
      description: 'Code review specialist',
      prompt: 'You are a senior code reviewer. Focus on security and performance.',
      model: 'opus',
      permissionMode: PERMISSION_PLAN,
    },
    fixer: {
      description: 'Bug fixer that works in isolation',
      model: 'sonnet',
      isolation: 'worktree',
      maxTurns: 10,
    },
  },
})
```

## HookEvent

All 21 lifecycle hook event types supported by `hookCallbacks`.

```typescript
type HookEvent =
  | 'PreToolUse'
  | 'PostToolUse'
  | 'PostToolUseFailure'
  | 'Notification'
  | 'UserPromptSubmit'
  | 'SessionStart'
  | 'SessionEnd'
  | 'Stop'
  | 'SubagentStart'
  | 'SubagentStop'
  | 'PreCompact'
  | 'PermissionRequest'
  | 'Setup'
  | 'TeammateIdle'
  | 'TaskCompleted'
  | 'Elicitation'
  | 'ElicitationResult'
  | 'ConfigChange'
  | 'WorktreeCreate'
  | 'WorktreeRemove'
  | 'InstructionsLoaded'
```

## HookCallback

JS callback for hook events (SDK mode).

```typescript
type HookCallback = (
  input: HookInput,
  toolUseID: string | undefined,
  options: { signal: AbortSignal },
) => Promise<HookJSONOutput>
```

## HookCallbackMatcher

SDK-style hook callback matcher with JS callbacks.

```typescript
interface HookCallbackMatcher {
  readonly matcher?: string
  readonly hooks: readonly HookCallback[]
  readonly timeout?: number
}
```

| Field | Type | Description |
|-------|------|-------------|
| `matcher` | `string` | Regex pattern to match tool names (optional) |
| `hooks` | [`HookCallback[]`](#hookcallback) | Callback functions to execute |
| `timeout` | `number` | Timeout in milliseconds |

```typescript
const claude = new Claude({
  hookCallbacks: {
    PreToolUse: [{
      matcher: 'Bash',
      hooks: [async (input) => ({ continue: true })],
    }],
  },
})
```

## HookInput

Input passed to hook callbacks.

```typescript
type HookInput = {
  session_id: string
  transcript_path: string
  cwd: string
  permission_mode?: string
  agent_id?: string
  agent_type?: string
  hook_event_name: string
  [key: string]: unknown
}
```

## HookJSONOutput

Return value from hook callbacks. Can be synchronous or asynchronous.

```typescript
type HookJSONOutput = SyncHookJSONOutput | AsyncHookJSONOutput

type SyncHookJSONOutput = {
  [key: string]: unknown
}

type AsyncHookJSONOutput = {
  async: true
  asyncTimeout?: number
}
```

## HookEntry

A single hook command to execute at a lifecycle point (CLI mode).

```typescript
interface HookEntry {
  readonly command: string
  readonly timeout?: number
}
```

| Field | Type | Description |
|-------|------|-------------|
| `command` | `string` | Shell command to execute |
| `timeout` | `number` | Timeout in seconds |

## HookMatcher

Matches tool names to hook entries (CLI mode).

```typescript
interface HookMatcher {
  readonly matcher: string
  readonly hooks: readonly HookEntry[]
}
```

| Field | Type | Description |
|-------|------|-------------|
| `matcher` | `string` | Regex pattern to match tool names |
| `hooks` | [`HookEntry[]`](#hookentry) | Hook entries to execute when matched |

## HooksConfig

Lifecycle hooks configuration (CLI mode, shell commands).

```typescript
interface HooksConfig {
  readonly PreToolUse?: readonly HookMatcher[]
  readonly PostToolUse?: readonly HookMatcher[]
  readonly Stop?: readonly HookMatcher[]
  readonly [key: string]: readonly HookMatcher[] | undefined
}
```

| Hook | When |
|------|------|
| `PreToolUse` | Before a tool is executed |
| `PostToolUse` | After a tool completes |
| `Stop` | When Claude stops |

```typescript
const claude = new Claude({
  hooks: {
    PreToolUse: [
      {
        matcher: 'Bash',
        hooks: [{ command: 'echo "Running bash command"', timeout: 5 }],
      },
    ],
    PostToolUse: [
      {
        matcher: '.*',
        hooks: [{ command: 'echo "Tool finished"' }],
      },
    ],
  },
})
```

## OnElicitation

Callback for handling MCP elicitation requests. SDK mode only.

```typescript
type OnElicitation = (
  request: ElicitationRequest,
  options: { signal: AbortSignal },
) => Promise<{
  action: 'accept' | 'decline' | 'cancel'
  content?: Record<string, unknown>
}>
```

## ElicitationRequest

MCP elicitation request payload.

```typescript
interface ElicitationRequest {
  serverName: string
  message: string
  mode?: 'form' | 'url'
  url?: string
  elicitationId?: string
  requestedSchema?: Record<string, unknown>
}
```

| Field | Type | Description |
|-------|------|-------------|
| `serverName` | `string` | Name of the MCP server requesting input |
| `message` | `string` | Message to display to the user |
| `mode` | `'form' \| 'url'` | Elicitation mode |
| `url` | `string` | URL for URL-mode elicitation |
| `elicitationId` | `string` | Unique elicitation identifier |
| `requestedSchema` | `Record<string, unknown>` | JSON Schema for expected input |

## SettingSource

Controls which filesystem settings are loaded. SDK mode only.

```typescript
type SettingSource = 'user' | 'project' | 'local'
```

| Value | Description |
|-------|-------------|
| `'user'` | Global settings (`~/.claude/settings.json`) |
| `'project'` | Project settings (`.claude/settings.json`) |
| `'local'` | Local settings (`.claude/settings.local.json`) |

```typescript
// Load project settings + CLAUDE.md
new Claude({ settingSources: ['user', 'project'] })

// Full isolation (default SDK behavior)
new Claude({ settingSources: [] })
```

## PluginConfig

Plugin configuration. Plugins provide custom commands, agents, skills, and hooks. SDK mode only.

```typescript
interface PluginConfig {
  readonly type: 'local'
  readonly path: string
}
```

| Field | Type | Description |
|-------|------|-------------|
| `type` | `'local'` | Plugin type (currently only `'local'`) |
| `path` | `string` | Absolute or relative path to the plugin directory |

```typescript
new Claude({
  plugins: [
    { type: 'local', path: './my-plugin' },
    { type: 'local', path: '/absolute/path/to/plugin' },
  ],
})
```

## SpawnOptions

Options passed to a custom `spawnClaudeCodeProcess` function.

```typescript
interface SpawnOptions {
  readonly command: string
  readonly args: readonly string[]
  readonly cwd: string
  readonly env: Record<string, string | undefined>
  readonly signal?: AbortSignal
}
```

| Field | Type | Description |
|-------|------|-------------|
| `command` | `string` | Command to execute |
| `args` | `string[]` | Arguments for the command |
| `cwd` | `string` | Working directory |
| `env` | `Record<string, string \| undefined>` | Environment variables |
| `signal` | `AbortSignal` | Abort signal |

## SpawnedProcess

Interface that a custom-spawned process must satisfy.

```typescript
interface SpawnedProcess {
  readonly stdout: NodeJS.ReadableStream
  readonly stderr: NodeJS.ReadableStream
  readonly stdin: NodeJS.WritableStream
  readonly exitCode: Promise<number | null>
  kill(signal?: string): void
}
```

| Field | Type | Description |
|-------|------|-------------|
| `stdout` | `ReadableStream` | Standard output stream |
| `stderr` | `ReadableStream` | Standard error stream |
| `stdin` | `WritableStream` | Standard input stream |
| `exitCode` | `Promise<number \| null>` | Process exit promise |
| `kill()` | `(signal?: string) => void` | Kill the process |

```typescript
new Claude({
  spawnClaudeCodeProcess: (options) => {
    // options: { command, args, cwd, env, signal }
    return myDockerProcess // Must satisfy SpawnedProcess
  },
})
```

## AccountInfo

Information about the logged-in user's account. Returned by `claude.getAccountInfo()`.

```typescript
interface AccountInfo {
  email?: string
  organization?: string
  subscriptionType?: string
  tokenSource?: string
  apiKeySource?: string
}
```

## ModelInfo

Information about an available model. Returned by `claude.listModels()`.

```typescript
interface ModelInfo {
  value: string
  displayName: string
  description: string
  supportsEffort?: boolean
  supportedEffortLevels?: ('low' | 'medium' | 'high' | 'max')[]
  supportsAdaptiveThinking?: boolean
  supportsFastMode?: boolean
  supportsAutoMode?: boolean
}
```

## SlashCommand

Available slash command. Returned by `claude.listSlashCommands()`.

```typescript
interface SlashCommand {
  [key: string]: unknown
}
```

## AgentInfo

Information about an available subagent. Returned by `claude.listAgents()`.

```typescript
interface AgentInfo {
  name: string
  description: string
  model?: string
}
```

## McpServerStatus

Status of an MCP server connection. Returned by `claude.getMcpServers()`.

```typescript
interface McpServerStatus {
  name: string
  status: 'connected' | 'failed' | 'needs-auth' | 'pending' | 'disabled'
  serverInfo?: { name: string; version: string }
  error?: string
  config?: Record<string, unknown>
  scope?: string
  tools?: Array<{
    name: string
    description?: string
    annotations?: {
      readOnly?: boolean
      destructive?: boolean
      openWorld?: boolean
    }
  }>
}
```

## McpSetServersResult

Result of a `claude.setMcpServers()` operation.

```typescript
interface McpSetServersResult {
  added: string[]
  removed: string[]
  errors: Record<string, string>
}
```

## RewindFilesResult

Result of a `claude.rewindFiles()` operation.

```typescript
interface RewindFilesResult {
  canRewind: boolean
  error?: string
  filesChanged?: string[]
  insertions?: number
  deletions?: number
}
```

## SessionInfo

Metadata about a stored session (returned by session listing APIs).

```typescript
interface SessionInfo {
  readonly sessionId: string
  readonly name?: string
  readonly summary?: string
  readonly lastActive: string
  readonly cwd: string
}
```

| Field | Type | Description |
|-------|------|-------------|
| `sessionId` | `string` | Unique session identifier |
| `name` | `string` | Human-readable session name (if renamed) |
| `summary` | `string` | Brief summary of the session |
| `lastActive` | `string` | ISO 8601 timestamp of last activity |
| `cwd` | `string` | Working directory associated with the session |
