import { describe, it, expect, vi } from 'vitest';
import { Claude } from '../src/client/claude.js';
import type { IExecutor, ExecuteOptions } from '../src/executor/interface.js';
import type { QueryResult, StreamEvent } from '../src/types/index.js';
import { ValidationError } from '../src/errors/errors.js';

/** Creates a mock executor that returns a predefined result. */
function createMockExecutor(result: Partial<QueryResult> = {}): IExecutor {
  const defaultResult: QueryResult = {
    text: result.text ?? 'mock response',
    sessionId: result.sessionId ?? 'mock-session-id',
    usage: result.usage ?? { inputTokens: 10, outputTokens: 20 },
    cost: result.cost ?? null,
    durationMs: result.durationMs ?? 100,
    messages: result.messages ?? [],
    structured: result.structured ?? null,
    raw: result.raw ?? {},
  };

  return {
    execute: vi.fn().mockResolvedValue(defaultResult),
    stream: vi.fn().mockImplementation(async function* () {
      yield { type: 'text', text: defaultResult.text } as StreamEvent;
      yield {
        type: 'result',
        text: defaultResult.text,
        sessionId: defaultResult.sessionId,
        usage: defaultResult.usage,
        cost: defaultResult.cost,
        durationMs: defaultResult.durationMs,
      } as StreamEvent;
    }),
    abort: vi.fn(),
  };
}

describe('Claude', () => {
  it('creates an instance with default options', () => {
    const executor = createMockExecutor();
    const claude = new Claude({}, executor);

    expect(claude).toBeInstanceOf(Claude);
  });

  it('validates options at construction', () => {
    const executor = createMockExecutor();

    expect(() => new Claude({ maxTurns: -1 }, executor)).toThrow(ValidationError);
  });

  describe('query()', () => {
    it('executes a simple query', async () => {
      const executor = createMockExecutor({ text: 'Hello!' });
      const claude = new Claude({}, executor);

      const result = await claude.query('Say hello');

      expect(result.text).toBe('Hello!');
      expect(executor.execute).toHaveBeenCalledOnce();
    });

    it('passes correct args to executor', async () => {
      const executor = createMockExecutor();
      const claude = new Claude({ model: 'opus', permissionMode: 'plan' }, executor);

      await claude.query('Test');

      const [args] = (executor.execute as ReturnType<typeof vi.fn>).mock.calls[0] as [string[], ExecuteOptions];
      expect(args).toContain('--model');
      expect(args).toContain('opus');
      expect(args).toContain('--permission-mode');
      expect(args).toContain('plan');
      expect(args).toContain('--output-format');
      expect(args).toContain('json');
    });

    it('passes per-query overrides', async () => {
      const executor = createMockExecutor();
      const claude = new Claude({ model: 'sonnet' }, executor);

      await claude.query('Test', { model: 'opus', maxTurns: 3 });

      const [args] = (executor.execute as ReturnType<typeof vi.fn>).mock.calls[0] as [string[], ExecuteOptions];
      expect(args).toContain('opus');
      expect(args).not.toContain('sonnet');
      expect(args).toContain('--max-turns');
      expect(args).toContain('3');
    });

    it('passes input as stdin', async () => {
      const executor = createMockExecutor();
      const claude = new Claude({}, executor);

      await claude.query('Analyze this', { input: 'file contents here' });

      const [, options] = (executor.execute as ReturnType<typeof vi.fn>).mock.calls[0] as [string[], ExecuteOptions];
      expect(options.input).toBe('file contents here');
    });

    it('validates prompt', async () => {
      const executor = createMockExecutor();
      const claude = new Claude({}, executor);

      await expect(claude.query('')).rejects.toThrow(ValidationError);
    });

    it('validates query options', async () => {
      const executor = createMockExecutor();
      const claude = new Claude({}, executor);

      await expect(claude.query('Test', { maxTurns: -1 })).rejects.toThrow(ValidationError);
    });
  });

  describe('stream()', () => {
    it('yields streaming events', async () => {
      const executor = createMockExecutor({ text: 'Streamed!' });
      const claude = new Claude({}, executor);

      const events: StreamEvent[] = [];
      for await (const event of claude.stream('Stream this')) {
        events.push(event);
      }

      expect(events).toHaveLength(2);
      expect(events[0]!.type).toBe('text');
      expect(events[1]!.type).toBe('result');
    });

    it('uses stream-json output format', async () => {
      const executor = createMockExecutor();
      const claude = new Claude({}, executor);

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      for await (const _ of claude.stream('Test')) { /* consume */ }

      const [args] = (executor.stream as ReturnType<typeof vi.fn>).mock.calls[0] as [string[], ExecuteOptions];
      expect(args).toContain('stream-json');
    });
  });

  describe('session()', () => {
    it('creates a new session', () => {
      const executor = createMockExecutor();
      const claude = new Claude({}, executor);

      const session = claude.session();
      expect(session.sessionId).toBeNull();
      expect(session.queryCount).toBe(0);
    });

    it('creates a session with resume option', () => {
      const executor = createMockExecutor();
      const claude = new Claude({}, executor);

      const session = claude.session({ resume: 'abc-123' });
      expect(session.sessionId).toBe('abc-123');
    });
  });

  describe('parallel()', () => {
    it('executes multiple queries in parallel', async () => {
      const executor = createMockExecutor();
      const claude = new Claude({}, executor);

      const results = await claude.parallel([
        { prompt: 'Query 1' },
        { prompt: 'Query 2' },
        { prompt: 'Query 3' },
      ]);

      expect(results).toHaveLength(3);
      expect(executor.execute).toHaveBeenCalledTimes(3);
    });
  });

  describe('abort()', () => {
    it('calls abort on executor', () => {
      const executor = createMockExecutor();
      const claude = new Claude({}, executor);

      claude.abort();

      expect(executor.abort).toHaveBeenCalledOnce();
    });
  });
});
