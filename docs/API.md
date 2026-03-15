# API Reference

## Claude

Main client class. Entry point for all interactions with Claude Code CLI.

### Constructor

```typescript
new Claude(options?: ClientOptions, executor?: IExecutor)
```

| Parameter  | Type            | Description                                      |
|-----------|-----------------|--------------------------------------------------|
| `options`  | `ClientOptions` | Client-level defaults (frozen after construction) |
| `executor` | `IExecutor`     | Custom executor (default: `SdkExecutor`)          |

### Methods

#### `query(prompt, options?): Promise<QueryResult>`

Execute a one-shot query and wait for the complete result.

```typescript
import { Claude, PERMISSION_PLAN } from '@scottwalker/claude-connector'

const claude = new Claude()
const result = await claude.query('Find bugs in auth.ts', {
  model: 'opus',
  maxTurns: 5,
  permissionMode: PERMISSION_PLAN,
})
console.log(result.text)
console.log(result.usage)
```

#### `stream(prompt, options?): StreamHandle`

Execute a query with real-time streaming output. Returns a `StreamHandle` with fluent callbacks, Node.js stream support, and backward-compatible async iteration.

```typescript
import { Claude, EVENT_TEXT, EVENT_TOOL_USE, EVENT_RESULT, EVENT_ERROR } from '@scottwalker/claude-connector'

const claude = new Claude()

// Fluent API
const result = await claude.stream('Rewrite the module')
  .on(EVENT_TEXT, (text) => process.stdout.write(text))
  .on(EVENT_TOOL_USE, (event) => console.log(`Tool: ${event.toolName}`))
  .on(EVENT_RESULT, (event) => console.log(`Done in ${event.durationMs}ms`))
  .on(EVENT_ERROR, (event) => console.error(event.message))
  .done()

// Collect text
const text = await claude.stream('Summarize').text()

// Pipe to stdout
const r = await claude.stream('Explain').pipe(process.stdout)

// Node.js Readable
claude.stream('Generate').toReadable().pipe(createWriteStream('out.txt'))

// Async iteration (backward compat)
for await (const event of claude.stream('Analyze')) { /* ... */ }
```

#### `chat(options?): ChatHandle`

Open a bidirectional streaming channel — a persistent CLI process for multi-turn real-time conversation via `--input-format stream-json`.

```typescript
import { Claude, EVENT_TEXT } from '@scottwalker/claude-connector'

const claude = new Claude({ useSdk: false })
const chat = claude.chat()
  .on(EVENT_TEXT, (text) => process.stdout.write(text))

const r1 = await chat.send('What files are in src?')
const r2 = await chat.send('Fix the largest file')
chat.end()
```

#### `session(options?): Session`

Create a multi-turn conversation session.

```typescript
const session = claude.session()
await session.query('Analyze the codebase')
await session.query('Now refactor the auth module')  // remembers context
```

#### `loop(interval, prompt, options?): ScheduledJob`

Schedule a recurring query (equivalent of CLI `/loop`).

```typescript
import { Claude, SCHED_RESULT, SCHED_ERROR } from '@scottwalker/claude-connector'

const claude = new Claude()
const job = claude.loop('5m', 'Check if deployment finished')
job.on(SCHED_RESULT, (r) => console.log(r.text))
job.on(SCHED_ERROR, (e) => console.error(e))
job.stop()
```

#### `parallel(queries): Promise<QueryResult[]>`

Run multiple independent queries concurrently.

```typescript
import { Claude, PERMISSION_PLAN } from '@scottwalker/claude-connector'

const claude = new Claude()
const [bugs, docs] = await claude.parallel([
  { prompt: 'Find bugs', options: { cwd: './src' } },
  { prompt: 'Check docs', options: { permissionMode: PERMISSION_PLAN } },
])
```

#### `init(): Promise<void>`

Initialize the SDK session (warm up). Only needed when `useSdk: true` (default). In CLI mode this is a no-op.

#### `abort(): void`

Cancel the currently running execution.

#### `close(): void`

Close the SDK session and free resources.

---

## ClientOptions

