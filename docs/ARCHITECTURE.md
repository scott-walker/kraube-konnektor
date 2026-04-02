# Architecture

## Overview

`kraube-konnektor` is a programmatic Node.js interface for Claude Code. It supports two execution modes: **SDK mode** (default, uses the Claude Agent SDK in-process) and **CLI mode** (spawns `claude -p` per query). The SDK provides a clean TypeScript API for building integrations with persistent sessions, control methods, and programmatic permission handling.

```
┌──────────────────────────────────────────────────────────────────┐
│                        Consumer Code                             │
│                                                                  │
│  const claude = new Claude({ model: 'sonnet' })                  │
│  const result = await claude.query('Fix the bug')                │
└──────────────────┬───────────────────────────────────────────────┘
                   │
                   ▼
┌──────────────────────────────────────────────────────────────────┐
│                     Claude (Facade)                              │
│                                                                  │
│  Orchestrates all components. Validates input. Merges options.   │
│  Delegates execution. Proxies SDK control methods.               │
│  Exposes: query, stream, chat, session, loop, parallel.          │
│  SDK control: setModel, setPermissionMode, stopTask, etc.        │
└──────┬────────────────────┬──────────────────────┬───────────────┘
       │                    │                      │
       ▼                    ▼                      ▼
┌─────────────┐    ┌──────────────┐    ┌────────────────────┐
│ ArgsBuilder │    │  IExecutor   │    │     Session        │
│             │    │  (interface) │    │                    │
│ Converts    │    │              │    │ Multi-turn state   │
│ options →   │    │  ┌────────┐  │    │ management via     │
│ CLI args    │    │  │  SDK   │  │    │ --resume/--continue│
│ (constants) │    │  │Executor│  │    │                    │
│             │    │  └───┬────┘  │    │ Returns StreamHandle│
└─────────────┘    │      │       │    └────────────────────┘
                   │      │ V1    │
                   │      │query()│    ┌────────────────────┐
                   │      ▼       │    │   StreamHandle     │
                   │  ┌────────┐  │    │   (Readable)       │
                   │  │ Query  │  │    │                    │
                   │  │ object │  │    │   .on() .done()    │
                   │  │        │  │    │   .text() .pipe()  │
                   │  │ 13 ctrl│  │    │   .toReadable()    │
                   │  │ methods│  │    └────────────────────┘
                   │  └────────┘  │
                   │  ┌────────┐  │    ┌────────────────────┐
                   │  │  CLI   │  │    │   ChatHandle       │
                   │  │Executor│  │    │   (Duplex)         │
                   │  └───┬────┘  │    │                    │
                   └──────┼───────┘    │   .send() .pipe()  │
                          │            │   .toReadable()    │
                          ▼            │   .toDuplex()      │
              ┌───────────────────┐    └────────────────────┘
              │   CLI Process     │
              │   claude -p "..." │
              │   --output-format │
              │   stream-json     │
              └───────────────────┘
```

## Design Principles

### 1. SOLID

**Single Responsibility**:
- `Claude` — facade, delegates everything, proxies SDK control methods
- `ArgsBuilder` — only converts options to CLI args (using constants from `constants.ts`)
- `SdkExecutor` — manages persistent SDK session via V1 `query()` API (default)
- `CliExecutor` — only spawns and manages CLI processes
- `InputController` — controllable async iterable for multi-turn message delivery
- `Session` — only tracks session state
- `StreamHandle` — fluent streaming API + Node.js Readable bridge
- `ChatHandle` — bidirectional streaming + Node.js Duplex bridge
- `Scheduler` — only manages recurring execution
- Parsers — only parse CLI output

**Open/Closed**:
- New execution backends are added by implementing `IExecutor` — no changes to existing code.
- New CLI flags are added to `ArgsBuilder` — parsers and executor remain unchanged.
- New stream consumers are added via `StreamHandle.on()` — no core changes needed.
- New control methods are added to `SdkExecutor` by delegating to the `Query` object.

**Liskov Substitution**:
- Any `IExecutor` implementation can replace `SdkExecutor`/`CliExecutor` without breaking the client.

**Interface Segregation**:
- `IExecutor` has only 3 methods: `execute`, `stream`, `abort`.
- SDK control methods live on `SdkExecutor` (not on `IExecutor`) — CLI mode callers are never burdened with SDK-only methods.
- Types are split into focused files: `client.ts`, `result.ts`, `session.ts`.

