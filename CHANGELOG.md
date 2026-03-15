# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.3.0] - 2026-03-15

### Added

- **`StreamHandle`** — fluent streaming API returned by `stream()` and `session.stream()`:
  - `.on(EVENT_TEXT, cb)` — typed event callbacks with chaining
  - `.done()` — consume stream, fire callbacks, return result
  - `.text()` — collect all text into a string (one-liner)
  - `.pipe(writable)` — pipe text to any writable, return result
  - `.toReadable()` — Node.js `Readable` stream (text mode) for `pipeline()`, HTTP responses, file writes
  - `[Symbol.asyncIterator]` — backward-compatible `for await` over `StreamEvent` objects
- **`ChatHandle`** — bidirectional streaming via `--input-format stream-json`:
  - `claude.chat()` — open a persistent CLI process for multi-turn real-time conversation
  - `.send(prompt)` — send prompt, returns `Promise<StreamResultEvent>` when turn completes
  - `.on()` — same fluent callback API as `StreamHandle`
  - `.pipe(dest)` — continuous pipe to writable (returns dest for chaining)
  - `.toReadable()` — Node.js `Readable` for text output
  - `.toDuplex()` — Node.js `Duplex` (write prompts, read text) for `pipeline()` integration
  - `.end()` / `.abort()` — graceful close or immediate kill
  - `.sessionId`, `.turnCount`, `.closed` — state tracking
- **`constants.ts`** — all 180+ string literals extracted into named constants:
  - Event types: `EVENT_TEXT`, `EVENT_TOOL_USE`, `EVENT_RESULT`, `EVENT_ERROR`, `EVENT_SYSTEM`
  - Permission modes: `PERMISSION_DEFAULT`, `PERMISSION_ACCEPT_EDITS`, `PERMISSION_PLAN`, `PERMISSION_AUTO`, `PERMISSION_DONT_ASK`, `PERMISSION_BYPASS`
  - Effort levels: `EFFORT_LOW`, `EFFORT_MEDIUM`, `EFFORT_HIGH`, `EFFORT_MAX`
  - CLI flags: `FLAG_PRINT`, `FLAG_MODEL`, `FLAG_RESUME`, etc. (30+ flags)
  - JSON protocol keys: `KEY_RESULT`, `KEY_SESSION_ID`, `KEY_USAGE`, etc.
  - Scheduler events: `SCHED_RESULT`, `SCHED_ERROR`, `SCHED_TICK`, `SCHED_STOP`
  - Defaults: `DEFAULT_EXECUTABLE`, `DEFAULT_MODEL`, `DEFAULT_TIMEOUT_MS`
  - All constants exported from the package for client-side use
- `--input-format stream-json` support in `ArgsBuilder` (for `ChatHandle`)
- Streaming guide (`docs/STREAMING.md`) — 27 integration patterns (Express, Fastify, SSE, WebSocket, Telegram, Slack, Electron, Worker Threads, pipeline, gzip, etc.)
- 20 new unit tests (122 total)

### Changed

- `stream()` now returns `StreamHandle` instead of `AsyncIterable<StreamEvent>` (backward compatible — `StreamHandle` implements `AsyncIterable`)
- `session.stream()` now returns `StreamHandle`
- `ResolvedOptions.prompt` is now optional (for chat mode)
- Zero magic strings in source code — all modules import from `constants.ts`
- All documentation updated with constants in code examples

## [0.2.0] - 2026-03-15

### Fixed

- **CLI streaming was broken** — `--output-format stream-json` requires `--verbose` flag; `ArgsBuilder` now adds it automatically
- **`systemPrompt` was ignored in SDK mode** — now passed to SDK session creation and forwarded per-query via `ExecuteOptions`
- **`mcpServers` was dead code in CLI mode** — inline server definitions are now serialized as JSON and passed to `--mcp-config`
- **`hooks` was dead code in CLI mode** — hook configurations are now passed via `--settings` JSON flag
- **`effortLevel` was passed via env variable** — now uses the correct `--effort` CLI flag

### Added

- `PermissionMode: 'auto'` — automatic tool approval based on risk level
- `EffortLevel: 'max'` — maximum thinking depth
- `agent` option (`ClientOptions` + `QueryOptions`) — select a preconfigured agent (`--agent` flag)
- `tools` option (`ClientOptions` + `QueryOptions`) — restrict the set of available built-in tools (`--tools` flag)
- `name` option (`ClientOptions`) — display name for sessions (`--name` flag)
- `strictMcpConfig` option (`ClientOptions`) — ignore all MCP servers except explicitly provided (`--strict-mcp-config` flag)
- `systemPrompt` field in `ExecuteOptions` — enables per-query system prompt overrides in SDK mode
- `systemPrompt`, `appendSystemPrompt`, `maxTurns` fields in `SdkExecutorOptions` — passed to SDK session creation
- Comprehensive examples document (`docs/EXAMPLES.md`) covering all library features
- 20 new unit tests (102 total)

### Changed

- `resolveEnv()` no longer injects `CLAUDE_CODE_EFFORT_LEVEL` — effort is now a first-class CLI flag

## [0.1.0] - 2026-03-10

### Added

- `Claude` client with `query()`, `stream()`, `parallel()`, and `abort()` methods
- `Session` for multi-turn conversations with `--resume` / `--continue` support
- `ScheduledJob` via `claude.loop()` — recurring queries (Node.js-level `/loop`)
- `IExecutor` abstraction for swappable CLI backends
- `CliExecutor` — default implementation spawning `claude -p`
- `SdkExecutor` — persistent SDK session via Claude Agent SDK V2
- Full `ClientOptions` covering all Claude Code CLI flags:
  - `executable` — path to CLI binary (multiple installations)
  - `model`, `effortLevel`, `fallbackModel` — model configuration
  - `permissionMode`, `allowedTools`, `disallowedTools` — permission control
  - `systemPrompt`, `appendSystemPrompt` — prompt customization
  - `maxTurns`, `maxBudget` — execution limits
  - `mcpConfig`, `mcpServers` — MCP server integration
  - `agents` — custom subagent definitions
  - `hooks` — lifecycle hooks (PreToolUse, PostToolUse, etc.)
  - `worktree` — git worktree isolation
  - `additionalDirs` — extra working directories
  - `schema` — JSON Schema for structured output
  - `input` — piped stdin data
- Per-query option overrides via `QueryOptions`
- Streaming via NDJSON parsing (`--output-format stream-json`)
- Typed error hierarchy: `CliNotFoundError`, `CliExecutionError`, `CliTimeoutError`, `ParseError`, `ValidationError`
- 82 unit tests
- Integration test suite (`examples/integration-test/`)
- Architecture documentation (`docs/ARCHITECTURE.md`)
- API reference (`docs/API.md`)
