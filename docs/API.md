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
| `executor` | `IExecutor`     | Custom executor (default: `CliExecutor`)          |

### Methods

#### `query(prompt, options?): Promise<QueryResult>`

Execute a one-shot query and wait for the complete result.

```typescript
const result = await claude.query('Find bugs in auth.ts', {
  model: 'opus',
  maxTurns: 5,
  permissionMode: 'plan',
})
console.log(result.text)
console.log(result.usage)
```

#### `stream(prompt, options?): AsyncIterable<StreamEvent>`

Execute a query with real-time streaming output.

```typescript
for await (const event of claude.stream('Rewrite the module')) {
  switch (event.type) {
    case 'text':     process.stdout.write(event.text); break
    case 'tool_use': console.log(`Tool: ${event.toolName}`); break
    case 'result':   console.log(`Done in ${event.durationMs}ms`); break
    case 'error':    console.error(event.message); break
  }
}
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
const job = claude.loop('5m', 'Check if deployment finished')
job.on('result', (r) => console.log(r.text))
job.on('error', (e) => console.error(e))
job.stop()
```

#### `parallel(queries): Promise<QueryResult[]>`

Run multiple independent queries concurrently.

```typescript
const [bugs, docs] = await claude.parallel([
  { prompt: 'Find bugs', options: { cwd: './src' } },
  { prompt: 'Check docs', options: { permissionMode: 'plan' } },
])
```

#### `abort(): void`

Cancel the currently running execution.

---

## ClientOptions

Options set at client construction time. Act as defaults for all queries.

| Option                | Type                    | Description                                    |
|-----------------------|-------------------------|------------------------------------------------|
| `executable`          | `string`                | Path to CLI binary (default: `'claude'`)       |
| `cwd`                 | `string`                | Working directory (default: `process.cwd()`)   |
| `model`               | `string`                | Model: `'opus'`, `'sonnet'`, `'haiku'`, or full ID |
| `effortLevel`         | `EffortLevel`           | `'low'` \| `'medium'` \| `'high'`             |
| `fallbackModel`       | `string`                | Auto-fallback model on failure                 |
| `permissionMode`      | `PermissionMode`        | Tool approval behavior                         |
| `allowedTools`        | `string[]`              | Auto-approved tools (supports glob patterns)   |
| `disallowedTools`     | `string[]`              | Always-denied tools                            |
| `systemPrompt`        | `string`                | Replace entire system prompt                   |
| `appendSystemPrompt`  | `string`                | Append to default system prompt                |
| `maxTurns`            | `number`                | Max agentic turns per query                    |
| `maxBudget`           | `number`                | Max spend in USD per query                     |
| `additionalDirs`      | `string[]`              | Extra working directories                      |
| `mcpConfig`           | `string \| string[]`    | Path(s) to MCP config files                    |
| `mcpServers`          | `Record<string, McpServerConfig>` | Inline MCP server definitions      |
| `agents`              | `Record<string, AgentConfig>`     | Custom subagent definitions        |
| `hooks`               | `HooksConfig`           | Lifecycle hooks                                |
| `env`                 | `Record<string, string>` | Extra environment variables                   |
| `noSessionPersistence`| `boolean`               | Don't save sessions to disk                    |

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
| `systemPrompt`        | `string`                | Override system prompt                         |
| `appendSystemPrompt`  | `string`                | Override appended system prompt                |
| `maxTurns`            | `number`                | Override max turns                             |
| `maxBudget`           | `number`                | Override max budget                            |
| `input`               | `string`                | Piped stdin data (like `echo data \| claude`)  |
| `schema`              | `object`                | JSON Schema for structured output              |
| `worktree`            | `boolean \| string`     | Run in isolated git worktree                   |
| `additionalDirs`      | `string[]`              | Override additional directories                |
| `env`                 | `Record<string, string>` | Override environment variables                |

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

| Type        | Fields                                        | When                      |
|-------------|-----------------------------------------------|---------------------------|
| `text`      | `text: string`                                | Text chunk received       |
| `tool_use`  | `toolName: string`, `toolInput: object`       | Tool being invoked        |
| `result`    | `text`, `sessionId`, `usage`, `cost`, `durationMs` | Query completed      |
| `error`     | `message: string`, `code?: string`            | Error occurred            |
| `system`    | `subtype: string`, `data: object`             | System/unknown event      |

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
- `stream(prompt, options?)` — Same as `claude.stream()`, but continues the session
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

- `result` — `(result: QueryResult)` — Emitted after each successful query
- `error` — `(error: Error)` — Emitted on query failure
- `tick` — `(count: number)` — Emitted before each execution
- `stop` — Emitted when stopped

### Interval format

| Format   | Example        | Result             |
|----------|---------------|---------------------|
| Seconds  | `'30s'`       | Every 30 seconds    |
| Minutes  | `'5m'`        | Every 5 minutes     |
| Hours    | `'2h'`        | Every 2 hours       |
| Days     | `'1d'`        | Every 24 hours      |
| Raw ms   | `60000`       | Every 60 seconds    |

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