**Dependency Inversion**:
- `Claude` depends on `IExecutor` (abstraction), not `SdkExecutor` (implementation).
- Constructor injection: `new Claude(options, customExecutor)`.

### 2. No Magic Strings

All string literals (event types, CLI flags, permission modes, etc.) are centralized in `constants.ts`. Source files import named constants — no hardcoded strings anywhere in the codebase.

### 3. DRY

- Option merging logic is centralized in `mergeOptions()`.
- Validation is centralized in `utils/validation.ts`, referencing `VALID_PERMISSION_MODES` and `VALID_EFFORT_LEVELS` from constants.
- Error hierarchy has a single base class.
- Event dispatching logic is shared between `StreamHandle` and `ChatHandle`.

## Layer Map

```
src/
├── constants.ts          All string constants (events, flags, keys, modes)
├── index.ts              Public API surface (re-exports)
├── types/                Type definitions (no runtime code)
│   ├── client.ts         ClientOptions, QueryOptions, PermissionMode, EffortLevel,
│   │                     CanUseTool, HookEvent, HookCallbackMatcher, ThinkingConfig,
│   │                     McpServerConfig, McpSdkServerConfig, AgentConfig, PluginConfig
│   ├── result.ts         QueryResult, StreamEvent, TokenUsage, Message,
│   │                     AccountInfo, ModelInfo, McpServerStatus, RewindFilesResult,
│   │                     StreamTaskStartedEvent, StreamTaskProgressEvent,
│   │                     StreamTaskNotificationEvent
│   └── session.ts        SessionOptions, SessionInfo
├── executor/             Execution abstraction
│   ├── interface.ts      IExecutor, ExecuteOptions
│   ├── sdk-executor.ts   SDK implementation (V1 query API, persistent session, default)
│   │                     InputController, readUntilResult(), 13 control methods
│   └── cli-executor.ts   CLI implementation (spawn per query)
├── builder/              Options → CLI args
│   └── args-builder.ts   buildArgs(), mergeOptions(), resolveEnv()
├── parser/               CLI output → typed objects
│   ├── json-parser.ts    JSON mode parsing
│   └── stream-parser.ts  NDJSON stream parsing
├── client/               High-level API
│   ├── claude.ts         Claude class (facade + SDK control method proxies)
│   ├── session.ts        Session class (stateful wrapper)
│   ├── stream-handle.ts  StreamHandle (fluent API + Node.js Readable)
│   └── chat-handle.ts    ChatHandle (bidirectional + Node.js Duplex)
├── scheduler/            Recurring execution (/loop equivalent)
│   └── scheduler.ts      Scheduler, ScheduledJob
├── errors/               Error hierarchy
│   └── errors.ts         All error classes
└── utils/                Shared utilities
    └── validation.ts     Input validation
```

## Key Abstractions

### IExecutor (executor/interface.ts)

The central abstraction that decouples the public API from the transport mechanism.

**Why it exists**: Today there are two executors — `SdkExecutor` (persistent SDK session, default) and `CliExecutor` (spawns `claude -p` per query). Tomorrow, Anthropic may ship an HTTP API or Unix socket interface. By coding against `IExecutor`, only a new implementation is needed.

**Contract**:
- `execute(args, options)` → `Promise<QueryResult>` (run to completion)
- `stream(args, options)` → `AsyncIterable<StreamEvent>` (incremental)
- `abort()` → `void` (cancel running execution)

**Invariants**:
- Error conditions throw `KraubeKonnektorError` subclasses
- Arguments are fully resolved (no option merging in the executor)

### SdkExecutor (executor/sdk-executor.ts)

Persistent in-process session using the Claude Agent SDK V1 `query()` API. This is the default executor.

**Why V1 instead of V2**: The V2 `SDKSession` API (`unstable_v2_createSession()`) is marked as unstable (`@alpha`) and only exposes `send()` + `stream()`. The V1 `query()` API returns a `Query` object with full control methods: `setModel`, `setPermissionMode`, `rewindFiles`, `stopTask`, `setMcpServers`, `accountInfo`, `supportedModels`, and more.

