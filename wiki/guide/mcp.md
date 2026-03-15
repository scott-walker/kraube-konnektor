# MCP Servers

Connect [Model Context Protocol](https://modelcontextprotocol.io/) servers to extend Claude's capabilities.

## From Config Files

```ts
const claude = new Claude({
  mcpConfig: './mcp-servers.json',
})

// Multiple config files
const claude = new Claude({
  mcpConfig: ['./mcp-local.json', './mcp-shared.json'],
})
```

## Inline Server Definitions

Define servers directly in code using `mcpServers`:

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

::: tip
Three transport types are supported: `stdio` (local process), `http` (HTTP endpoint), and `sse` (Server-Sent Events). These correspond to the constants `MCP_STDIO`, `MCP_HTTP`, and `MCP_SSE`.
:::

## Mixed: Config Files + Inline

```ts
const claude = new Claude({
  mcpConfig: './base-servers.json',
  mcpServers: {
    custom: { type: 'stdio', command: 'my-mcp-tool' },
  },
})
```

## Strict MCP Config

Ignore all MCP servers except the ones explicitly provided:

```ts
const claude = new Claude({
  mcpConfig: './my-servers.json',
  strictMcpConfig: true,
})
```

::: warning
With `strictMcpConfig: true`, any MCP servers configured globally or in project settings are ignored. Only the servers you specify in `mcpConfig` and `mcpServers` are available.
:::

## In-Process MCP Tools

Define custom tools that run inside your Node.js process using `createSdkMcpServer` and `sdkTool` (SDK mode only):

```ts
import { Claude, createSdkMcpServer, sdkTool } from '@scottwalker/claude-connector'
import { z } from 'zod/v4'

const server = await createSdkMcpServer({
  name: 'my-tools',
  tools: [
    await sdkTool(
      'getPrice',
      'Get current stock price',
      { ticker: z.string() },
      async ({ ticker }) => ({
        content: [{ type: 'text', text: `${ticker}: $142.50` }],
      }),
    ),
    await sdkTool(
      'getWeather',
      'Get weather for a city',
      { city: z.string() },
      async ({ city }) => ({
        content: [{ type: 'text', text: `${city}: 22°C, sunny` }],
      }),
      { annotations: { readOnly: true } },
    ),
  ],
})

const claude = new Claude({
  mcpServers: { stocks: server },
})

const result = await claude.query('What is the price of AAPL?')
```

::: tip
In-process MCP tools avoid external processes — the tool handler runs directly in your Node.js runtime. Ideal for integrating application-specific logic.
:::

## Dynamic MCP Management

Add, remove, reconnect, and toggle MCP servers at runtime (SDK mode only):

### `setMcpServers` — Add or Replace Servers

```ts
const claude = new Claude()

const result = await claude.setMcpServers({
  analytics: {
    type: 'stdio',
    command: 'mcp-analytics',
    args: ['--verbose'],
  },
})

console.log('Added:', result.added)     // ['analytics']
console.log('Removed:', result.removed) // []
console.log('Errors:', result.errors)   // {}
```

### `reconnectMcpServer` — Reconnect a Failed Server

```ts
await claude.reconnectMcpServer('analytics')
```

### `toggleMcpServer` — Enable or Disable a Server

```ts
// Disable a server (its tools become unavailable)
await claude.toggleMcpServer('analytics', false)

// Re-enable it
await claude.toggleMcpServer('analytics', true)
```
