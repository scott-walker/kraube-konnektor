/**
 * Configuration for the Claude client instance.
 *
 * Options set here act as defaults for all queries made through this client.
 * Per-query overrides are available via {@link QueryOptions}.
 */
export interface ClientOptions {
  /**
   * Path to the Claude Code CLI executable.
   * Defaults to 'claude' (resolved from PATH).
   *
   * Useful when multiple CLI versions are installed:
   * @example
   * ```ts
   * new Claude({ executable: '/usr/local/bin/claude-2.0' })
   * ```
   */
  readonly executable?: string;

  /**
   * Use the Claude Agent SDK (V2) instead of spawning CLI processes.
   * **Defaults to `true`.**
   *
   * Creates a persistent SDK session that stays warm.
   * First query requires initialization (~5-10s), but subsequent queries
   * are near-instant. Call `claude.init()` to warm up explicitly,
   * or let it auto-initialize on the first query.
   *
   * Set to `false` to use CLI mode (each query spawns a new process).
   *
   * Subscribe to initialization events:
   * ```ts
   * claude.on('init:stage', (stage, msg) => console.log(stage, msg))
   * claude.on('init:ready', () => console.log('Ready!'))
   * ```
   */
  readonly useSdk?: boolean;

  /**
   * Working directory for Claude Code operations.
   * Defaults to `process.cwd()`.
   */
  readonly cwd?: string;

  /** Model identifier: 'opus', 'sonnet', 'haiku', or a full model ID. */
  readonly model?: string;

  /** Thinking depth: 'low' | 'medium' | 'high'. */
  readonly effortLevel?: EffortLevel;

  /** Model to fall back to if the primary model fails. */
  readonly fallbackModel?: string;

  /**
   * Permission mode controlling tool approval behavior.
   *
   * - `'default'`            — prompt on first use
   * - `'acceptEdits'`        — auto-accept file edits
   * - `'plan'`               — read-only, no modifications
   * - `'bypassPermissions'`  — skip all checks (dangerous)
   */
  readonly permissionMode?: PermissionMode;

  /** Tools that are auto-approved without prompting. Supports glob patterns. */
  readonly allowedTools?: readonly string[];

  /** Tools that are always denied. */
  readonly disallowedTools?: readonly string[];

  /** Override the entire system prompt. */
  readonly systemPrompt?: string;

  /** Append text to the default system prompt. */
  readonly appendSystemPrompt?: string;

  /** Maximum number of agentic turns per query. */
  readonly maxTurns?: number;

  /** Maximum spend in USD per query. */
  readonly maxBudget?: number;

  /** Additional working directories to include. */
  readonly additionalDirs?: readonly string[];

  /** Path(s) to MCP config JSON files. */
  readonly mcpConfig?: string | readonly string[];

  /** Inline MCP server definitions. Supports SDK in-process servers. */
  readonly mcpServers?: Readonly<Record<string, McpServerConfig | McpSdkServerConfig>>;

  /** Custom subagent definitions. */
  readonly agents?: Readonly<Record<string, AgentConfig>>;

  /** Lifecycle hooks (shell commands for CLI mode). */
  readonly hooks?: Readonly<HooksConfig>;

  /**
   * Lifecycle hook callbacks (JS functions for SDK mode).
   * These run in-process, unlike shell-command `hooks`.
   *
   * All 21 hook event types are supported:
   * PreToolUse, PostToolUse, PostToolUseFailure, Notification,
   * UserPromptSubmit, SessionStart, SessionEnd, Stop,
   * SubagentStart, SubagentStop, PreCompact, PermissionRequest,
   * Setup, TeammateIdle, TaskCompleted, Elicitation,
   * ElicitationResult, ConfigChange, WorktreeCreate,
   * WorktreeRemove, InstructionsLoaded.
   *
   * @example
   * ```ts
   * new Claude({
   *   hookCallbacks: {
   *     PreToolUse: [{
   *       matcher: 'Bash',
   *       hooks: [async (input) => ({ continue: true })],
   *     }],
   *   },
   * })
   * ```
   */
  readonly hookCallbacks?: Partial<Record<HookEvent, readonly HookCallbackMatcher[]>>;

