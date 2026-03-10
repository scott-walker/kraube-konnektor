import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ScheduledJob, Scheduler } from '../src/scheduler/scheduler.js';
import type { QueryResult, QueryOptions } from '../src/types/index.js';
import { ValidationError } from '../src/errors/errors.js';

function createMockResult(text = 'OK'): QueryResult {
  return {
    text,
    sessionId: 'sess-1',
    usage: { inputTokens: 10, outputTokens: 20 },
    cost: null,
    durationMs: 100,
    messages: [],
    structured: null,
    raw: {},
  };
}

describe('ScheduledJob', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('executes immediately on start', async () => {
    const queryFn = vi.fn().mockResolvedValue(createMockResult());
    const job = new ScheduledJob(60_000, 'Test', queryFn);

    job.start();
    await vi.advanceTimersByTimeAsync(0);

    expect(queryFn).toHaveBeenCalledOnce();
    expect(job.tickCount).toBe(1);

    job.stop();
  });

  it('emits result events', async () => {
    const queryFn = vi.fn().mockResolvedValue(createMockResult('Hello'));
    const job = new ScheduledJob(60_000, 'Test', queryFn);
    const results: QueryResult[] = [];
    job.on('result', (r) => results.push(r));

    job.start();
    await vi.advanceTimersByTimeAsync(0);

    expect(results).toHaveLength(1);
    expect(results[0]!.text).toBe('Hello');

    job.stop();
  });

  it('emits error events on failure', async () => {
    const queryFn = vi.fn().mockRejectedValue(new Error('fail'));
    const job = new ScheduledJob(60_000, 'Test', queryFn);
    const errors: Error[] = [];
    job.on('error', (e) => errors.push(e));

    job.start();
    await vi.advanceTimersByTimeAsync(0);

    expect(errors).toHaveLength(1);
    expect(errors[0]!.message).toBe('fail');

    job.stop();
  });

  it('repeats at the configured interval', async () => {
    const queryFn = vi.fn().mockResolvedValue(createMockResult());
    const job = new ScheduledJob(5_000, 'Test', queryFn);

    job.start();
    await vi.advanceTimersByTimeAsync(0);         // tick 1 (immediate)
    await vi.advanceTimersByTimeAsync(5_000);      // tick 2
    await vi.advanceTimersByTimeAsync(5_000);      // tick 3

    expect(queryFn).toHaveBeenCalledTimes(3);
    expect(job.tickCount).toBe(3);

    job.stop();
  });

  it('stops cleanly', async () => {
    const queryFn = vi.fn().mockResolvedValue(createMockResult());
    const job = new ScheduledJob(1_000, 'Test', queryFn);
    let stopped = false;
    job.on('stop', () => { stopped = true; });

    job.start();
    await vi.advanceTimersByTimeAsync(0);
    job.stop();

    await vi.advanceTimersByTimeAsync(5_000);

    expect(queryFn).toHaveBeenCalledOnce(); // no more after stop
    expect(stopped).toBe(true);
    expect(job.stopped).toBe(true);
  });

  it('does not overlap when previous tick is still running', async () => {
    let resolveQuery: (() => void) | null = null;
    const queryFn = vi.fn().mockImplementation(
      () => new Promise<QueryResult>((resolve) => {
        resolveQuery = () => resolve(createMockResult());
      }),
    );

    const job = new ScheduledJob(1_000, 'Test', queryFn);
    job.start();
    await vi.advanceTimersByTimeAsync(0);

    // First tick is still running (not resolved)
    expect(job.running).toBe(true);

    // Advance past several intervals — should NOT call queryFn again
    await vi.advanceTimersByTimeAsync(3_000);
    expect(queryFn).toHaveBeenCalledOnce();

    // Resolve the first query
    resolveQuery!();
    await vi.advanceTimersByTimeAsync(0);

    // Now next tick should fire
    await vi.advanceTimersByTimeAsync(1_000);
    expect(queryFn).toHaveBeenCalledTimes(2);

    job.stop();
  });
});

describe('Scheduler', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('parses interval strings correctly', async () => {
    const queryFn = vi.fn().mockResolvedValue(createMockResult());
    const client = { query: queryFn };
    const scheduler = new Scheduler(client);

    const job = scheduler.schedule('5m', 'Test');
    expect(job.intervalMs).toBe(300_000);
    job.stop();
  });

  it('rejects invalid interval format', () => {
    const client = { query: vi.fn() };
    const scheduler = new Scheduler(client);

    expect(() => scheduler.schedule('invalid', 'Test')).toThrow(ValidationError);
  });

  it('accepts numeric milliseconds', async () => {
    const queryFn = vi.fn().mockResolvedValue(createMockResult());
    const client = { query: queryFn };
    const scheduler = new Scheduler(client);

    const job = scheduler.schedule(10_000, 'Test');
    expect(job.intervalMs).toBe(10_000);
    job.stop();
  });
});
