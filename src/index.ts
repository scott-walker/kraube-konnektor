/**
 * # claude-connector
 *
 * Programmatic Node.js interface for Claude Code CLI.
 *
 * ## Quick start
 *
 * ```ts
 * import { Claude } from '@scottwalker/claude-connector'
 *
 * const claude = new Claude({ model: 'sonnet' })
 * const result = await claude.query('Find bugs in auth.ts')
 * console.log(result.text)
 * ```
 *
 * ## Architecture
 *
 * ```
 * ┌─────────┐     ┌─────────────┐     ┌────────────┐     ┌─────────────┐
 * │  Claude  │────>│ ArgsBuilder │────>│  IExecutor  │────>│  CLI Process │
 * │ (facade) │     │ (options→   │     │ (abstract)  │     │  (claude -p) │
 * │          │     │  CLI args)  │     │             │     │              │
 * └─────────┘     └─────────────┘     └────────────┘     └─────────────┘
 *      │                                    ▲
 *      │                                    │
 *      ▼                              ┌─────┴──────┐
 * ┌─────────┐                         │CliExecutor  │  (default implementation)
 * │ Session │                         │ SdkExecutor │  (future)
 * │ Scheduler│                        │ HttpExecutor│  (future)
 * └─────────┘                         └────────────┘
 * ```
 *
 * @module
 */

// ── Main client ───────────────────────────────────────────────────
export { Claude } from './client/claude.js';
export { Session } from './client/session.js';
export { StreamHandle } from './client/stream-handle.js';
export { ChatHandle } from './client/chat-handle.js';

// ── Executor abstraction ──────────────────────────────────────────
export type { IExecutor, ExecuteOptions } from './executor/interface.js';
export { CliExecutor } from './executor/cli-executor.js';
export { SdkExecutor } from './executor/sdk-executor.js';
export type { SdkExecutorOptions, SdkExecutorEvents, InitStage } from './executor/sdk-executor.js';

// ── Scheduler ─────────────────────────────────────────────────────
export { Scheduler, ScheduledJob } from './scheduler/scheduler.js';
export type { ScheduledJobEvents } from './scheduler/scheduler.js';

// ── Builder ───────────────────────────────────────────────────────
export { buildArgs, mergeOptions, resolveEnv } from './builder/args-builder.js';
export type { ResolvedOptions } from './builder/args-builder.js';

// ── Parsers ───────────────────────────────────────────────────────
export { parseJsonResult } from './parser/json-parser.js';
export { parseStreamLine } from './parser/stream-parser.js';

// ── Errors ────────────────────────────────────────────────────────
export {
  ClaudeConnectorError,
  CliNotFoundError,
  CliExecutionError,
  CliTimeoutError,
  ParseError,
  ValidationError,
} from './errors/errors.js';

// ── Constants ─────────────────────────────────────────────────────
export {
  // Stream event types
  EVENT_TEXT,
  EVENT_TOOL_USE,
  EVENT_RESULT,
  EVENT_ERROR,
  EVENT_SYSTEM,

  // Permission modes
  PERMISSION_DEFAULT,
  PERMISSION_ACCEPT_EDITS,
  PERMISSION_PLAN,
  PERMISSION_DONT_ASK,
  PERMISSION_BYPASS,
  PERMISSION_AUTO,

  // Effort levels
  EFFORT_LOW,
  EFFORT_MEDIUM,
  EFFORT_HIGH,
  EFFORT_MAX,

  // Scheduler events
  SCHED_RESULT,
  SCHED_ERROR,
  SCHED_TICK,
  SCHED_STOP,

  // Init events
  INIT_EVENT_STAGE,
  INIT_EVENT_READY,
  INIT_EVENT_ERROR,

  // Defaults
  DEFAULT_EXECUTABLE,

  // Content block types
  BLOCK_TEXT,
  BLOCK_TOOL_USE,
  BLOCK_TOOL_RESULT,
} from './constants.js';

// ── Types ─────────────────────────────────────────────────────────
export type {
  ClientOptions,
  QueryOptions,
  PermissionMode,
  EffortLevel,
  McpServerConfig,
  AgentConfig,
  HookEntry,
  HookMatcher,
  HooksConfig,
  QueryResult,
  StreamEvent,
  StreamTextEvent,
  StreamToolUseEvent,
  StreamResultEvent,
  StreamErrorEvent,
  StreamSystemEvent,
  TokenUsage,
  Message,
  ContentBlock,
  TextBlock,
  ToolUseBlock,
  ToolResultBlock,
  SessionOptions,
  SessionInfo,
} from './types/index.js';