  /**
   * Custom permission handler for controlling tool usage.
   * Called before each tool execution to determine if it should be allowed.
   * SDK mode only — ignored in CLI mode.
   *
   * @example
   * ```ts
   * new Claude({
   *   canUseTool: async (toolName, input, { signal }) => {
   *     if (toolName === 'Bash' && String(input.command).includes('rm -rf'))
   *       return { behavior: 'deny', message: 'Dangerous command blocked' }
   *     return { behavior: 'allow' }
   *   },
   * })
   * ```
   */
  readonly canUseTool?: CanUseTool;

  /**
   * Controls Claude's thinking/reasoning behavior. SDK mode only.
   *
   * - `{ type: 'adaptive' }` — Claude decides when and how much to think
   * - `{ type: 'enabled', budgetTokens: number }` — fixed token budget
   * - `{ type: 'disabled' }` — no extended thinking
   */
  readonly thinking?: ThinkingConfig;

  /**
   * Enable file checkpointing to track file changes during the session.
   * When enabled, files can be rewound using `claude.rewindFiles()`.
   * SDK mode only.
   */
  readonly enableFileCheckpointing?: boolean;

  /**
   * Callback for handling MCP elicitation requests.
   * Called when an MCP server requests user input. SDK mode only.
   */
  readonly onElicitation?: OnElicitation;

  /** Extra environment variables passed to the CLI process. */
  readonly env?: Readonly<Record<string, string>>;

  /** Disable session persistence (useful for CI/automation). */
  readonly noSessionPersistence?: boolean;

  /**
   * Select a specific preconfigured agent for the session.
   * Overrides the default agent. Use with `agents` to define agents inline.
   */
  readonly agent?: string;

  /**
   * Restrict the set of built-in tools available to Claude.
   * Pass `['default']` for all tools, `[]` to disable all, or specific names.
   *
   * **Different from `allowedTools`**: `tools` limits which tools *exist*,
   * while `allowedTools` controls which tools are *auto-approved*.
   */
  readonly tools?: readonly string[];

  /** Display name for the session (shown in /resume and terminal title). */
  readonly name?: string;

  /** Only use MCP servers from `mcpConfig`, ignoring all other MCP configurations. */
  readonly strictMcpConfig?: boolean;

  /**
   * Enable beta features. SDK mode only.
   * Currently supported: `'context-1m-2025-08-07'` (1M token context).
   */
  readonly betas?: readonly string[];

  /**
   * Enable periodic AI-generated progress summaries for subagents.
   * SDK mode only.
   */
  readonly agentProgressSummaries?: boolean;

  /**
   * Include partial/streaming message events. SDK mode only.
   * When true, text deltas are emitted during streaming.
   */
  readonly includePartialMessages?: boolean;

  /**
   * Enable prompt suggestions after each turn. SDK mode only.
   */
  readonly promptSuggestions?: boolean;

  /**
   * Enable debug logging. SDK mode only.
   */
  readonly debug?: boolean;

  /**
   * Write debug logs to a file. Implies debug: true. SDK mode only.
   */
  readonly debugFile?: string;

  /**
   * Callback for stderr output from the Claude Code process.
   * Useful for production monitoring and logging. SDK mode only.
   *
   * @example
   * ```ts
   * new Claude({
   *   stderr: (data) => logger.warn('[claude stderr]', data),
   * })
   * ```
   */
  readonly stderr?: (data: string) => void;

  /**
   * Must be set to `true` when using `permissionMode: 'bypassPermissions'`.
   * This is a safety measure to ensure intentional bypassing of permissions.
   * SDK mode only.
   */
  readonly allowDangerouslySkipPermissions?: boolean;

  /**
   * Control which filesystem settings to load. SDK mode only.
   *
   * - `'user'`    — Global settings (`~/.claude/settings.json`)
   * - `'project'` — Project settings (`.claude/settings.json`)
   * - `'local'`   — Local settings (`.claude/settings.local.json`)
   *
   * **Important**: When omitted, SDK runs in isolation mode — no settings files
   * are loaded and **CLAUDE.md files are not read**. Include `'project'` to load
   * project instructions.
   *
   * @example
   * ```ts
   * // Load project settings + CLAUDE.md
   * new Claude({ settingSources: ['user', 'project'] })
   *
   * // Full isolation (default SDK behavior)
   * new Claude({ settingSources: [] })
   * ```
   */
  readonly settingSources?: readonly SettingSource[];

