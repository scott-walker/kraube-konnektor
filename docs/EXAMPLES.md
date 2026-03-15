# Examples

Complete cookbook covering every feature of `@scottwalker/claude-connector`.

All examples use ESM imports:

```ts
import { Claude } from '@scottwalker/claude-connector'
```

---

## Table of Contents

- [Execution Modes](#execution-modes)
- [Basic Query](#basic-query)
- [Streaming](#streaming)
- [StreamHandle API](#streamhandle-api)
- [Chat](#chat)
- [Sessions](#sessions)
- [Parallel Queries](#parallel-queries)
- [Scheduled Queries (Loop)](#scheduled-queries-loop)
- [Model Selection](#model-selection)
- [Effort Level](#effort-level)
- [System Prompt](#system-prompt)
- [Permission Modes](#permission-modes)
- [Tool Control](#tool-control)
- [Structured Output (JSON Schema)](#structured-output-json-schema)
- [Piped Input (stdin)](#piped-input-stdin)
- [Additional Directories](#additional-directories)
- [Git Worktree Isolation](#git-worktree-isolation)
- [MCP Servers](#mcp-servers)
- [Agents](#agents)
- [Hooks](#hooks)
- [Environment Variables](#environment-variables)
- [Session Persistence](#session-persistence)
- [Session Name](#session-name)
- [Abort](#abort)
- [SDK Lifecycle](#sdk-lifecycle)
- [Custom Executable](#custom-executable)
- [Per-Query Overrides](#per-query-overrides)
- [Error Handling](#error-handling)
- [QueryResult Fields](#queryresult-fields)
- [Stream Events](#stream-events)
- [Thinking Config](#thinking-config)
- [Programmatic Permissions (canUseTool)](#programmatic-permissions-canusetool)
- [In-Process MCP Tools](#in-process-mcp-tools)
- [JS Hook Callbacks](#js-hook-callbacks)
- [Runtime Model & Permission Switch](#runtime-model--permission-switch)
- [Dynamic MCP](#dynamic-mcp)
- [File Checkpointing](#file-checkpointing)
- [Account & Model Info](#account--model-info)
- [Per-Query Abort (signal)](#per-query-abort-signal)
- [Subagent Control](#subagent-control)
- [Settings & Plugins](#settings--plugins)
- [Custom Process Spawn](#custom-process-spawn)
- [Session Utilities](#session-utilities)
- [Stderr Monitoring](#stderr-monitoring)
- [Bypass Permissions](#bypass-permissions)
- [Advanced: Custom Executor](#advanced-custom-executor)

---

## Execution Modes

### SDK mode (default)

Persistent session via Claude Agent SDK. Fast after warm-up. SDK mode is enabled by default (`useSdk: true`).

```ts
const claude = new Claude({ model: 'sonnet' })

// Optional: warm up explicitly
await claude.init()

const result = await claude.query('Find bugs in src/')
console.log(result.text)

// Cleanup when done
claude.close()
```

### CLI mode

Each query spawns a new `claude -p` process. No warm-up, but slower per-query.

```ts
const claude = new Claude({
  useSdk: false,
  model: 'sonnet',
})

const result = await claude.query('Find bugs in src/')
console.log(result.text)
```

---

## Basic Query

```ts
const claude = new Claude()

const result = await claude.query('Explain what src/index.ts does')

console.log(result.text)        // Claude's response text
console.log(result.sessionId)   // "abc-123-..." — for resuming later
console.log(result.usage)       // { inputTokens: 1500, outputTokens: 800 }
console.log(result.cost)        // 0.012 or null
console.log(result.durationMs)  // 3200
console.log(result.messages)    // full message history
```

---

## Streaming

Real-time response as events arrive. The `stream()` method returns a `StreamHandle`.

```ts
import {
  Claude,
  StreamHandle,
  EVENT_TEXT,
  EVENT_TOOL_USE,
  EVENT_RESULT,
  EVENT_ERROR,
  EVENT_SYSTEM,
} from '@scottwalker/claude-connector'

const claude = new Claude()

const handle: StreamHandle = claude.stream('Refactor auth.ts')

for await (const event of handle) {
  switch (event.type) {
    case EVENT_TEXT:
      process.stdout.write(event.text)
      break

    case EVENT_TOOL_USE:
      console.log(`\n[Tool: ${event.toolName}]`)
      console.log(event.toolInput)
      break

    case EVENT_RESULT:
      console.log(`\nDone in ${event.durationMs}ms`)
      console.log(`Tokens: ${event.usage.inputTokens} in, ${event.usage.outputTokens} out`)
      console.log(`Session: ${event.sessionId}`)
      break

    case EVENT_ERROR:
      console.error(`Error: ${event.message}`)
      break

    case EVENT_SYSTEM:
      console.log(`[System/${event.subtype}]`, event.data)
      break
  }
}
```

### Collect stream into a string

```ts
import { Claude, EVENT_TEXT } from '@scottwalker/claude-connector'

const claude = new Claude()

let fullText = ''

for await (const event of claude.stream('Summarize README.md')) {
  if (event.type === EVENT_TEXT) fullText += event.text
}

console.log(fullText)
```

---

## StreamHandle API

`stream()` returns a `StreamHandle` with fluent callbacks, convenience methods, and Node.js stream support.

### Fluent callbacks with `.on()` and `.done()`

```ts
import {
  Claude,
  EVENT_TEXT,
  EVENT_TOOL_USE,
  EVENT_RESULT,
} from '@scottwalker/claude-connector'

const claude = new Claude()

const result = await claude.stream('Refactor auth')
  .on(EVENT_TEXT, (text) => process.stdout.write(text))
  .on(EVENT_TOOL_USE, (event) => console.log(`[Tool: ${event.toolName}]`))
  .on(EVENT_RESULT, (event) => console.log(`\nCost: $${event.cost}`))
  .done()

console.log(`Session: ${result.sessionId}`)
```

### Collect all text with `.text()`

```ts
const text = await claude.stream('Summarize README.md').text()
console.log(text)
```

### Pipe to stdout with `.pipe()`

```ts
const result = await claude.stream('Explain the auth module').pipe(process.stdout)
console.log(`\nDone in ${result.durationMs}ms`)
```

### Convert to Node.js Readable with `.toReadable()`

```ts
import { pipeline } from 'node:stream/promises'
import { createGzip } from 'node:zlib'
import { createWriteStream } from 'node:fs'

await pipeline(
  claude.stream('Generate a report').toReadable(),
  createGzip(),
  createWriteStream('report.gz'),
)
```

---

## Chat

Bidirectional streaming for multi-turn conversation over a single persistent process.

```ts
import {
  Claude,
  ChatHandle,
  EVENT_TEXT,
  EVENT_RESULT,
} from '@scottwalker/claude-connector'

const claude = new Claude()

const chat: ChatHandle = claude.chat()
  .on(EVENT_TEXT, (text) => process.stdout.write(text))
  .on(EVENT_RESULT, (event) => console.log(`\n[Turn done in ${event.durationMs}ms]`))

// Each send() returns a promise that resolves when the turn completes
await chat.send('What files are in src?')
await chat.send('Refactor the largest one')

console.log(`Session: ${chat.sessionId}`)
console.log(`Turns: ${chat.turnCount}`)

// Graceful close
chat.end()
```

### Chat as a Node.js Duplex stream

```ts
const duplex = claude.chat().toDuplex()
inputStream.pipe(duplex).pipe(process.stdout)
```

### Chat as a Readable stream

```ts
const chat = claude.chat()
chat.toReadable().pipe(process.stdout)

await chat.send('Explain the codebase')
await chat.send('Now summarize in bullet points')
chat.end()
```

---

## Sessions

Multi-turn conversations with persistent context.

### New session

```ts
const session = claude.session()

const r1 = await session.query('What files are in src/?')
console.log(r1.text)

const r2 = await session.query('Refactor the largest file')
// Claude remembers the previous context
console.log(r2.text)

console.log(session.sessionId)  // "abc-123-..." (captured after first query)
console.log(session.queryCount) // 2
```

### Resume an existing session

```ts
const session = claude.session({ resume: 'abc-123-def-456' })

const result = await session.query('Continue where we left off')
```

### Continue the most recent session

```ts
const session = claude.session({ continue: true })

const result = await session.query('What were we working on?')
```

### Fork a session

Create a new branch from an existing session.

```ts
const session = claude.session({
  resume: 'original-session-id',
  fork: true,
})

// New session ID, but starts with the context of the original
const result = await session.query('Try a different approach')
```

### Streaming within a session

```ts
import { Claude, EVENT_TEXT } from '@scottwalker/claude-connector'

const claude = new Claude()
const session = claude.session()

for await (const event of session.stream('Analyze the codebase')) {
  if (event.type === EVENT_TEXT) process.stdout.write(event.text)
}

// Session ID is captured from the stream result
console.log(session.sessionId)

// Subsequent queries continue the conversation
const r2 = await session.query('Now fix the bugs you found')
```

---

## Parallel Queries

Run multiple independent queries concurrently.

```ts
const claude = new Claude()

const results = await claude.parallel([
  { prompt: 'Review src/auth.ts for security issues' },
  { prompt: 'Find dead code in src/utils/' },
  { prompt: 'Check for TypeScript strict mode violations', options: { model: 'haiku' } },
])

for (const result of results) {
  console.log(result.text)
  console.log('---')
}
```

---

## Scheduled Queries (Loop)

Recurring queries at fixed intervals — the programmatic equivalent of `/loop`.

```ts
import {
  Claude,
  SCHED_RESULT,
  SCHED_ERROR,
  SCHED_TICK,
  SCHED_STOP,
} from '@scottwalker/claude-connector'

const claude = new Claude()

const job = claude.loop('5m', 'Check deploy status on staging')

job.on(SCHED_RESULT, (result) => {
  console.log(`[Tick ${job.tickCount}] ${result.text}`)
})

job.on(SCHED_ERROR, (err) => {
  console.error('Query failed:', err.message)
})

job.on(SCHED_TICK, (count) => {
  console.log(`Starting tick #${count}...`)
})

job.on(SCHED_STOP, () => {
  console.log('Job stopped')
})

// Stop after 1 hour
setTimeout(() => job.stop(), 3_600_000)
```

### Interval formats

```ts
claude.loop('30s', 'Check status')      // 30 seconds
claude.loop('5m', 'Run tests')          // 5 minutes
claude.loop('2h', 'Generate report')    // 2 hours
claude.loop('1d', 'Daily summary')      // 1 day
claude.loop(120_000, 'Custom interval') // raw milliseconds
```

### Loop with query options

```ts
const job = claude.loop('10m', 'Check for regressions', {
  model: 'haiku',
  maxTurns: 3,
  maxBudget: 0.5,
})
```

### Loop properties

```ts
console.log(job.intervalMs)  // interval in ms
console.log(job.prompt)      // the prompt string
console.log(job.tickCount)   // number of executions
console.log(job.running)     // true if a query is in progress
console.log(job.stopped)     // true after stop()
```

---

## Model Selection

```ts
// Aliases
const claude = new Claude({ model: 'opus' })
const claude = new Claude({ model: 'sonnet' })
const claude = new Claude({ model: 'haiku' })

// Full model ID
const claude = new Claude({ model: 'claude-sonnet-4-6' })
```

### Fallback model

Automatically fall back if the primary model is overloaded.

```ts
const claude = new Claude({
  model: 'opus',
  fallbackModel: 'sonnet',
})
```

---

## Effort Level

Controls thinking depth.

```ts
import {
  Claude,
  EFFORT_LOW,
  EFFORT_MEDIUM,
  EFFORT_HIGH,
  EFFORT_MAX,
} from '@scottwalker/claude-connector'

const claude = new Claude({ effortLevel: EFFORT_LOW })    // fast, shallow
const claude = new Claude({ effortLevel: EFFORT_MEDIUM })  // balanced
const claude = new Claude({ effortLevel: EFFORT_HIGH })    // deep thinking
const claude = new Claude({ effortLevel: EFFORT_MAX })     // maximum depth
```

---

## System Prompt

### Override the entire system prompt

```ts
const claude = new Claude({
  systemPrompt: 'You are a senior Go developer. Always respond in Go idioms.',
})

const result = await claude.query('How do I handle errors?')
```

### Append to the default system prompt

```ts
const claude = new Claude({
  appendSystemPrompt: 'Always include test examples in your answers.',
})
```

### Per-query system prompt override

```ts
const claude = new Claude({
  systemPrompt: 'You are a TypeScript expert.',
})

// Override for a specific query
const result = await claude.query('Explain ownership', {
  systemPrompt: 'You are a Rust expert.',
})
```

---

## Permission Modes

```ts
import {
  Claude,
  PERMISSION_DEFAULT,
  PERMISSION_ACCEPT_EDITS,
  PERMISSION_PLAN,
  PERMISSION_AUTO,
  PERMISSION_BYPASS,
  PERMISSION_DONT_ASK,
} from '@scottwalker/claude-connector'

// Prompt on first use (default behavior)
new Claude({ permissionMode: PERMISSION_DEFAULT })

// Auto-accept file edits
new Claude({ permissionMode: PERMISSION_ACCEPT_EDITS })

// Read-only — no modifications allowed
new Claude({ permissionMode: PERMISSION_PLAN })

// Automatic tool approval based on risk
new Claude({ permissionMode: PERMISSION_AUTO })

// Skip all permission checks (use only in sandboxed environments)
new Claude({ permissionMode: PERMISSION_BYPASS })

// Skip all checks, don't even ask
new Claude({ permissionMode: PERMISSION_DONT_ASK })
```

---

## Tool Control

### Auto-approve specific tools (`allowedTools`)

These tools run without prompting. Others still require approval.

```ts
const claude = new Claude({
  allowedTools: ['Read', 'Glob', 'Grep', 'Bash(npm run *)'],
})
```

### Block specific tools (`disallowedTools`)

These tools are always denied.

```ts
const claude = new Claude({
  disallowedTools: ['Bash(rm *)', 'Write'],
})
```

### Restrict the available tool set (`tools`)

Controls which tools **exist** — Claude cannot use tools outside this list.

```ts
// Only allow reading — Claude cannot edit files at all
const claude = new Claude({
  tools: ['Read', 'Glob', 'Grep'],
})

// Disable all tools (pure chat, no file access)
const claude = new Claude({ tools: [] })

// All built-in tools (default)
const claude = new Claude({ tools: ['default'] })
```

### `tools` vs `allowedTools` — the difference

```ts
const claude = new Claude({
  // Claude CAN use: Read, Glob, Grep, Bash, Edit
  // Claude CANNOT use: Write, NotebookEdit, etc. (they don't exist)
  tools: ['Read', 'Glob', 'Grep', 'Bash', 'Edit'],

  // Of the tools above, these run without prompting:
  allowedTools: ['Read', 'Glob', 'Grep'],

  // Bash and Edit still require user approval (they exist but aren't auto-approved)
})
```

---

## Structured Output (JSON Schema)

Force Claude to return validated JSON matching a schema.

```ts
const result = await claude.query('Extract all TODO comments from src/', {
  schema: {
    type: 'object',
    properties: {
      todos: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            file: { type: 'string' },
            line: { type: 'number' },
            text: { type: 'string' },
          },
          required: ['file', 'line', 'text'],
        },
      },
    },
    required: ['todos'],
  },
})

// Typed structured output
const data = result.structured as { todos: Array<{ file: string; line: number; text: string }> }
for (const todo of data.todos) {
  console.log(`${todo.file}:${todo.line} — ${todo.text}`)
}
```

---

## Piped Input (stdin)

Provide additional context alongside the prompt — equivalent to `echo "data" | claude -p "prompt"`.

```ts
import { readFileSync } from 'node:fs'

const logContent = readFileSync('/var/log/app.log', 'utf-8')

const result = await claude.query('Find errors in these logs', {
  input: logContent,
})
```

### Analyze diff output

```ts
import { execSync } from 'node:child_process'

const diff = execSync('git diff HEAD~5').toString()

const result = await claude.query('Review these changes for bugs', {
  input: diff,
})
```

---

## Additional Directories

Grant Claude access to directories outside the main working directory.

```ts
const claude = new Claude({
  cwd: '/home/user/project',
  additionalDirs: ['/home/user/shared-lib', '/home/user/config'],
})
```

### Per-query additional directories

```ts
const result = await claude.query('Compare our auth with the shared lib', {
  additionalDirs: ['/home/user/other-project/src'],
})
```

---

## Git Worktree Isolation

Run queries in an isolated git worktree — changes don't affect your working tree.

```ts
// Auto-generated worktree name
const result = await claude.query('Experiment with a new API design', {
  worktree: true,
})

// Named worktree
const result = await claude.query('Build the auth feature', {
  worktree: 'feature-auth',
})
```

---

## MCP Servers

### From config files

```ts
const claude = new Claude({
  mcpConfig: './mcp-servers.json',
})

// Multiple config files
const claude = new Claude({
  mcpConfig: ['./mcp-local.json', './mcp-shared.json'],
})
```

### Inline server definitions

```ts
const claude = new Claude({
  mcpServers: {
    filesystem: {
      type: 'stdio',
      command: 'mcp-server-filesystem',
      args: ['--root', '/home/user/data'],
    },
    github: {
      type: 'http',
      url: 'http://localhost:3000/mcp',
      headers: { Authorization: 'Bearer token123' },
    },
    database: {
      type: 'sse',
      url: 'http://localhost:8080/sse',
      env: { DB_URL: 'postgres://localhost/mydb' },
    },
  },
})
```

### Mixed: config files + inline

```ts
const claude = new Claude({
  mcpConfig: './base-servers.json',
  mcpServers: {
    custom: { type: 'stdio', command: 'my-mcp-tool' },
  },
})
```

### Strict MCP config

Ignore all MCP servers except the ones explicitly provided.

```ts
const claude = new Claude({
  mcpConfig: './my-servers.json',
  strictMcpConfig: true,
})
```

---

## Agents

### Define and use custom agents

```ts
import {
  Claude,
  PERMISSION_PLAN,
  PERMISSION_ACCEPT_EDITS,
} from '@scottwalker/claude-connector'

const claude = new Claude({
  agents: {
    reviewer: {
      description: 'Reviews code for quality and security issues',
      prompt: 'You are a senior code reviewer. Focus on security, performance, and maintainability.',
      model: 'opus',
      tools: ['Read', 'Glob', 'Grep'],
      permissionMode: PERMISSION_PLAN,
      maxTurns: 10,
    },
    fixer: {
      description: 'Fixes bugs and implements features',
      prompt: 'You fix bugs. Be minimal and precise.',
      model: 'sonnet',
      permissionMode: PERMISSION_ACCEPT_EDITS,
    },
    researcher: {
      description: 'Explores codebases and answers questions',
      prompt: 'You are a codebase explorer.',
      model: 'haiku',
      tools: ['Read', 'Glob', 'Grep'],
      isolation: 'worktree',
      background: true,
    },
  },
  agent: 'reviewer', // default agent for all queries
})

const result = await claude.query('Review the auth module')
```

### Switch agents per-query

```ts
// Uses the default 'reviewer' agent
const review = await claude.query('Review src/auth.ts')

// Switch to 'fixer' for this query
const fix = await claude.query('Fix the SQL injection in auth.ts', {
  agent: 'fixer',
})
```

---

## Hooks

Lifecycle hooks that execute shell commands at specific points.

```ts
const claude = new Claude({
  hooks: {
    // Before a tool is used
    PreToolUse: [
      {
        matcher: 'Bash',
        hooks: [
          { command: 'echo "Bash tool invoked" >> /tmp/claude.log', timeout: 5 },
        ],
      },
    ],

    // After a tool is used
    PostToolUse: [
      {
        matcher: 'Edit',
        hooks: [
          { command: 'npm run lint --fix', timeout: 30 },
        ],
      },
    ],

    // When Claude finishes
    Stop: [
      {
        matcher: '.*',
        hooks: [
          { command: 'notify-send "Claude finished"' },
        ],
      },
    ],
  },
})
```

---

## Environment Variables

Pass extra env vars to the Claude process.

```ts
const claude = new Claude({
  env: {
    ANTHROPIC_API_KEY: 'sk-ant-...',
    GITHUB_TOKEN: 'ghp_...',
    NODE_ENV: 'test',
  },
})

// Per-query env override
const result = await claude.query('Deploy to staging', {
  env: { DEPLOY_TARGET: 'staging' },
})
```

---

## Session Persistence

Disable session persistence for ephemeral/CI workloads.

```ts
const claude = new Claude({
  noSessionPersistence: true,
})

// Sessions are not saved to disk and cannot be resumed
const result = await claude.query('Run CI checks')
```

---

## Session Name

Set a display name visible in `/resume` and the terminal title.

```ts
const claude = new Claude({
  name: 'deploy-review-march-2026',
})
```

---

## Abort

Cancel a running query.

```ts
const claude = new Claude()

// Start a long query
const promise = claude.query('Analyze the entire codebase')

// Abort after 10 seconds
setTimeout(() => claude.abort(), 10_000)

try {
  await promise
} catch (err) {
  console.log('Query was aborted')
}
```

### Abort within a session

```ts
const session = claude.session()
const promise = session.query('Long analysis...')

setTimeout(() => session.abort(), 5_000)
```

---

## SDK Lifecycle

### Init events

Track initialization progress in SDK mode.

```ts
import {
  Claude,
  INIT_EVENT_STAGE,
  INIT_EVENT_READY,
  INIT_EVENT_ERROR,
} from '@scottwalker/claude-connector'

const claude = new Claude({ model: 'sonnet' })

claude.on(INIT_EVENT_STAGE, (stage, message) => {
  // stage: 'importing' -> 'creating' -> 'connecting' -> 'ready'
  console.log(`[${stage}] ${message}`)
})

claude.on(INIT_EVENT_READY, () => {
  console.log('SDK session is warm — queries will be fast')
})

claude.on(INIT_EVENT_ERROR, (error) => {
  console.error('SDK init failed:', error.message)
})

// Explicit warm-up (optional — auto-inits on first query)
await claude.init()
```

### Check readiness

```ts
console.log(claude.ready) // true if SDK session is initialized (always true in CLI mode)
```

### Cleanup

```ts
// Free SDK session resources
claude.close()
```

---

## Custom Executable

Use a specific Claude Code binary.

```ts
import { Claude, DEFAULT_EXECUTABLE } from '@scottwalker/claude-connector'

// Default executable is 'claude'
console.log(DEFAULT_EXECUTABLE) // 'claude'

const claude = new Claude({
  executable: '/usr/local/bin/claude-2.0',
})
```

### Working directory

```ts
const claude = new Claude({
  cwd: '/home/user/my-project',
})
```

---

## Per-Query Overrides

Any `ClientOptions` field that has a `QueryOptions` counterpart can be overridden per-query.

```ts
import {
  Claude,
  PERMISSION_PLAN,
  PERMISSION_ACCEPT_EDITS,
  EFFORT_MEDIUM,
  EFFORT_MAX,
} from '@scottwalker/claude-connector'

const claude = new Claude({
  model: 'sonnet',
  maxTurns: 10,
  maxBudget: 5.0,
  permissionMode: PERMISSION_PLAN,
  effortLevel: EFFORT_MEDIUM,
  systemPrompt: 'You are a helpful assistant.',
  allowedTools: ['Read', 'Glob'],
  tools: ['Read', 'Glob', 'Grep', 'Bash'],
})

// Override everything for one query
const result = await claude.query('Fix the critical bug NOW', {
  model: 'opus',
  maxTurns: 50,
  maxBudget: 20.0,
  permissionMode: PERMISSION_ACCEPT_EDITS,
  effortLevel: EFFORT_MAX,
  systemPrompt: 'You are an emergency bug fixer. Act fast.',
  allowedTools: ['Read', 'Glob', 'Grep', 'Edit', 'Bash'],
  tools: ['default'],
  cwd: '/home/user/production-hotfix',
  additionalDirs: ['/home/user/shared-config'],
  env: { HOTFIX: 'true' },
  agent: 'fixer',
  worktree: 'hotfix-branch',
})
```

---

## Error Handling

All library errors extend `ClaudeConnectorError`.

```ts
import {
  Claude,
  ClaudeConnectorError,
  CliNotFoundError,
  CliExecutionError,
  CliTimeoutError,
  ParseError,
  ValidationError,
} from '@scottwalker/claude-connector'

const claude = new Claude({ useSdk: false })

try {
  await claude.query('Do something')
} catch (err) {
  if (err instanceof CliNotFoundError) {
    // Claude Code CLI not found
    console.error(`Install CLI: ${err.executable} not found`)
  } else if (err instanceof CliTimeoutError) {
    // Query took too long
    console.error(`Timeout after ${err.timeoutMs}ms`)
  } else if (err instanceof CliExecutionError) {
    // CLI exited with non-zero code
    console.error(`Exit code: ${err.exitCode}`)
    console.error(`Stderr: ${err.stderr}`)
  } else if (err instanceof ParseError) {
    // Unexpected CLI output format
    console.error(`Raw output: ${err.rawOutput.slice(0, 200)}`)
  } else if (err instanceof ValidationError) {
    // Invalid options
    console.error(`Invalid field: ${err.field}`)
  } else if (err instanceof ClaudeConnectorError) {
    // Catch-all for any library error
    console.error(err.message)
  }
}
```

### Validation errors fire immediately

```ts
// Throws ValidationError at construction
new Claude({ maxTurns: -1 })
new Claude({ maxBudget: 0 })
new Claude({ permissionMode: 'invalid' as any })
new Claude({ effortLevel: 'turbo' as any })

// Throws ValidationError at call time
await claude.query('')
await claude.query('   ')
await claude.query('Ok', { maxTurns: 0 })
```

---

## QueryResult Fields

Full reference for the object returned by `query()`.

```ts
const result = await claude.query('Explain the auth module')

result.text           // string — Claude's response
result.sessionId      // string — session ID for resuming
result.usage          // { inputTokens: number, outputTokens: number }
result.cost           // number | null — USD cost
result.durationMs     // number — wall-clock time
result.messages       // Message[] — full conversation history
result.structured     // unknown | null — parsed JSON when schema was used
result.raw            // Record<string, unknown> — raw CLI JSON response
```

### Accessing message history

```ts
import {
  Claude,
  BLOCK_TEXT,
  BLOCK_TOOL_USE,
  BLOCK_TOOL_RESULT,
} from '@scottwalker/claude-connector'

const claude = new Claude()
const result = await claude.query('Explain the auth module')

for (const msg of result.messages) {
  console.log(`[${msg.role}]`)

  if (typeof msg.content === 'string') {
    console.log(msg.content)
  } else {
    for (const block of msg.content) {
      switch (block.type) {
        case BLOCK_TEXT:
          console.log(block.text)
          break
        case BLOCK_TOOL_USE:
          console.log(`Tool: ${block.name}(${JSON.stringify(block.input)})`)
          break
        case BLOCK_TOOL_RESULT:
          console.log(`Result: ${block.content}`)
          break
      }
    }
  }
}
```

---

## Stream Events

Full reference for the discriminated union yielded by `stream()`.

| Type | Fields | Description |
|------|--------|-------------|
| `text` | `text` | Incremental text chunk |
| `tool_use` | `toolName`, `toolInput` | Tool invocation |
| `result` | `text`, `sessionId`, `usage`, `cost`, `durationMs` | Final result (always last) |
| `error` | `message`, `code?` | Error during execution |
| `system` | `subtype`, `data` | System/internal events |

---

## Thinking Config

Control Claude's extended thinking behavior.

```ts
// Adaptive thinking (Claude decides when to think deeply)
const claude = new Claude({ thinking: { type: 'adaptive' } })

// Per-query override with explicit budget
await claude.query('Complex analysis', {
  thinking: { type: 'enabled', budgetTokens: 10000 },
})
```

---

## Programmatic Permissions (canUseTool)

Intercept tool calls at runtime and allow/deny them programmatically.

```ts
const claude = new Claude({
  canUseTool: async (toolName, input, { signal }) => {
    if (toolName === 'Bash' && String(input.command).includes('rm'))
      return { behavior: 'deny', message: 'Destructive commands blocked' }
    return { behavior: 'allow' }
  },
})
```

---

## In-Process MCP Tools

Define MCP tools directly in JavaScript — no external server process required.

```ts
import { createSdkMcpServer, sdkTool } from '@scottwalker/claude-connector'
import { z } from 'zod/v4'

const server = await createSdkMcpServer({
  name: 'my-tools',
  tools: [
    await sdkTool('getPrice', 'Get stock price', { ticker: z.string() },
      async ({ ticker }) => ({ content: [{ type: 'text', text: '142.50' }] })
    ),
  ],
})

const claude = new Claude({ mcpServers: { prices: server } })
```

---

## JS Hook Callbacks

Programmatic hooks that run JavaScript functions instead of shell commands. Supports 21 event types.

```ts
const claude = new Claude({
  hookCallbacks: {
    PreToolUse: [{
      matcher: 'Bash',
      hooks: [async (input) => {
        console.log('About to run:', input.tool_input)
        return { continue: true }
      }],
    }],
    SessionStart: [{
      hooks: [async (input) => {
        console.log('Session started:', input.session_id)
        return {}
      }],
    }],
  },
})
```

---

## Runtime Model & Permission Switch

Change model or permission mode on a live instance without recreating it.

```ts
const claude = new Claude({ model: 'sonnet' })

await claude.setModel('opus')
await claude.setPermissionMode('plan')
```

---

## Dynamic MCP

Add, reconnect, or toggle MCP servers at runtime.

```ts
const claude = new Claude()

// Replace all MCP servers
await claude.setMcpServers({ 'new-server': { command: 'node', args: ['srv.js'] } })

// Reconnect a specific server
await claude.reconnectMcpServer('github')

// Disable a server without removing it
await claude.toggleMcpServer('github', false)
```

---

## File Checkpointing

Track and revert file changes made during a session.

```ts
const claude = new Claude({ enableFileCheckpointing: true })

await claude.query('Refactor auth.ts')

// Preview what would be reverted
const result = await claude.rewindFiles('msg-uuid-123', { dryRun: true })
// result: { canRewind: true, filesChanged: ['auth.ts'], insertions: 5, deletions: 2 }

// Actually revert the changes
await claude.rewindFiles('msg-uuid-123')
```

---

## Account & Model Info

Query account details, available models, agents, and MCP server status.

```ts
const claude = new Claude()

const account = await claude.accountInfo()
const models = await claude.supportedModels()
const agents = await claude.supportedAgents()
const mcpStatus = await claude.mcpServerStatus()
```

---

## Per-Query Abort (signal)

Pass an `AbortSignal` to cancel a specific query without affecting the instance.

```ts
const controller = new AbortController()
setTimeout(() => controller.abort(), 30_000)

const result = await claude.query('Long task', { signal: controller.signal })
```

---

## Subagent Control

Monitor and control subagent (spawned task) lifecycle via stream events.

```ts
await claude.stream('Analyze and fix')
  .on('task_started', (e) => console.log(`Subagent started: ${e.description}`))
  .on('task_progress', (e) => console.log(`Progress: ${e.description}`))
  .on('task_notification', (e) => {
    if (e.status === 'completed') console.log(`Done: ${e.summary}`)
    if (e.status === 'failed') console.error(`Failed: ${e.summary}`)
  })
  .done()

// Stop a running subagent by ID
await claude.stopTask('task-42')
```

---

## Settings & Plugins

Load settings from CLAUDE.md files and attach local plugins.

```ts
const claude = new Claude({
  settingSources: ['user', 'project'], // load CLAUDE.md!
  settings: { permissions: { allow: ['Bash(npm test)'] } },
  plugins: [{ type: 'local', path: './my-plugin' }],
})
```

---

## Custom Process Spawn

Override how the Claude CLI process is spawned — useful for VMs, containers, or remote execution.

```ts
const claude = new Claude({
  spawnClaudeCodeProcess: (opts) => {
    return docker.exec('claude-container', opts.command, opts.args)
  },
})
```

---

## Session Utilities

List and inspect sessions programmatically.

```ts
import { listSessions, getSessionMessages } from '@scottwalker/claude-connector'

const sessions = await listSessions({ dir: '/my/project' })
const messages = await getSessionMessages(sessions[0].sessionId)
```

---

## Stderr Monitoring

Capture stderr output from the Claude process for logging or debugging.

```ts
const claude = new Claude({
  stderr: (data) => logger.warn('[claude]', data),
})
```

---

## Bypass Permissions

Skip all permission checks entirely. Requires an explicit safety flag.

```ts
const claude = new Claude({
  permissionMode: 'bypassPermissions',
  allowDangerouslySkipPermissions: true,
})
```

---

## Advanced: Custom Executor

Inject a custom executor for testing or custom transport.

```ts
import {
  Claude,
  EVENT_TEXT,
  EVENT_RESULT,
  type IExecutor,
  type ExecuteOptions,
  type QueryResult,
  type StreamEvent,
} from '@scottwalker/claude-connector'

const mockExecutor: IExecutor = {
  async execute(args: readonly string[], options: ExecuteOptions): Promise<QueryResult> {
    return {
      text: 'Mocked response',
      sessionId: 'mock-session',
      usage: { inputTokens: 0, outputTokens: 0 },
      cost: null,
      durationMs: 0,
      messages: [],
      structured: null,
      raw: {},
    }
  },

  async *stream(args: readonly string[], options: ExecuteOptions): AsyncIterable<StreamEvent> {
    yield { type: EVENT_TEXT, text: 'Mocked stream' }
    yield {
      type: EVENT_RESULT,
      text: 'Mocked stream',
      sessionId: 'mock-session',
      usage: { inputTokens: 0, outputTokens: 0 },
      cost: null,
      durationMs: 0,
    }
  },

  abort() {},
}

// Pass as second argument — bypasses SDK/CLI executor creation
const claude = new Claude({ model: 'sonnet' }, mockExecutor)
const result = await claude.query('Test')
console.log(result.text) // "Mocked response"
```

### Access the underlying executor

```ts
const claude = new Claude()
const executor = claude.getExecutor()
// executor is IExecutor (CliExecutor or SdkExecutor depending on useSdk)
```
