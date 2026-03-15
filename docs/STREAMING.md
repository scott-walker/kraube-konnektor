# Streaming Guide

Real-time integration of Claude Code into any Node.js application.

```ts
import { Claude } from '@scottwalker/claude-connector'
```

---

## Table of Contents

- [StreamHandle — One-shot Streaming](#streamhandle--one-shot-streaming)
  - [Fluent Callbacks](#fluent-callbacks)
  - [Collect to String](#collect-to-string)
  - [Pipe to Writable](#pipe-to-writable)
  - [Node.js Readable](#nodejs-readable)
  - [Async Iteration](#async-iteration)
  - [Stream Events Reference](#stream-events-reference)
- [ChatHandle — Bidirectional Streaming](#chathandle--bidirectional-streaming)
  - [Send and Await](#send-and-await)
  - [Continuous Pipe](#continuous-pipe)
  - [Node.js Readable](#chathandle-readable)
  - [Node.js Duplex](#nodejs-duplex)
  - [Chat Lifecycle](#chat-lifecycle)
- [Integration Patterns](#integration-patterns)
  - [HTTP Streaming (Express)](#http-streaming-express)
  - [HTTP Streaming (Fastify)](#http-streaming-fastify)
  - [Server-Sent Events (SSE)](#server-sent-events-sse)
  - [WebSocket](#websocket)
  - [Write to File](#write-to-file)
  - [Compress with gzip/brotli](#compress-with-gzipbrotli)
  - [pipeline()](#pipeline)
  - [Transform Stream](#transform-stream)
  - [Pipe Between Processes](#pipe-between-processes)
  - [Log to Multiple Destinations](#log-to-multiple-destinations)
  - [Progress Tracking](#progress-tracking)
  - [Token Budget Monitoring](#token-budget-monitoring)
  - [Tool Activity Logger](#tool-activity-logger)
  - [Streaming in Sessions](#streaming-in-sessions)
  - [Parallel Streams](#parallel-streams)
  - [Timeout and Abort](#timeout-and-abort)
  - [Error Handling](#error-handling)
  - [Telegram Bot](#telegram-bot)
  - [Slack Bot](#slack-bot)
  - [CLI Tool with Spinner](#cli-tool-with-spinner)
  - [Interactive Chat REPL](#interactive-chat-repl)
  - [CI/CD Pipeline Reporter](#cicd-pipeline-reporter)
  - [Electron IPC](#electron-ipc)
  - [Worker Threads](#worker-threads)

---

## StreamHandle — One-shot Streaming

`claude.stream()` returns a `StreamHandle` — a one-shot streaming response with fluent API.

### Fluent Callbacks

Register typed callbacks, then consume with `.done()`:

```ts
import { Claude, EVENT_TEXT, EVENT_TOOL_USE, EVENT_RESULT, EVENT_ERROR, EVENT_SYSTEM } from '@scottwalker/claude-connector'

const result = await claude.stream('Refactor the auth module')
  .on(EVENT_TEXT, (text) => {
    process.stdout.write(text)
  })
  .on(EVENT_TOOL_USE, (event) => {
    console.log(`\n[Tool: ${event.toolName}]`)
    console.log(JSON.stringify(event.toolInput, null, 2))
  })
  .on(EVENT_RESULT, (event) => {
    console.log(`\nDone in ${event.durationMs}ms`)
    console.log(`Tokens: ${event.usage.inputTokens}→${event.usage.outputTokens}`)
  })
  .on(EVENT_ERROR, (event) => {
    console.error(`Error: ${event.message}`)
  })
  .on(EVENT_SYSTEM, (event) => {
    console.log(`[System/${event.subtype}]`, event.data)
  })
  .done()

// result is StreamResultEvent — available after stream completes
console.log(`Session: ${result.sessionId}`)
console.log(`Cost: $${result.cost}`)
```

### Collect to String

One-liner to get the full text response:

```ts
const text = await claude.stream('Summarize README.md').text()
console.log(text)
```

With callbacks still firing:

```ts
import { Claude, EVENT_TOOL_USE } from '@scottwalker/claude-connector'

const text = await claude.stream('Summarize README.md')
  .on(EVENT_TOOL_USE, (e) => console.log(`[${e.toolName}]`))
  .text()
```

### Pipe to Writable

Pipe text directly to any writable. Returns the result when done.

```ts
// Pipe to stdout
const result = await claude.stream('Explain the auth flow').pipe(process.stdout)
console.log(`\nCost: $${result.cost}`)

// Pipe to stderr
await claude.stream('Find bugs').pipe(process.stderr)

// Pipe to any object with .write()
const chunks: string[] = []
await claude.stream('Analyze').pipe({
  write(chunk: string) { chunks.push(chunk) },
})
```

### Node.js Readable

`.toReadable()` returns a standard Node.js `Readable` stream in text mode. This integrates with the entire Node.js streams ecosystem.

```ts
import { createWriteStream } from 'node:fs'

// Pipe to file
claude.stream('Generate a report').toReadable()
  .pipe(createWriteStream('report.txt'))

// Pipe to HTTP response
claude.stream('Explain this').toReadable()
  .pipe(res)

// Read chunks manually
const readable = claude.stream('Analyze code').toReadable()
readable.on('data', (chunk) => {
  process.stdout.write(chunk)
})
readable.on('end', () => {
  console.log('\nStream ended')
})
```

### Async Iteration

`StreamHandle` implements `AsyncIterable<StreamEvent>` — use `for await` for full control:

```ts
import { Claude, EVENT_TEXT, EVENT_TOOL_USE, EVENT_RESULT, EVENT_ERROR, EVENT_SYSTEM } from '@scottwalker/claude-connector'

for await (const event of claude.stream('Analyze the codebase')) {
  switch (event.type) {
    case EVENT_TEXT:
      process.stdout.write(event.text)
      break
    case EVENT_TOOL_USE:
      console.log(`[${event.toolName}]`, event.toolInput)
      break
    case EVENT_RESULT:
      console.log(`\nTokens: ${event.usage.inputTokens}→${event.usage.outputTokens}`)
      break
    case EVENT_ERROR:
      console.error(event.message)
      break
    case EVENT_SYSTEM:
      // system events (init, stderr, etc.)
      break
  }
}
```

### Stream Events Reference

| Event | Constant | Callback Signature | Description |
|-------|----------|-------------------|-------------|
| `text` | `EVENT_TEXT` | `(text: string)` | Incremental text chunk |
| `tool_use` | `EVENT_TOOL_USE` | `(event: { toolName, toolInput })` | Tool invocation |
| `result` | `EVENT_RESULT` | `(event: { text, sessionId, usage, cost, durationMs })` | Final result |
| `error` | `EVENT_ERROR` | `(event: { message, code? })` | Error |
| `system` | `EVENT_SYSTEM` | `(event: { subtype, data })` | System event |

---

## ChatHandle — Bidirectional Streaming

`claude.chat()` returns a `ChatHandle` — a persistent CLI process for multi-turn real-time conversation.

### Send and Await

`.send()` sends a prompt and returns a promise that resolves when the turn completes:

```ts
import { Claude, EVENT_TEXT } from '@scottwalker/claude-connector'

const chat = claude.chat()
  .on(EVENT_TEXT, (text) => process.stdout.write(text))

const r1 = await chat.send('What files are in src/?')
console.log(`\n[Turn 1: ${r1.durationMs}ms, ${r1.usage.outputTokens} tokens]`)

const r2 = await chat.send('Refactor the largest file')
console.log(`\n[Turn 2: ${r2.durationMs}ms]`)

const r3 = await chat.send('Now write tests for it')
console.log(`\n[Turn 3: ${r3.durationMs}ms]`)

console.log(`Session: ${chat.sessionId}`)
console.log(`Turns: ${chat.turnCount}`)

chat.end()
```

### Continuous Pipe

Pipe all text output to one or more destinations:

```ts
import { createWriteStream } from 'node:fs'

const chat = claude.chat()

// Pipe to multiple destinations simultaneously
chat.pipe(process.stdout)
chat.pipe(createWriteStream('conversation.log'))

await chat.send('Analyze the codebase')
await chat.send('Find security issues')
await chat.send('Generate a report')

chat.end()
```

### ChatHandle Readable

```ts
const chat = claude.chat()
const readable = chat.toReadable()

// Pipe to any writable
readable.pipe(createWriteStream('output.txt'))

await chat.send('Generate documentation for every module')

chat.end()
```

### Node.js Duplex

`.toDuplex()` returns a full Node.js `Duplex` stream. Write side accepts prompts (one per write), read side emits text:

```ts
import { pipeline } from 'node:stream/promises'
import { createReadStream, createWriteStream } from 'node:fs'

const duplex = claude.chat().toDuplex()

// Pipe prompts in, pipe responses out
await pipeline(
  createReadStream('prompts.txt'),  // one prompt per line
  duplex,
  createWriteStream('responses.txt'),
)
```

Manual use:

```ts
const duplex = claude.chat().toDuplex()

duplex.pipe(process.stdout)

duplex.write('What does this project do?\n')
// text flows to stdout...

duplex.write('How can I improve it?\n')
// more text flows...

duplex.end()
```

### Chat Lifecycle

```ts
const chat = claude.chat()

chat.sessionId   // null (until first result)
chat.turnCount   // 0
chat.closed      // false

await chat.send('Hello')

chat.sessionId   // "abc-123-..."
chat.turnCount   // 1
chat.closed      // false

chat.end()       // graceful close (waits for process)
chat.closed      // true

// Or:
chat.abort()     // immediate kill (SIGTERM)
```

---

## Integration Patterns

### HTTP Streaming (Express)

Stream Claude's response directly to the HTTP client:

```ts
import express from 'express'

const app = express()
const claude = new Claude({ useSdk: false })

app.get('/ai/stream', (req, res) => {
  const prompt = req.query.prompt as string

  res.writeHead(200, {
    'Content-Type': 'text/plain; charset=utf-8',
    'Transfer-Encoding': 'chunked',
    'Cache-Control': 'no-cache',
  })

  claude.stream(prompt).toReadable().pipe(res)
})

app.get('/ai/query', async (req, res) => {
  const text = await claude.stream(req.query.prompt as string).text()
  res.json({ text })
})
```

### HTTP Streaming (Fastify)

```ts
import Fastify from 'fastify'

const app = Fastify()
const claude = new Claude({ useSdk: false })

app.get('/ai/stream', async (req, reply) => {
  const prompt = req.query.prompt as string

  reply.raw.writeHead(200, {
    'Content-Type': 'text/plain; charset=utf-8',
    'Transfer-Encoding': 'chunked',
  })

  await claude.stream(prompt).pipe(reply.raw)
})
```

### Server-Sent Events (SSE)

Stream structured events to the browser:

```ts
import { EVENT_TEXT, EVENT_TOOL_USE, EVENT_RESULT, EVENT_ERROR } from '@scottwalker/claude-connector'

app.get('/ai/sse', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  })

  claude.stream(req.query.prompt as string)
    .on(EVENT_TEXT, (text) => {
      res.write(`data: ${JSON.stringify({ type: 'text', text })}\n\n`)
    })
    .on(EVENT_TOOL_USE, (event) => {
      res.write(`data: ${JSON.stringify({ type: 'tool', tool: event.toolName })}\n\n`)
    })
    .on(EVENT_RESULT, (event) => {
      res.write(`data: ${JSON.stringify({ type: 'done', usage: event.usage })}\n\n`)
      res.end()
    })
    .on(EVENT_ERROR, (event) => {
      res.write(`data: ${JSON.stringify({ type: 'error', message: event.message })}\n\n`)
      res.end()
    })
    .done()
})
```

Browser consumer:

```js
const source = new EventSource('/ai/sse?prompt=Explain%20auth')

source.onmessage = (e) => {
  const data = JSON.parse(e.data)

  if (data.type === 'text') {
    document.getElementById('output').textContent += data.text
  } else if (data.type === 'done') {
    source.close()
  }
}
```

### WebSocket

Real-time bidirectional communication over WebSocket:

```ts
import { WebSocketServer } from 'ws'
import { Claude, EVENT_TEXT, EVENT_TOOL_USE, EVENT_RESULT } from '@scottwalker/claude-connector'

const wss = new WebSocketServer({ port: 8080 })
const claude = new Claude({ useSdk: false })

wss.on('connection', (ws) => {
  const chat = claude.chat()
    .on(EVENT_TEXT, (text) => {
      ws.send(JSON.stringify({ type: 'text', text }))
    })
    .on(EVENT_TOOL_USE, (event) => {
      ws.send(JSON.stringify({ type: 'tool', name: event.toolName }))
    })
    .on(EVENT_RESULT, (event) => {
      ws.send(JSON.stringify({ type: 'result', usage: event.usage }))
    })

  ws.on('message', async (data) => {
    const { prompt } = JSON.parse(data.toString())
    await chat.send(prompt)
  })

  ws.on('close', () => chat.end())
})
```

Browser consumer:

```js
const ws = new WebSocket('ws://localhost:8080')

ws.send(JSON.stringify({ prompt: 'What does this project do?' }))

ws.onmessage = (e) => {
  const data = JSON.parse(e.data)
  if (data.type === 'text') {
    document.getElementById('output').textContent += data.text
  }
}
```

### Write to File

```ts
import { createWriteStream } from 'node:fs'

// Simple — pipe Readable to file
claude.stream('Generate a migration plan')
  .toReadable()
  .pipe(createWriteStream('migration-plan.txt'))

// With result tracking
const result = await claude.stream('Generate API docs')
  .pipe(createWriteStream('api-docs.txt'))

console.log(`Wrote docs (${result.usage.outputTokens} tokens)`)
```

### Compress with gzip/brotli

```ts
import { pipeline } from 'node:stream/promises'
import { createGzip, createBrotliCompress } from 'node:zlib'
import { createWriteStream } from 'node:fs'

// gzip
await pipeline(
  claude.stream('Generate a full project report').toReadable(),
  createGzip(),
  createWriteStream('report.txt.gz'),
)

// brotli
await pipeline(
  claude.stream('Generate documentation').toReadable(),
  createBrotliCompress(),
  createWriteStream('docs.txt.br'),
)
```

### pipeline()

Node.js `pipeline()` handles error propagation and cleanup automatically:

```ts
import { pipeline } from 'node:stream/promises'
import { Transform } from 'node:stream'

// Simple pipeline
await pipeline(
  claude.stream('Generate CSV data').toReadable(),
  createWriteStream('data.csv'),
)

// Pipeline with transform
const uppercase = new Transform({
  transform(chunk, encoding, callback) {
    callback(null, chunk.toString().toUpperCase())
  },
})

await pipeline(
  claude.stream('Generate text').toReadable(),
  uppercase,
  createWriteStream('UPPER.txt'),
)
```

### Transform Stream

Custom Transform to process Claude's output in real time:

```ts
import { Transform } from 'node:stream'
import { pipeline } from 'node:stream/promises'

// Line numbering transform
let lineNum = 0
const lineNumberer = new Transform({
  transform(chunk, encoding, callback) {
    const lines = chunk.toString().split('\n')
    const numbered = lines.map((line: string) =>
      line ? `${++lineNum}: ${line}` : ''
    ).join('\n')
    callback(null, numbered)
  },
})

await pipeline(
  claude.stream('List all functions in src/').toReadable(),
  lineNumberer,
  process.stdout,
)
```

```ts
// Markdown → HTML transform
import { marked } from 'marked'

const markdownToHtml = new Transform({
  transform(chunk, encoding, callback) {
    callback(null, marked.parse(chunk.toString()))
  },
})

await pipeline(
  claude.stream('Write API docs in markdown').toReadable(),
  markdownToHtml,
  createWriteStream('docs.html'),
)
```

### Pipe Between Processes

```ts
import { spawn } from 'node:child_process'

// Pipe Claude's output to another process
const less = spawn('less', [], { stdio: ['pipe', 'inherit', 'inherit'] })
claude.stream('Explain the entire codebase in detail').toReadable()
  .pipe(less.stdin)

// Pipe through grep
const grep = spawn('grep', ['-i', 'error'], { stdio: ['pipe', 'inherit', 'inherit'] })
claude.stream('Analyze the logs').toReadable()
  .pipe(grep.stdin)

// Pipe to clipboard (macOS)
const pbcopy = spawn('pbcopy', [], { stdio: ['pipe', 'inherit', 'inherit'] })
claude.stream('Write a commit message for the staged changes').toReadable()
  .pipe(pbcopy.stdin)
```

### Log to Multiple Destinations

```ts
import { createWriteStream } from 'node:fs'
import { EVENT_TEXT, EVENT_TOOL_USE } from '@scottwalker/claude-connector'

const fileLog = createWriteStream('session.log', { flags: 'a' })

const result = await claude.stream('Deploy to staging')
  .on(EVENT_TEXT, (text) => {
    // Simultaneously: stdout + file + buffer
    process.stdout.write(text)
    fileLog.write(text)
  })
  .on(EVENT_TOOL_USE, (event) => {
    const line = `[TOOL] ${event.toolName}: ${JSON.stringify(event.toolInput)}\n`
    process.stderr.write(line)
    fileLog.write(line)
  })
  .done()

fileLog.write(`\n--- ${result.durationMs}ms, $${result.cost} ---\n`)
fileLog.end()
```

### Progress Tracking

```ts
import { EVENT_TEXT, EVENT_TOOL_USE } from '@scottwalker/claude-connector'

let charCount = 0
let toolCount = 0

const result = await claude.stream('Rewrite the test suite')
  .on(EVENT_TEXT, (text) => {
    charCount += text.length
    process.stdout.write(text)
  })
  .on(EVENT_TOOL_USE, (event) => {
    toolCount++
    process.stderr.write(`\r[Tools used: ${toolCount}] ${event.toolName}`)
  })
  .done()

console.log(`\nOutput: ${charCount} chars, ${toolCount} tools, ${result.durationMs}ms`)
```

### Token Budget Monitoring

```ts
import { EVENT_TEXT, EVENT_RESULT } from '@scottwalker/claude-connector'

const MAX_COST = 1.00 // $1 limit

const result = await claude.stream('Analyze the entire repo', { maxBudget: MAX_COST })
  .on(EVENT_TEXT, (text) => process.stdout.write(text))
  .on(EVENT_RESULT, (event) => {
    const pct = ((event.cost ?? 0) / MAX_COST * 100).toFixed(1)
    console.log(`\nBudget: $${event.cost} / $${MAX_COST} (${pct}%)`)
  })
  .done()
```

### Tool Activity Logger

```ts
import { EVENT_TEXT, EVENT_TOOL_USE } from '@scottwalker/claude-connector'

const tools: Array<{ name: string; timestamp: number }> = []
const startTime = Date.now()

const result = await claude.stream('Fix all TypeScript errors in src/')
  .on(EVENT_TEXT, (text) => process.stdout.write(text))
  .on(EVENT_TOOL_USE, (event) => {
    tools.push({ name: event.toolName, timestamp: Date.now() - startTime })
  })
  .done()

console.log('\n\nTool timeline:')
for (const t of tools) {
  console.log(`  +${t.timestamp}ms  ${t.name}`)
}
```

### Streaming in Sessions

Multi-turn streaming with context persistence:

```ts
import { EVENT_TEXT } from '@scottwalker/claude-connector'

const session = claude.session()

// Turn 1 — stream
const text1 = await session.stream('Analyze the architecture')
  .on(EVENT_TEXT, (t) => process.stdout.write(t))
  .text()

console.log('\n---')

// Turn 2 — stream (Claude remembers turn 1)
const result = await session.stream('Now write tests for the weakest module')
  .on(EVENT_TEXT, (t) => process.stdout.write(t))
  .done()

console.log(`\nSession: ${session.sessionId}`)
```

### Parallel Streams

Run multiple streams simultaneously:

```ts
const claude = new Claude({ useSdk: false })

const streams = [
  claude.stream('Review src/auth.ts').text(),
  claude.stream('Review src/db.ts').text(),
  claude.stream('Review src/api.ts').text(),
]

const [auth, db, api] = await Promise.all(streams)

console.log('Auth review:', auth.slice(0, 100))
console.log('DB review:', db.slice(0, 100))
console.log('API review:', api.slice(0, 100))
```

### Timeout and Abort

```ts
import { Claude, EVENT_TEXT } from '@scottwalker/claude-connector'

const claude = new Claude({ useSdk: false })

const controller = new AbortController()

// Abort after 30 seconds
const timer = setTimeout(() => claude.abort(), 30_000)

try {
  const result = await claude.stream('Analyze everything')
    .on(EVENT_TEXT, (t) => process.stdout.write(t))
    .done()

  clearTimeout(timer)
  console.log(`\nCompleted in ${result.durationMs}ms`)
} catch (err) {
  console.log('\nAborted or failed:', (err as Error).message)
}
```

### Error Handling

```ts
import { CliNotFoundError, CliExecutionError, CliTimeoutError, EVENT_TEXT, EVENT_ERROR } from '@scottwalker/claude-connector'

try {
  await claude.stream('Do something')
    .on(EVENT_TEXT, (t) => process.stdout.write(t))
    .on(EVENT_ERROR, (event) => {
      // Stream-level errors (Claude reports an issue)
      console.error(`\nStream error: ${event.message}`)
    })
    .done()
} catch (err) {
  // Process-level errors
  if (err instanceof CliNotFoundError) {
    console.error('Claude CLI not installed')
  } else if (err instanceof CliTimeoutError) {
    console.error(`Timed out after ${err.timeoutMs}ms`)
  } else if (err instanceof CliExecutionError) {
    console.error(`CLI exit code ${err.exitCode}: ${err.stderr}`)
  }
}
```

### Telegram Bot

```ts
import TelegramBot from 'node-telegram-bot-api'
import { Claude, EVENT_TEXT, PERMISSION_PLAN } from '@scottwalker/claude-connector'

const bot = new TelegramBot(process.env.TELEGRAM_TOKEN!, { polling: true })
const claude = new Claude({ useSdk: false, permissionMode: PERMISSION_PLAN })

bot.on('message', async (msg) => {
  const chatId = msg.chat.id
  const prompt = msg.text ?? ''

  // Send "thinking..." then edit with streamed response
  const sent = await bot.sendMessage(chatId, '...')
  let buffer = ''

  await claude.stream(prompt)
    .on(EVENT_TEXT, async (text) => {
      buffer += text
      // Throttle edits to avoid rate limits
      if (buffer.length % 200 < text.length) {
        await bot.editMessageText(buffer, { chat_id: chatId, message_id: sent.message_id })
      }
    })
    .done()

  // Final edit with complete text
  await bot.editMessageText(buffer, { chat_id: chatId, message_id: sent.message_id })
})
```

### Slack Bot

```ts
import { App } from '@slack/bolt'
import { Claude, EVENT_TEXT, PERMISSION_PLAN } from '@scottwalker/claude-connector'

const app = new App({ token: process.env.SLACK_TOKEN!, signingSecret: process.env.SLACK_SECRET! })
const claude = new Claude({ useSdk: false, permissionMode: PERMISSION_PLAN })

app.message(async ({ message, say }) => {
  const text = await claude.stream((message as any).text)
    .text()

  await say(text)
})

// Streaming variant — update message progressively
app.message('stream', async ({ message, client }) => {
  const result = await client.chat.postMessage({
    channel: (message as any).channel,
    text: '...',
  })

  let buffer = ''
  await claude.stream((message as any).text)
    .on(EVENT_TEXT, async (text) => {
      buffer += text
      if (buffer.length % 300 < text.length) {
        await client.chat.update({
          channel: (message as any).channel,
          ts: result.ts!,
          text: buffer,
        })
      }
    })
    .done()

  await client.chat.update({
    channel: (message as any).channel,
    ts: result.ts!,
    text: buffer,
  })
})
```

### CLI Tool with Spinner

```ts
import ora from 'ora'
import { EVENT_TEXT, EVENT_TOOL_USE } from '@scottwalker/claude-connector'

const spinner = ora('Thinking...').start()
let hasText = false

const result = await claude.stream('Find and fix all bugs')
  .on(EVENT_TEXT, (text) => {
    if (!hasText) {
      spinner.stop()
      hasText = true
    }
    process.stdout.write(text)
  })
  .on(EVENT_TOOL_USE, (event) => {
    spinner.text = `Using ${event.toolName}...`
    if (!spinner.isSpinning) spinner.start()
    hasText = false
  })
  .done()

if (spinner.isSpinning) spinner.stop()
console.log(`\n✓ Done in ${result.durationMs}ms`)
```

### Interactive Chat REPL

```ts
import * as readline from 'node:readline'
import { EVENT_TEXT } from '@scottwalker/claude-connector'

const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
const chat = claude.chat()
  .on(EVENT_TEXT, (text) => process.stdout.write(text))

const ask = () => {
  rl.question('\n> ', async (input) => {
    if (input === 'exit') {
      chat.end()
      rl.close()
      return
    }

    await chat.send(input)
    ask()
  })
}

console.log('Chat with Claude (type "exit" to quit)')
ask()
```

### CI/CD Pipeline Reporter

```ts
import { EVENT_TEXT, EVENT_TOOL_USE, PERMISSION_ACCEPT_EDITS } from '@scottwalker/claude-connector'

const reportStream = createWriteStream('ci-report.txt')

const result = await claude.stream('Run all tests and report failures', {
  permissionMode: PERMISSION_ACCEPT_EDITS,
  allowedTools: ['Bash', 'Read', 'Glob', 'Grep'],
})
  .on(EVENT_TEXT, (text) => {
    process.stdout.write(text)
    reportStream.write(text)
  })
  .on(EVENT_TOOL_USE, (event) => {
    if (event.toolName === 'Bash') {
      const cmd = (event.toolInput as any).command ?? ''
      reportStream.write(`\n[CMD] ${cmd}\n`)
    }
  })
  .done()

reportStream.write(`\n\nExit: ${result.durationMs}ms, $${result.cost}\n`)
reportStream.end()

// Set CI exit code based on result
if (result.text.includes('FAIL')) process.exit(1)
```

### Electron IPC

Main process → renderer streaming via IPC:

```ts
// main.ts (Electron main process)
import { ipcMain } from 'electron'
import { EVENT_TEXT, EVENT_RESULT } from '@scottwalker/claude-connector'

ipcMain.handle('ai:stream', async (event, prompt: string) => {
  await claude.stream(prompt)
    .on(EVENT_TEXT, (text) => {
      event.sender.send('ai:chunk', text)
    })
    .on(EVENT_RESULT, (result) => {
      event.sender.send('ai:done', {
        usage: result.usage,
        cost: result.cost,
      })
    })
    .done()
})
```

```ts
// renderer.ts (Electron renderer)
const { ipcRenderer } = require('electron')

ipcRenderer.on('ai:chunk', (_, text) => {
  document.getElementById('output')!.textContent += text
})

ipcRenderer.on('ai:done', (_, result) => {
  console.log('Done:', result)
})

ipcRenderer.invoke('ai:stream', 'Explain this code')
```

### Worker Threads

Offload streaming to a worker to keep the main thread free:

```ts
// worker.ts
import { parentPort, workerData } from 'node:worker_threads'
import { Claude, EVENT_TEXT, EVENT_RESULT } from '@scottwalker/claude-connector'

const claude = new Claude({ useSdk: false })

await claude.stream(workerData.prompt)
  .on(EVENT_TEXT, (text) => {
    parentPort!.postMessage({ type: 'text', text })
  })
  .on(EVENT_RESULT, (event) => {
    parentPort!.postMessage({ type: 'result', usage: event.usage, cost: event.cost })
  })
  .done()
```

```ts
// main.ts
import { Worker } from 'node:worker_threads'

const worker = new Worker('./worker.ts', {
  workerData: { prompt: 'Analyze the codebase' },
})

worker.on('message', (msg) => {
  if (msg.type === 'text') process.stdout.write(msg.text)
  if (msg.type === 'result') console.log('\nDone:', msg.usage)
})
```