  /**
   * Additional settings to apply. SDK mode only.
   * Accepts either a path to a settings JSON file or an inline settings object.
   * Loaded into the "flag settings" layer (highest priority).
   *
   * @example
   * ```ts
   * // Inline permissions
   * new Claude({
   *   settings: {
   *     permissions: { allow: ['Bash(npm test)', 'Read(*)'] },
   *     model: 'claude-sonnet-4-6',
   *   },
   * })
   *
   * // Path to file
   * new Claude({ settings: '/path/to/settings.json' })
   * ```
   */
  readonly settings?: string | Record<string, unknown>;

  /**
   * Load plugins for this session. Plugins provide custom commands,
   * agents, skills, and hooks. SDK mode only.
   *
   * @example
   * ```ts
   * new Claude({
   *   plugins: [
   *     { type: 'local', path: './my-plugin' },
   *     { type: 'local', path: '/absolute/path/to/plugin' },
   *   ],
   * })
   * ```
   */
  readonly plugins?: readonly PluginConfig[];

  /**
   * Custom function to spawn the Claude Code process.
   * Use this to run Claude Code in VMs, containers, or remote environments.
   * SDK mode only.
   *
   * @example
   * ```ts
   * new Claude({
   *   spawnClaudeCodeProcess: (options) => {
   *     // options: { command, args, cwd, env, signal }
   *     return myDockerProcess; // Must satisfy SpawnedProcess interface
   *   },
   * })
   * ```
   */
  readonly spawnClaudeCodeProcess?: (options: SpawnOptions) => SpawnedProcess;

  /**
   * Timeout for SDK initialization in milliseconds.
   * Default: 120000 (2 minutes). SDK mode only.
   */
  readonly initTimeoutMs?: number;

  /**
   * JSON Schema for structured output.
   * All responses will be validated JSON matching this schema.
   *
   * In SDK mode, this is set once at session initialization.
   * In CLI mode, this is passed as `--json-schema` to every query.
   *
   * For per-query schema overrides, use {@link QueryOptions.schema}.
   *
   * @example
   * ```ts
   * const claude = new Claude({
   *   schema: {
   *     type: 'object',
   *     properties: {
   *       endpoints: { type: 'array', items: { type: 'string' } },
   *     },
   *     required: ['endpoints'],
   *   },
   * })
   * ```
   */
  readonly schema?: Record<string, unknown>;
}

/**
 * Per-query options that override client defaults.
 *
 * Any field set here takes precedence over the corresponding {@link ClientOptions} field
 * for the duration of a single query.
 */
export interface QueryOptions {
  /** Override working directory for this query. */
  readonly cwd?: string;

  /** Override model for this query. */
  readonly model?: string;

  /** Override effort level for this query. */
  readonly effortLevel?: EffortLevel;

  /** Override permission mode for this query. */
  readonly permissionMode?: PermissionMode;

  /** Override allowed tools for this query. */
  readonly allowedTools?: readonly string[];

  /** Override disallowed tools for this query. */
  readonly disallowedTools?: readonly string[];

  /** Override system prompt for this query. */
  readonly systemPrompt?: string;

  /** Append to system prompt for this query. */
  readonly appendSystemPrompt?: string;

  /** Override max turns for this query. */
  readonly maxTurns?: number;

  /** Override max budget for this query. */
  readonly maxBudget?: number;

  /**
   * Piped input — equivalent to `echo "data" | claude -p "prompt"`.
   * Provides additional context alongside the prompt.
   */
  readonly input?: string;

  /**
   * JSON Schema for structured output.
   * Claude will return validated JSON matching this schema.
   */
  readonly schema?: Record<string, unknown>;

  /**
   * Run in an isolated git worktree.
   * Pass `true` for auto-generated name, or a string for a specific name.
   */
  readonly worktree?: boolean | string;