**Lifecycle**:
```
const executor = new SdkExecutor({ model: 'sonnet' })
await executor.init()          // warm up (emits stage events)
executor.execute(args, opts)   // fast — session already running
executor.execute(args, opts)   // fast — reuses InputController
executor.close()               // cleanup
```

**Multi-turn via InputController**: The V1 `query()` accepts an `AsyncIterable<SDKUserMessage>` as the `prompt` parameter. `InputController` is a controllable async iterable — each `execute()` / `stream()` call pushes a user message into the iterable, and the SDK consumes it. This avoids spawning a new process per query.

```
InputController                     Query (V1 API)
┌──────────────┐                   ┌──────────────┐
│ .push(msg)  ─┼──── iterable ───►│ reads prompt │
│              │                   │              │
│ queue[]      │                   │ yields       │
│ resolve()    │                   │ SDKMessage   │
│ .close()     │                   │ events       │
└──────────────┘                   └──────────────┘
```

**readUntilResult() pattern**: A critical implementation detail. The SDK `Query` object is an `AsyncGenerator`. Using `for await ... break` would call the generator's `.return()` method, closing it permanently and preventing session reuse. Instead, `readUntilResult()` uses manual `.next()` calls in a `while` loop, stopping when the callback returns `true` (on a result event) without ever closing the generator.

```ts
// WRONG — for-await calls .return() on break, killing the session
for await (const msg of query) {
  if (msg.type === 'result') break; // closes generator!
}

// RIGHT — manual .next() preserves the generator for reuse
while (true) {
  const { value, done } = await query.next();
  if (done) break;
  if (onMessage(value)) break; // generator stays open
}
```

**Control Methods (13)**: `SdkExecutor` exposes methods that delegate directly to the `Query` object:

| Method | Description |
|---|---|
| `setModel(model?)` | Change model for subsequent responses |
| `setPermissionMode(mode)` | Change permission mode |
| `rewindFiles(messageId, opts?)` | Rewind files to a checkpoint |
| `stopTask(taskId)` | Stop a running subagent task |
| `setMcpServers(servers)` | Dynamically set MCP servers |
| `reconnectMcpServer(name)` | Reconnect a disconnected MCP server |
| `toggleMcpServer(name, enabled)` | Enable/disable an MCP server |
| `accountInfo()` | Get account info (email, org, subscription) |
| `supportedModels()` | List available models |
| `supportedCommands()` | List available slash commands |
| `supportedAgents()` | List available subagents |
| `mcpServerStatus()` | Get MCP server connection statuses |
| `interrupt()` | Interrupt current query execution |

The `Claude` facade proxies all 13 methods, throwing a descriptive error in CLI mode.

### StreamHandle (client/stream-handle.ts)

Wraps an `AsyncIterable<StreamEvent>` with a fluent API and Node.js stream bridge.

**Why it exists**: Raw `for await` loops require boilerplate for common patterns (collect text, pipe to stdout, track progress). `StreamHandle` provides `.on().done()`, `.text()`, `.pipe()`, and `.toReadable()` for these cases, while preserving `for await` backward compatibility.

### ChatHandle (client/chat-handle.ts)

Manages a persistent CLI process with `--input-format stream-json` for bidirectional streaming.

**Why it exists**: One-shot `stream()` spawns a process per query. For multi-turn conversations where latency matters, `ChatHandle` keeps one process alive and sends messages via stdin. It provides `.send()` (Promise-based), `.toDuplex()` (Node.js Duplex), and the same `.on()` fluent API as `StreamHandle`.

### ArgsBuilder (builder/args-builder.ts)

Purely functional module that converts typed options into CLI argument arrays.

**Why it's separate**: Argument building is a distinct concern from execution. All CLI flag strings come from `constants.ts` — no hardcoded flags in the builder.

### Constants (constants.ts)

Single source of truth for all string literals: event types, CLI flags, JSON protocol keys, permission modes, effort levels, error names, etc. Every module imports from here — zero magic strings in the codebase.

## Data Flow

### query() — Synchronous request

