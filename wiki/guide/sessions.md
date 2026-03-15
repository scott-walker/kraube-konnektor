# Sessions

Multi-turn conversations with persistent context.

## New Session

```ts
const claude = new Claude()
const session = claude.session()

const r1 = await session.query('What files are in src/?')
console.log(r1.text)

const r2 = await session.query('Refactor the largest file')
// Claude remembers the previous context
console.log(r2.text)

console.log(session.sessionId)  // "abc-123-..." (captured after first query)
console.log(session.queryCount) // 2
```

## Resume an Existing Session

```ts
const session = claude.session({ resume: 'abc-123-def-456' })

const result = await session.query('Continue where we left off')
```

::: tip
Session IDs are returned in every `QueryResult.sessionId`. Save them to resume conversations later — even across process restarts.
:::

## Continue the Most Recent Session

```ts
const session = claude.session({ continue: true })

const result = await session.query('What were we working on?')
```

## Fork a Session

Create a new branch from an existing session:

```ts
const session = claude.session({
  resume: 'original-session-id',
  fork: true,
})

// New session ID, but starts with the context of the original
const result = await session.query('Try a different approach')
```

## Streaming in Sessions

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

### Streaming with Fluent API

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

## Session Properties

| Property | Type | Description |
|----------|------|-------------|
| `sessionId` | `string \| null` | Session ID, available after the first query |
| `queryCount` | `number` | Number of queries executed in this session |

## Session Persistence

Disable session persistence for ephemeral/CI workloads:

```ts
const claude = new Claude({
  noSessionPersistence: true,
})

// Sessions are not saved to disk and cannot be resumed
const result = await claude.query('Run CI checks')
```

## Session Name

Set a display name visible in `/resume` and the terminal title:

```ts
const claude = new Claude({
  name: 'deploy-review-march-2026',
})
```

## Abort Within a Session

```ts
const session = claude.session()
const promise = session.query('Long analysis...')

setTimeout(() => session.abort(), 5_000)
```

## Session Utilities

List existing sessions and retrieve message history (SDK mode only):

### `listSessions` — Browse Past Sessions

```ts
import { listSessions } from '@scottwalker/claude-connector'

const sessions = await listSessions({
  dir: '/home/user/project',
  limit: 10,
  includeWorktrees: false,
})

for (const s of sessions) {
  console.log(`${s.sessionId} — ${s.summary}`)
  console.log(`  Last modified: ${new Date(s.lastModified).toLocaleString()}`)
}
```

### `getSessionMessages` — Read Session History

```ts
import { getSessionMessages } from '@scottwalker/claude-connector'

const messages = await getSessionMessages('abc-123-def-456', {
  dir: '/home/user/project',
  limit: 50,
  offset: 0,
})

for (const msg of messages) {
  console.log(`[${msg.type}] ${msg.uuid}`)
  console.log(msg.message)
}
```

## File Checkpointing

Track file changes during a session and rewind them to a previous state (SDK mode only):

```ts
const claude = new Claude({
  enableFileCheckpointing: true,
})

const r1 = await claude.query('Refactor the auth module')

// Rewind files to the state before the refactoring
const rewind = await claude.rewindFiles(r1.messages[0]?.content?.[0]?.id ?? '', {
  dryRun: true, // preview only — no files changed
})

console.log('Can rewind:', rewind.canRewind)
console.log('Files affected:', rewind.filesChanged)
console.log('Insertions:', rewind.insertions)
console.log('Deletions:', rewind.deletions)

// Actually rewind (omit dryRun or set to false)
const result = await claude.rewindFiles(r1.messages[0]?.content?.[0]?.id ?? '')
console.log('Files reverted:', result.filesChanged)
```

::: tip
Use `dryRun: true` first to preview which files would change. The `userMessageId` comes from the message history — it identifies the point in time to rewind to.
:::