  /** Additional directories for this query. */
  readonly additionalDirs?: readonly string[];

  /** Extra environment variables for this query. */
  readonly env?: Readonly<Record<string, string>>;

  /** Override agent for this query. */
  readonly agent?: string;

  /** Override available tools for this query. */
  readonly tools?: readonly string[];

  /**
   * AbortSignal for cancelling this specific query.
   * More granular than `claude.abort()` which kills the entire session.
   */
  readonly signal?: AbortSignal;

  /** Override thinking config for this query. SDK mode only. */
  readonly thinking?: ThinkingConfig;
}

// ── Permission types ──────────────────────────────────────────────

export type PermissionMode =
  | 'default'
  | 'acceptEdits'
  | 'plan'
  | 'dontAsk'
  | 'bypassPermissions'
  | 'auto';

export type PermissionBehavior = 'allow' | 'deny' | 'ask';

export type PermissionResult =
  | {
      behavior: 'allow';
      updatedInput?: Record<string, unknown>;
      updatedPermissions?: PermissionUpdate[];
      toolUseID?: string;
    }
  | {
      behavior: 'deny';
      message: string;
      interrupt?: boolean;
      toolUseID?: string;
    };

export type PermissionRuleValue = {
  toolName: string;
  ruleContent?: string;
};

export type PermissionUpdateDestination =
  | 'userSettings'
  | 'projectSettings'
  | 'localSettings'
  | 'session'
  | 'cliArg';

export type PermissionUpdate =
  | { type: 'addRules'; rules: PermissionRuleValue[]; behavior: PermissionBehavior; destination: PermissionUpdateDestination }
  | { type: 'replaceRules'; rules: PermissionRuleValue[]; behavior: PermissionBehavior; destination: PermissionUpdateDestination }
  | { type: 'removeRules'; rules: PermissionRuleValue[]; behavior: PermissionBehavior; destination: PermissionUpdateDestination }
  | { type: 'setMode'; mode: PermissionMode; destination: PermissionUpdateDestination }
  | { type: 'addDirectories'; directories: string[]; destination: PermissionUpdateDestination }
  | { type: 'removeDirectories'; directories: string[]; destination: PermissionUpdateDestination };

/**
 * Permission callback — programmatic control over tool usage.
 * Called before each tool execution in SDK mode.
 */
export type CanUseTool = (
  toolName: string,
  input: Record<string, unknown>,
  options: {
    signal: AbortSignal;
    suggestions?: PermissionUpdate[];
    blockedPath?: string;
    decisionReason?: string;
    toolUseID: string;
    agentID?: string;
  },
) => Promise<PermissionResult>;

// ── Thinking config ───────────────────────────────────────────────

export type ThinkingAdaptive = { type: 'adaptive' };
export type ThinkingEnabled = { type: 'enabled'; budgetTokens: number };
export type ThinkingDisabled = { type: 'disabled' };
export type ThinkingConfig = ThinkingAdaptive | ThinkingEnabled | ThinkingDisabled;

// ── Hook types ────────────────────────────────────────────────────

export type HookEvent =
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
  | 'InstructionsLoaded';

/** Hook input (discriminated union — matches SDK HookInput). */
export type HookInput = {
  session_id: string;
  transcript_path: string;
  cwd: string;
  permission_mode?: string;
  agent_id?: string;
  agent_type?: string;
  hook_event_name: string;
  [key: string]: unknown;
};

/** Hook output — sync or async. */
export type HookJSONOutput = SyncHookJSONOutput | AsyncHookJSONOutput;

export type SyncHookJSONOutput = {
  [key: string]: unknown;
};

export type AsyncHookJSONOutput = {
  async: true;
  asyncTimeout?: number;
};

/** JS callback for hook events (SDK mode). */
export type HookCallback = (
  input: HookInput,
  toolUseID: string | undefined,
  options: { signal: AbortSignal },
) => Promise<HookJSONOutput>;

/** SDK-style hook callback matcher with JS callbacks. */
export interface HookCallbackMatcher {
  readonly matcher?: string;
  readonly hooks: readonly HookCallback[];
  readonly timeout?: number;
}

