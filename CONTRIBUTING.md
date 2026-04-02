# Contributing

Thank you for your interest in contributing to kraube-konnektor!

## Development Setup

```bash
git clone git@github.com:scott-walker/kraube-konnektor.git
cd kraube-konnektor
npm install
npm run build
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run build` | Compile TypeScript to `dist/` |
| `npm run dev` | Watch mode compilation |
| `npm test` | Run unit tests |
| `npm run test:watch` | Run tests in watch mode |
| `npm run test:coverage` | Run tests with coverage report |
| `npm run test:integration` | Build + run integration test |
| `npm run typecheck` | Type-check without emitting |

## Project Structure

```
src/
├── client/      Claude (facade) + Session
├── executor/    IExecutor (abstraction) + CliExecutor
├── builder/     Options -> CLI args
├── parser/      JSON + NDJSON stream parsing
├── scheduler/   Recurring execution (/loop)
├── errors/      Error hierarchy
├── types/       TypeScript interfaces
└── utils/       Validation
```

See [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) for design principles and detailed layer descriptions.

## Adding a New CLI Flag

1. Add the option to `ClientOptions` and/or `QueryOptions` in `src/types/client.ts`
2. Add merging logic in `mergeOptions()` in `src/builder/args-builder.ts`
3. Add argument building in `buildArgs()` in `src/builder/args-builder.ts`
4. Add tests in `tests/args-builder.test.ts`
5. Update `docs/API.md`

No changes needed in executor, parser, or client classes.

## Adding a New Executor

1. Create `src/executor/my-executor.ts` implementing `IExecutor`
2. Export it from `src/executor/index.ts` and `src/index.ts`
3. Add tests

## Guidelines

- Zero runtime dependencies policy
- All public API must have JSDoc comments
- Every new feature needs tests
- Run `npm run typecheck && npm test` before submitting

## Commit Messages

Use conventional format:

```
feat: add worktree support
fix: handle empty CLI output
docs: update API reference
test: add session resume tests
```