```
claude.query('Find bugs', { model: 'opus' })
  │
  ├─ validate prompt & options
  ├─ mergeOptions(clientOpts, queryOpts, { outputFormat: FORMAT_JSON })
  ├─ buildArgs(resolvedOptions) → [FLAG_PRINT, FLAG_OUTPUT_FORMAT, FORMAT_JSON, ...]
  ├─ resolveEnv(clientOpts, queryOpts)
  │
  └─ executor.execute(args, { cwd, env, input, systemPrompt })
       │
       │  SDK mode:                          CLI mode:
       │  ┌─────────────────────────┐       ┌─────────────────────────┐
       │  │ inputController.push()  │       │ spawn(executable, args) │
       │  │ readUntilResult(query)  │       │ collect stdout          │
       │  │ mapMessage() → events   │       │ wait for exit           │
       │  └─────────────────────────┘       │ parseJsonResult()       │
       │                                     └─────────────────────────┘
       └─→ QueryResult
```

### stream() — Streaming request

```
claude.stream('Rewrite module')
  │
  ├─ validate & merge (outputFormat: FORMAT_STREAM_JSON)
  │
  └─ new StreamHandle(() => executor.stream(args, options))
       │
       ├─ .on(EVENT_TEXT, cb)     → register callback
       ├─ .on(EVENT_TOOL_USE, cb) → register callback
       ├─ .on(EVENT_TASK_STARTED, cb) → subagent lifecycle
       ├─ .done()                 → consume iterable, dispatch events
       │     │
       │     │  SDK mode: manual .next() on Query, mapMessage()
       │     │  CLI mode: for each NDJSON line, parseStreamLine()
       │     │
       │     └─ dispatch to registered callbacks
       │
       ├─ .text()                 → collect text, return string
       ├─ .pipe(writable)         → pipe text, return result
       └─ .toReadable()           → Node.js Readable (text mode)
```

### chat() — Bidirectional streaming

```
claude.chat()
  │
  ├─ buildArgs({ inputFormat: FORMAT_STREAM_JSON, ... })
  │
  └─ new ChatHandle(executable, args, { cwd, env })
       │
       ├─ spawn process with stdin open
       ├─ .send(prompt) → write JSON to stdin, await result
       ├─ stdout → parseStreamLine → dispatch to callbacks
       ├─ .toDuplex() → Node.js Duplex (write prompts, read text)
       └─ .end() → close stdin → process exits
```

### SDK init() — Session warm-up

```
executor.init()
  │
  ├─ Stage 1: import('@anthropic-ai/claude-agent-sdk')
  │
  ├─ Stage 2: Create InputController + build SDK options
  │    └─ sdkModule.query({ prompt: inputController.iterable, options })
  │
  ├─ Stage 3: Push init message, readUntilResult() until system/init
  │    └─ Emits INIT_EVENT_STAGE events for progress tracking
  │
  └─ Stage 4: _ready = true, emit INIT_EVENT_READY
```

## Hook Systems

There are two independent hook systems for different execution modes:

### hooks (CLI mode — shell commands)

Defined via `ClientOptions.hooks`. Each hook entry specifies a shell command that is executed by the CLI process. Configured in `HooksConfig` with matchers for tool names.

```ts
new Claude({
  hooks: {
    PreToolUse: [{ matcher: 'Bash', hooks: [{ command: 'echo "Bash used"' }] }],
  },
})
```

### hookCallbacks (SDK mode — JS functions)

Defined via `ClientOptions.hookCallbacks`. Each callback is an async JS function that runs in-process. Supports all 21 hook event types (`PreToolUse`, `PostToolUse`, `PostToolUseFailure`, `Notification`, `UserPromptSubmit`, `SessionStart`, `SessionEnd`, `Stop`, `SubagentStart`, `SubagentStop`, `PreCompact`, `PermissionRequest`, `Setup`, `TeammateIdle`, `TaskCompleted`, `Elicitation`, `ElicitationResult`, `ConfigChange`, `WorktreeCreate`, `WorktreeRemove`, `InstructionsLoaded`).

```ts
new Claude({
  hookCallbacks: {
    PreToolUse: [{
      matcher: 'Bash',
      hooks: [async (input) => ({ continue: true })],
    }],
  },
})
```

## Permission Control

### canUseTool (SDK mode)

Programmatic permission callback at the executor level. Called before each tool execution with the tool name, input, and context (abort signal, suggestions, tool use ID, agent ID). Returns `{ behavior: 'allow' }`, `{ behavior: 'deny', message }`, or `{ behavior: 'ask' }`.