/** Elicitation request from an MCP server. */
export interface ElicitationRequest {
  serverName: string;
  message: string;
  mode?: 'form' | 'url';
  url?: string;
  elicitationId?: string;
  requestedSchema?: Record<string, unknown>;
}

/** Callback for handling MCP elicitation requests. */
export type OnElicitation = (
  request: ElicitationRequest,
  options: { signal: AbortSignal },
) => Promise<{ action: 'accept' | 'decline' | 'cancel'; content?: Record<string, unknown> }>;

// ── Effort ────────────────────────────────────────────────────────

export type EffortLevel = 'low' | 'medium' | 'high' | 'max';

// ── MCP server configs ────────────────────────────────────────────

export interface McpServerConfig {
  /** Transport type. */
  readonly type?: 'stdio' | 'http' | 'sse';

  /** Command to start stdio server. */
  readonly command?: string;

  /** Arguments for stdio server command. */
  readonly args?: readonly string[];

  /** URL for http/sse server. */
  readonly url?: string;

  /** Environment variables for the server process. */
  readonly env?: Readonly<Record<string, string>>;

  /** HTTP headers for http/sse servers. */
  readonly headers?: Readonly<Record<string, string>>;
}

/**
 * In-process MCP server config (SDK mode only).
 * Created via `createSdkMcpServer()`.
 */
export interface McpSdkServerConfig {
  readonly type: 'sdk';
  readonly name: string;
  readonly instance: unknown; // McpServer — opaque to avoid hard dependency
}

// ── Agent config ──────────────────────────────────────────────────

export interface AgentConfig {
  /** When to delegate to this agent. */
  readonly description: string;

  /** Initial prompt / instructions for the agent. */
  readonly prompt?: string;

  /** Model for this agent: 'opus', 'sonnet', 'haiku', 'inherit'. */
  readonly model?: string;

  /** Tools available to this agent. */
  readonly tools?: readonly string[];

  /** Tools denied to this agent. */
  readonly disallowedTools?: readonly string[];

  /** Permission mode for this agent. */
  readonly permissionMode?: PermissionMode;

  /** Max agentic turns. */
  readonly maxTurns?: number;

  /** Run in isolated git worktree. */
  readonly isolation?: 'worktree';

  /** Always run as background task. */
  readonly background?: boolean;
}

// ── Shell-command hooks (CLI mode, backward compat) ───────────────

export interface HookEntry {
  /** Shell command to execute. */
  readonly command: string;

  /** Timeout in seconds. */
  readonly timeout?: number;
}

export interface HookMatcher {
  /** Regex pattern to match tool names. */
  readonly matcher: string;

  /** Hook entries to execute when matched. */
  readonly hooks: readonly HookEntry[];
}

export interface HooksConfig {
  readonly PreToolUse?: readonly HookMatcher[];
  readonly PostToolUse?: readonly HookMatcher[];
  readonly Stop?: readonly HookMatcher[];
  readonly [key: string]: readonly HookMatcher[] | undefined;
}

// ── Setting sources ──────────────────────────────────────────────

export type SettingSource = 'user' | 'project' | 'local';

// ── Plugin config ────────────────────────────────────────────────

export interface PluginConfig {
  /** Plugin type. Currently only 'local' is supported. */
  readonly type: 'local';

  /** Absolute or relative path to the plugin directory. */
  readonly path: string;
}

// ── Custom spawn (VMs/containers) ────────────────────────────────

export interface SpawnOptions {
  /** Command to execute. */
  readonly command: string;

  /** Arguments for the command. */
  readonly args: readonly string[];

  /** Working directory. */
  readonly cwd: string;

  /** Environment variables. */
  readonly env: Record<string, string | undefined>;

  /** Abort signal. */
  readonly signal?: AbortSignal;
}

export interface SpawnedProcess {
  /** Standard output stream. */
  readonly stdout: NodeJS.ReadableStream;

  /** Standard error stream. */
  readonly stderr: NodeJS.ReadableStream;

  /** Standard input stream. */
  readonly stdin: NodeJS.WritableStream;

  /** Process exit promise or event. */
  readonly exitCode: Promise<number | null>;

  /** Kill the process. */
  kill(signal?: string): void;
}