Options set at client construction time. Act as defaults for all queries.

| Option                | Type                    | Description                                     |
|-----------------------|-------------------------|-------------------------------------------------|
| `useSdk`              | `boolean`               | Use Agent SDK (default: `true`) or CLI mode     |
| `executable`          | `string`                | Path to CLI binary (default: `DEFAULT_EXECUTABLE`) |
| `cwd`                 | `string`                | Working directory (default: `process.cwd()`)    |
| `model`               | `string`                | Model: `'opus'`, `'sonnet'`, `'haiku'`, or full ID |
| `effortLevel`         | `EffortLevel`           | `EFFORT_LOW` \| `EFFORT_MEDIUM` \| `EFFORT_HIGH` \| `EFFORT_MAX` |
| `fallbackModel`       | `string`                | Auto-fallback model on failure                  |
| `permissionMode`      | `PermissionMode`        | Tool approval behavior                          |
| `allowedTools`        | `string[]`              | Auto-approved tools (supports glob patterns)    |
| `disallowedTools`     | `string[]`              | Always-denied tools                             |
| `tools`               | `string[]`              | Restrict available built-in tools (`--tools`)   |
| `systemPrompt`        | `string`                | Replace entire system prompt                    |
| `appendSystemPrompt`  | `string`                | Append to default system prompt                 |
| `maxTurns`            | `number`                | Max agentic turns per query                     |
| `maxBudget`           | `number`                | Max spend in USD per query                      |
| `additionalDirs`      | `string[]`              | Extra working directories                       |
| `mcpConfig`           | `string \| string[]`    | Path(s) to MCP config files                     |
| `mcpServers`          | `Record<string, McpServerConfig>` | Inline MCP server definitions       |
| `agents`              | `Record<string, AgentConfig>`     | Custom subagent definitions         |
| `agent`               | `string`                | Select preconfigured agent (`--agent`)          |
| `hooks`               | `HooksConfig`           | Lifecycle hooks                                 |
| `env`                 | `Record<string, string>` | Extra environment variables                    |
| `noSessionPersistence`| `boolean`               | Don't save sessions to disk                     |
| `name`                | `string`                | Display name for the session (`--name`)         |
| `strictMcpConfig`     | `boolean`               | Ignore MCP servers not in `mcpConfig`           |

---

## QueryOptions

Per-query overrides. Any field set here takes precedence over `ClientOptions`.

| Option                | Type                    | Description                                    |
|-----------------------|-------------------------|------------------------------------------------|
| `cwd`                 | `string`                | Override working directory                     |
| `model`               | `string`                | Override model                                 |
| `effortLevel`         | `EffortLevel`           | Override effort level                          |
| `permissionMode`      | `PermissionMode`        | Override permission mode                       |
| `allowedTools`        | `string[]`              | Override allowed tools                         |
| `disallowedTools`     | `string[]`              | Override disallowed tools                      |
| `tools`               | `string[]`              | Override available built-in tools              |
| `systemPrompt`        | `string`                | Override system prompt                         |
| `appendSystemPrompt`  | `string`                | Override appended system prompt                |
| `maxTurns`            | `number`                | Override max turns                             |
| `maxBudget`           | `number`                | Override max budget                            |
| `input`               | `string`                | Piped stdin data (like `echo data \| claude`)  |
| `schema`              | `object`                | JSON Schema for structured output              |
| `worktree`            | `boolean \| string`     | Run in isolated git worktree                   |
| `additionalDirs`      | `string[]`              | Override additional directories                |
| `env`                 | `Record<string, string>` | Override environment variables                |
| `agent`               | `string`                | Override agent for this query                  |

---

## StreamHandle

Returned from `stream()` and `session.stream()`. Provides four ways to consume streaming output.

### Methods

| Method | Returns | Description |
|--------|---------|-------------|
| `.on(type, callback)` | `this` | Register typed callback. Chainable. |
| `.done()` | `Promise<StreamResultEvent>` | Consume stream, fire callbacks, return result. |
| `.text()` | `Promise<string>` | Collect all text chunks into a string. |
| `.pipe(writable)` | `Promise<StreamResultEvent>` | Pipe text to writable, return result. |
| `.toReadable()` | `Readable` | Get Node.js Readable (text mode). |
| `[Symbol.asyncIterator]` | `AsyncIterator<StreamEvent>` | Raw async iteration. |