```ts
new Claude({
  canUseTool: async (toolName, input, { signal }) => {
    if (toolName === 'Bash' && String(input.command).includes('rm -rf'))
      return { behavior: 'deny', message: 'Dangerous command blocked' }
    return { behavior: 'allow' }
  },
})
```

This is separate from `permissionMode` (which sets coarse-grained policy) and `allowedTools`/`disallowedTools` (which set static rules). `canUseTool` provides dynamic, context-aware decisions.

## In-Process MCP Servers

The `McpSdkServerConfig` type (`type: 'sdk'`) allows running MCP servers in the same process as the SDK session. Created via `createSdkMcpServer()` from the SDK. Unlike stdio/http/sse MCP servers which run as separate processes, SDK-type servers share the Node.js event loop with the executor.

```ts
new Claude({
  mcpServers: {
    'my-server': { type: 'sdk', name: 'my-server', instance: sdkMcpServer },
    'remote':    { type: 'http', url: 'https://...' },
  },
})
```

## Task Events (Subagent Lifecycle)

Three event types track the lifecycle of subagent tasks:

| Event | When | Key fields |
|---|---|---|
| `task_started` | Subagent task begins | `taskId`, `toolUseId`, `description`, `taskType`, `prompt` |
| `task_progress` | Periodic progress update | `taskId`, `usage`, `lastToolName`, `summary` |
| `task_notification` | Task completes/fails/stops | `taskId`, `status`, `outputFile`, `summary`, `usage` |

These are emitted as `StreamEvent` subtypes and can be captured via `StreamHandle.on()`:

```ts
claude.stream('Run tests')
  .on('task_started', (e) => console.log(`Task ${e.taskId}: ${e.description}`))
  .on('task_progress', (e) => console.log(`Progress: ${e.description}`))
  .on('task_notification', (e) => console.log(`Done: ${e.status}`))
  .done()
```

Use `stopTask(taskId)` to cancel a running task.

## Error Handling Strategy

```
KraubeKonnektorError          Base class (catch-all)
├── CliNotFoundError          Binary not found (ERR_ENOENT)
├── CliExecutionError         Non-zero exit code
├── CliTimeoutError           Process exceeded DEFAULT_TIMEOUT_MS
├── ParseError                Unexpected CLI output format
└── ValidationError           Invalid options/input
```

**Philosophy**: Fail fast with descriptive messages. Each error class carries contextual data (exit code, stderr, raw output) for debugging. Error class names use constants from `ERR_NAME_*`.

## Testing Strategy

- **Unit tests**: Every module is tested in isolation using mock executors.
- **No real CLI calls in tests**: `IExecutor` is mocked, so tests run instantly.
- **Parser tests**: Cover both happy paths and edge cases (missing fields, malformed JSON).
- **Session tests**: Verify state management (session ID tracking, query counting, flag selection).
- **StreamHandle tests**: Verify `.on()`, `.done()`, `.text()`, `.pipe()`, `.toReadable()`, and `for await`.
- **ChatHandle tests**: Verify lifecycle (properties, close, abort, send-after-close).
- **Scheduler tests**: Use `vi.useFakeTimers()` for deterministic timing.
- **200 tests** across 12 test files.

## Future Extensibility

### Adding new CLI flags

1. Add the constant to `constants.ts`
2. Add the option to `ClientOptions` and/or `QueryOptions` in `types/client.ts`
3. Add merging logic in `mergeOptions()` in `builder/args-builder.ts`
4. Add argument building in `buildArgs()` using the constant
5. Add tests
6. No changes needed in executor, parser, or client classes

### Adding new stream event types

1. Add the constant to `constants.ts`
2. Add the type to the `StreamEvent` union in `types/result.ts`
3. Add parsing logic in `stream-parser.ts` (CLI mode) and `mapMessage()` in `sdk-executor.ts` (SDK mode)
4. Add dispatch case in `StreamHandle` and `ChatHandle`
5. Unknown types are already forwarded as `EVENT_SYSTEM` events, so existing code won't break

### Adding new SDK control methods

1. Add the method to `SdkExecutor`, delegating to `this.activeQuery!.methodName()`
2. Add a proxy method to `Claude` with `this.requireSdk()` guard
3. Add type definitions in `types/result.ts` if new return types are needed
4. No changes to `IExecutor` — control methods are SDK-specific
