# Changelog

All notable changes to this project will be documented in this file.

## [0.4.0] - 2026-03-16

### Added

- **SDK near-parity** — 95% coverage of `@anthropic-ai/claude-agent-sdk` Options and Query API
- **SdkExecutor V1 migration** — stable V1 `query()` API with full control methods (was unstable V2)
- **`canUseTool` callback** — programmatic permission control with access to tool name, arguments, and abort signal
- **In-process MCP tools** — `createSdkMcpServer()` and `sdkTool()` for custom tools without external processes
- **JS hook callbacks** — `hookCallbacks` option with all 21 event types
- **Thinking config** — `{ type: 'adaptive' }`, `{ type: 'enabled', budgetTokens }`, `{ type: 'disabled' }`
- **13 runtime control methods** — `setModel()`, `setPermissionMode()`, `rewindFiles()`, `stopTask()`, `setMcpServers()`, `reconnectMcpServer()`, `toggleMcpServer()`, `accountInfo()`, `supportedModels()`, `supportedCommands()`, `supportedAgents()`, `mcpServerStatus()`, `interrupt()`
- **Per-query abort** — `signal: AbortSignal` on `QueryOptions`
- **Task stream events** — `task_started`, `task_progress`, `task_notification`
- **New options** — `settingSources`, `settings`, `plugins`, `spawnClaudeCodeProcess`, `stderr`, `allowDangerouslySkipPermissions`, `betas`, `onElicitation`, `enableFileCheckpointing`
- **Session utilities** — `listSessions()`, `getSessionMessages()`
- 200 tests (was 122)

### Changed

- SdkExecutor uses V1 `query()` API instead of V2 `unstable_v2_createSession()`
- Manual `.next()` iteration via `readUntilResult()` to prevent generator closure
- `StreamEvent` union expanded with task event types
- Landing page moved from `docs/` to `landing/`

## [0.3.0] - 2026-03-15

### Added

- **StreamHandle** — fluent streaming API returned by `stream()`:
  - `.on(EVENT_TEXT, cb)` — typed event callbacks with chaining
  - `.done()` — consume stream, fire callbacks, return result
  - `.text()` — collect all text into a string
  - `.pipe(writable)` — pipe text to any writable, return result
  - `.toReadable()` — Node.js Readable for `pipeline()`, HTTP responses, file writes
  - `[Symbol.asyncIterator]` — backward-compatible `for await`
- **ChatHandle** — bidirectional streaming via `--input-format stream-json`:
  - `claude.chat()` — persistent CLI process for multi-turn conversation
  - `.send(prompt)` — returns `Promise<StreamResultEvent>`
  - `.toDuplex()` — Node.js Duplex (write prompts, read text)
  - `.toReadable()`, `.pipe()`, `.end()`, `.abort()`
- **Constants** — all 180+ string literals extracted to named constants, exported for client use
- Streaming guide with 27 integration patterns
- 122 tests

### Changed

- `stream()` returns `StreamHandle` instead of `AsyncIterable<StreamEvent>` (backward compatible)
- Zero magic strings in source code

## [0.2.0] - 2026-03-15

### Fixed

- CLI streaming (`--verbose` flag for `stream-json`)
- `systemPrompt` in SDK mode
- `mcpServers` and `hooks` dead code in CLI mode
- `effortLevel` via `--effort` flag instead of env variable

### Added

- Permission mode `auto`, effort level `max`
- `--agent`, `--tools`, `--name`, `--strict-mcp-config` flags
- Comprehensive examples document

## [0.1.0] - 2026-03-10

### Added

- Initial release: `Claude`, `Session`, `ScheduledJob`, `CliExecutor`, `SdkExecutor`
- Full `ClientOptions` covering 45+ CLI flags
- Streaming, structured output, MCP, agents, hooks, worktrees
- Typed error hierarchy
- 82 unit tests