### Event callbacks

| Event | Constant | Callback | Description |
|-------|----------|----------|-------------|
| `'text'` | `EVENT_TEXT` | `(text: string)` | Text chunk |
| `'tool_use'` | `EVENT_TOOL_USE` | `(event: StreamToolUseEvent)` | Tool invocation |
| `'result'` | `EVENT_RESULT` | `(event: StreamResultEvent)` | Final result |
| `'error'` | `EVENT_ERROR` | `(event: StreamErrorEvent)` | Error |
| `'system'` | `EVENT_SYSTEM` | `(event: StreamSystemEvent)` | System event |

---

## ChatHandle

Returned from `chat()`. Bidirectional streaming over a persistent CLI process.

### Properties

| Property | Type | Description |
|----------|------|-------------|
| `sessionId` | `string \| null` | Session ID (after first result) |
| `turnCount` | `number` | Completed turns |
| `closed` | `boolean` | Whether chat is closed |

### Methods

| Method | Returns | Description |
|--------|---------|-------------|
| `.send(prompt)` | `Promise<StreamResultEvent>` | Send prompt, await turn completion. |
| `.on(type, callback)` | `this` | Register callback (same events as StreamHandle). |
| `.pipe(dest)` | `dest` | Pipe text to writable (returns dest for chaining). |
| `.toReadable()` | `Readable` | Get Node.js Readable (text mode). |
| `.toDuplex()` | `Duplex` | Get Node.js Duplex (write prompts, read text). |
| `.end()` | `void` | Close gracefully (EOF to stdin). |
| `.abort()` | `void` | Kill process immediately (SIGTERM). |

---

## QueryResult

Returned from `query()`.

| Field        | Type               | Description                          |
|-------------|--------------------|-----------------------------------------|
| `text`       | `string`           | Text response from Claude               |
| `sessionId`  | `string`           | Session ID for resuming                 |
| `usage`      | `TokenUsage`       | `{ inputTokens, outputTokens }`        |
| `cost`       | `number \| null`   | Cost in USD                             |
| `durationMs` | `number`           | Wall-clock duration                     |
| `messages`   | `Message[]`        | Full conversation history               |
| `structured` | `unknown \| null`  | Structured output (when schema is used) |
| `raw`        | `object`           | Raw CLI JSON (for advanced use)         |

---

## StreamEvent

Discriminated union yielded by `stream()`. Check `event.type` to narrow.

| Type | Constant | Fields | When |
|------|----------|--------|------|
| `'text'` | `EVENT_TEXT` | `text: string` | Text chunk received |
| `'tool_use'` | `EVENT_TOOL_USE` | `toolName: string`, `toolInput: object` | Tool being invoked |
| `'result'` | `EVENT_RESULT` | `text`, `sessionId`, `usage`, `cost`, `durationMs` | Query completed |
| `'error'` | `EVENT_ERROR` | `message: string`, `code?: string` | Error occurred |
| `'system'` | `EVENT_SYSTEM` | `subtype: string`, `data: object` | System/unknown event |

---

## Session

Multi-turn conversation wrapper. Created via `claude.session()`.

### Properties

| Property     | Type             | Description                              |
|-------------|------------------|------------------------------------------|
| `sessionId`  | `string \| null` | Current session ID (null until first query) |
| `queryCount` | `number`         | Number of queries executed               |

### Methods

- `query(prompt, options?)` — Same as `claude.query()`, but continues the session
- `stream(prompt, options?)` — Returns `StreamHandle`, continues the session
- `abort()` — Cancel the running query

### SessionOptions

| Option     | Type      | Description                              |
|-----------|-----------|------------------------------------------|
| `resume`   | `string`  | Resume an existing session by ID         |
| `fork`     | `boolean` | Fork instead of continuing in-place      |
| `continue` | `boolean` | Continue the most recent session         |

