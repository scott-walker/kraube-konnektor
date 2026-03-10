# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-03-10

### Added

- `Claude` client with `query()`, `stream()`, `parallel()`, and `abort()` methods
- `Session` for multi-turn conversations with `--resume` / `--continue` support
- `ScheduledJob` via `claude.loop()` — recurring queries (Node.js-level `/loop`)
- `IExecutor` abstraction for swappable CLI backends
- `CliExecutor` — default implementation spawning `claude -p`
- Full `ClientOptions` covering all Claude Code CLI flags:
  - `executable` — path to CLI binary (multiple installations)
  - `model`, `effortLevel`, `fallbackModel` — model configuration
  - `permissionMode`, `allowedTools`, `disallowedTools` — permission control
  - `systemPrompt`, `appendSystemPrompt` — prompt customization
  - `maxTurns`, `maxBudget` — execution limits
  - `mcpConfig`, `mcpServers` — MCP server integration
  - `agents` — custom subagent definitions
  - `hooks` — lifecycle hooks (PreToolUse, PostToolUse, etc.)
  - `worktree` — git worktree isolation
  - `additionalDirs` — extra working directories
  - `schema` — JSON Schema for structured output
  - `input` — piped stdin data
- Per-query option overrides via `QueryOptions`
- Streaming via NDJSON parsing (`--output-format stream-json`)
- Typed error hierarchy: `CliNotFoundError`, `CliExecutionError`, `CliTimeoutError`, `ParseError`, `ValidationError`
- 82 unit tests
- Integration test suite (`examples/integration-test/`)
- Architecture documentation (`docs/ARCHITECTURE.md`)
- API reference (`docs/API.md`)
