# Interactive Chat Example

A real-world example of using `kraube-konnektor` to build an interactive terminal chat with Claude Code.

## Two modes

| Command | Description |
|---------|-------------|
| `npm start` | Standard mode — sends a question, waits for the full answer |
| `npm run stream` | Streaming mode — response appears word by word in real time |

Both modes maintain conversation context (multi-turn sessions).

## Setup

```bash
cd examples/interactive-chat
npm install
```

## Usage

```bash
# Standard mode
npm start

# Streaming mode
npm run stream
```

```
╔══════════════════════════════════════════════╗
║         Claude Code Interactive Chat         ║
╚══════════════════════════════════════════════╝

you> What files are in the src directory?
claude> The src directory contains: index.ts, utils.ts, auth.ts...
[tokens: 150in/80out | 2300ms]

you> Which one has the most lines of code?
claude> auth.ts is the largest at 342 lines...
[tokens: 280in/60out | 1800ms]

you> exit
Bye!
```

## How it works

- Creates a `Claude` client with `permissionMode: 'plan'` (read-only, safe for demos)
- Uses `session()` to keep conversation context between messages
- Standard mode: `session.query()` returns the full result
- Streaming mode: `session.stream()` yields events as Claude generates the response
- Displays token usage, duration, and cost after each answer