---

## ScheduledJob

Recurring query job. Created via `claude.loop()`.

### Properties

| Property     | Type      | Description                |
|-------------|-----------|----------------------------|
| `intervalMs` | `number`  | Interval in milliseconds   |
| `prompt`     | `string`  | Query to execute           |
| `tickCount`  | `number`  | Number of executions       |
| `running`    | `boolean` | Is a query currently active |
| `stopped`    | `boolean` | Has the job been stopped   |

### Methods

- `stop()` — Stop the scheduled job

### Events

| Event | Constant | Callback | Description |
|-------|----------|----------|-------------|
| `'result'` | `SCHED_RESULT` | `(result: QueryResult)` | After each successful query |
| `'error'` | `SCHED_ERROR` | `(error: Error)` | On query failure |
| `'tick'` | `SCHED_TICK` | `(count: number)` | Before each execution |
| `'stop'` | `SCHED_STOP` | `()` | When stopped |

### Interval format

| Format   | Example        | Result             |
|----------|---------------|---------------------|
| Seconds  | `'30s'`       | Every 30 seconds    |
| Minutes  | `'5m'`        | Every 5 minutes     |
| Hours    | `'2h'`        | Every 2 hours       |
| Days     | `'1d'`        | Every 24 hours      |
| Raw ms   | `60000`       | Every 60 seconds    |

---

## Constants

All string literals are exported as constants. Use them instead of raw strings.

```typescript
import {
  // Event types
  EVENT_TEXT, EVENT_TOOL_USE, EVENT_RESULT, EVENT_ERROR, EVENT_SYSTEM,
  // Permission modes
  PERMISSION_DEFAULT, PERMISSION_ACCEPT_EDITS, PERMISSION_PLAN,
  PERMISSION_AUTO, PERMISSION_DONT_ASK, PERMISSION_BYPASS,
  // Effort levels
  EFFORT_LOW, EFFORT_MEDIUM, EFFORT_HIGH, EFFORT_MAX,
  // Scheduler events
  SCHED_RESULT, SCHED_ERROR, SCHED_TICK, SCHED_STOP,
  // Defaults
  DEFAULT_EXECUTABLE, DEFAULT_MODEL, DEFAULT_TIMEOUT_MS,
} from '@scottwalker/claude-connector'
```

---

## Errors

All errors extend `ClaudeConnectorError`.

| Error                | When                                        | Extra fields          |
|----------------------|---------------------------------------------|-----------------------|
| `CliNotFoundError`   | CLI binary not found at specified path       | `executable`          |
| `CliExecutionError`  | CLI exited with non-zero code                | `exitCode`, `stderr`  |
| `CliTimeoutError`    | CLI exceeded timeout                         | `timeoutMs`           |
| `ParseError`         | CLI output couldn't be parsed                | `rawOutput`           |
| `ValidationError`    | Invalid options or prompt                    | `field`               |

```typescript
import { ClaudeConnectorError, CliNotFoundError } from '@scottwalker/claude-connector'

try {
  await claude.query('...')
} catch (e) {
  if (e instanceof CliNotFoundError) {
    console.error(`Install Claude Code or set executable path`)
  } else if (e instanceof ClaudeConnectorError) {
    console.error(`Claude connector error: ${e.message}`)
  }
}
```

---

## IExecutor

Low-level executor interface. Implement this to add new transport backends.

```typescript
interface IExecutor {
  execute(args: string[], options: ExecuteOptions): Promise<QueryResult>
  stream(args: string[], options: ExecuteOptions): AsyncIterable<StreamEvent>
  abort?(): void
}

interface ExecuteOptions {
  cwd: string
  env: Record<string, string>
  input?: string
  systemPrompt?: string
}
```

### Custom executor example

```typescript
import { Claude, type IExecutor } from '@scottwalker/claude-connector'

class MyExecutor implements IExecutor {
  async execute(args, options) { /* ... */ }
  async *stream(args, options) { /* ... */ }
}

const claude = new Claude({ model: 'opus' }, new MyExecutor())
```
