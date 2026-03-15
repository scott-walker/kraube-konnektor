# Tools

Control which tools Claude can use and which require approval.

## `allowedTools` — Auto-Approve Specific Tools

These tools run without prompting. Others still require approval:

```ts
const claude = new Claude({
  allowedTools: ['Read', 'Glob', 'Grep', 'Bash(npm run *)'],
})
```

## `disallowedTools` — Block Specific Tools

These tools are always denied:

```ts
const claude = new Claude({
  disallowedTools: ['Bash(rm *)', 'Write'],
})
```

## `tools` — Restrict the Available Tool Set

Controls which tools **exist** — Claude cannot use tools outside this list:

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

## `tools` vs `allowedTools` — The Difference

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

::: tip
Think of `tools` as "what exists" and `allowedTools` as "what's pre-approved." Use `tools` to limit Claude's capabilities, and `allowedTools` to streamline common operations.
:::

## Permission Modes

Six permission modes control how Claude handles tool approval:

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
```

| Constant | Value | Description |
|----------|-------|-------------|
| `PERMISSION_DEFAULT` | `'default'` | Prompt on first use (default behavior) |
| `PERMISSION_ACCEPT_EDITS` | `'acceptEdits'` | Auto-accept file edits |
| `PERMISSION_PLAN` | `'plan'` | Read-only — no modifications allowed |
| `PERMISSION_AUTO` | `'auto'` | Automatic tool approval based on risk |
| `PERMISSION_BYPASS` | `'bypassPermissions'` | Skip all permission checks |
| `PERMISSION_DONT_ASK` | `'dontAsk'` | Skip all checks, don't even ask |

```ts
// Read-only — no modifications allowed
new Claude({ permissionMode: PERMISSION_PLAN })

// Auto-accept file edits
new Claude({ permissionMode: PERMISSION_ACCEPT_EDITS })

// Automatic tool approval based on risk
new Claude({ permissionMode: PERMISSION_AUTO })

// Skip all permission checks (use only in sandboxed environments)
new Claude({ permissionMode: PERMISSION_BYPASS })

// Skip all checks, don't even ask
new Claude({ permissionMode: PERMISSION_DONT_ASK })
```

::: warning
`PERMISSION_BYPASS` and `PERMISSION_DONT_ASK` skip all safety checks. Only use them in fully sandboxed or CI environments where Claude's actions cannot cause harm.
:::

## Programmatic Permissions

Use `canUseTool` to implement custom permission logic in code (SDK mode only):

```ts
const claude = new Claude({
  canUseTool: async (toolName, input, { signal }) => {
    // Block dangerous shell commands
    if (toolName === 'Bash' && String(input.command).includes('rm -rf')) {
      return { behavior: 'deny', message: 'Destructive command blocked' }
    }

    // Allow read-only tools unconditionally
    if (['Read', 'Glob', 'Grep'].includes(toolName)) {
      return { behavior: 'allow' }
    }

    // Everything else — allow but could also return 'deny'
    return { behavior: 'allow' }
  },
})
```

::: tip
`canUseTool` is called before every tool execution. Return `{ behavior: 'allow' }` to proceed, or `{ behavior: 'deny', message: '...' }` to block. You can also modify the tool input via `updatedInput` in the allow response.
:::

## Runtime Permission Switch

Change the permission mode mid-session (SDK mode only):

```ts
import {
  Claude,
  PERMISSION_PLAN,
  PERMISSION_ACCEPT_EDITS,
} from '@scottwalker/claude-connector'

const claude = new Claude({ permissionMode: PERMISSION_PLAN })

// Start with read-only analysis
const r1 = await claude.query('Review the auth module for vulnerabilities')

// Now allow edits for the fix
await claude.setPermissionMode(PERMISSION_ACCEPT_EDITS)

const r2 = await claude.query('Fix the vulnerabilities you found')
```
