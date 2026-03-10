import { describe, it, expect, vi } from 'vitest';
import { Session } from '../src/client/session.js';
import type { IExecutor, ExecuteOptions } from '../src/executor/interface.js';
import type { QueryResult, StreamEvent } from '../src/types/index.js';

function createMockExecutor(sessionId = 'sess-001'): IExecutor {
  const result: QueryResult = {
    text: 'response',
    sessionId,
    usage: { inputTokens: 10, outputTokens: 20 },
    cost: null,
    durationMs: 100,
    messages: [],
    structured: null,
    raw: {},
  };

  return {
    execute: vi.fn().mockResolvedValue(result),
    stream: vi.fn().mockImplementation(async function* () {
      yield {
        type: 'result',
        text: 'response',
        sessionId,
        usage: { inputTokens: 10, outputTokens: 20 },
        cost: null,
        durationMs: 100,
      } as StreamEvent;
    }),
    abort: vi.fn(),
  };
}

describe('Session', () => {
  it('starts with no session ID for new sessions', () => {
    const session = new Session({}, createMockExecutor());

    expect(session.sessionId).toBeNull();
    expect(session.queryCount).toBe(0);
  });

  it('captures session ID after first query', async () => {
    const executor = createMockExecutor('new-sess-123');
    const session = new Session({}, executor);

    await session.query('Hello');

    expect(session.sessionId).toBe('new-sess-123');
    expect(session.queryCount).toBe(1);
  });

  it('uses --continue on first query when continue option is set', async () => {
    const executor = createMockExecutor();
    const session = new Session({}, executor, { continue: true });

    await session.query('Continue please');

    const [args] = (executor.execute as ReturnType<typeof vi.fn>).mock.calls[0] as [string[], ExecuteOptions];
    expect(args).toContain('--continue');
  });

  it('uses --resume with session ID on subsequent queries', async () => {
    const executor = createMockExecutor('sess-abc');
    const session = new Session({}, executor);

    await session.query('First query');
    await session.query('Second query');

    const [args] = (executor.execute as ReturnType<typeof vi.fn>).mock.calls[1] as [string[], ExecuteOptions];
    expect(args).toContain('--resume');
    expect(args).toContain('sess-abc');
  });

  it('uses --fork-session when fork option is set', async () => {
    const executor = createMockExecutor();
    const session = new Session({}, executor, { resume: 'original-sess', fork: true });

    await session.query('Fork this');

    const [args] = (executor.execute as ReturnType<typeof vi.fn>).mock.calls[0] as [string[], ExecuteOptions];
    expect(args).toContain('--fork-session');
    expect(args).toContain('--resume');
    expect(args).toContain('original-sess');
  });

  it('does not use --continue after first query', async () => {
    const executor = createMockExecutor('sess-1');
    const session = new Session({}, executor, { continue: true });

    await session.query('First');
    await session.query('Second');

    const [args2] = (executor.execute as ReturnType<typeof vi.fn>).mock.calls[1] as [string[], ExecuteOptions];
    expect(args2).not.toContain('--continue');
    // Should use --resume instead
    expect(args2).toContain('--resume');
  });

  it('increments query count on each query', async () => {
    const executor = createMockExecutor();
    const session = new Session({}, executor);

    await session.query('One');
    await session.query('Two');
    await session.query('Three');

    expect(session.queryCount).toBe(3);
  });

  it('captures session ID from stream result events', async () => {
    const executor = createMockExecutor('stream-sess');
    const session = new Session({}, executor);

    for await (const _ of session.stream('Hello')) {
      // consume
    }

    expect(session.sessionId).toBe('stream-sess');
    expect(session.queryCount).toBe(1);
  });

  it('pre-populates session ID when resume option is set', () => {
    const session = new Session({}, createMockExecutor(), { resume: 'existing-sess' });

    expect(session.sessionId).toBe('existing-sess');
  });
});
