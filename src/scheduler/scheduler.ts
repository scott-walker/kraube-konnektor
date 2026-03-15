import { EventEmitter } from 'node:events';
import type { QueryOptions, QueryResult } from '../types/index.js';
import { ValidationError } from '../errors/errors.js';
import {
  SCHED_RESULT,
  SCHED_ERROR,
  SCHED_TICK,
  SCHED_STOP,
  INTERVAL_MULTIPLIERS,
} from '../constants.js';

/**
 * Interval string parser.
 * Supports: '30s', '5m', '2h', '1d', or raw milliseconds.
 */
function parseInterval(interval: string | number): number {
  if (typeof interval === 'number') return interval;

  const match = interval.match(/^(\d+(?:\.\d+)?)\s*(s|m|h|d)$/i);
  if (!match) {
    throw new ValidationError('interval', `Invalid format '${interval}'. Use: '30s', '5m', '2h', '1d'`);
  }

  const value = parseFloat(match[1]!);
  const unit = match[2]!.toLowerCase();

  return Math.round(value * INTERVAL_MULTIPLIERS[unit]!);
}

/**
 * Event map for ScheduledJob.
 */
export interface ScheduledJobEvents {
  result: [QueryResult];
  error: [Error];
  tick: [number]; // tick count
  stop: [];
}

/**
 * A scheduled recurring query job.
 *
 * Implements the equivalent of Claude Code's `/loop` command,
 * but at the Node.js level — so it works outside interactive sessions.
 *
 * @example
 * ```ts
 * const job = claude.loop('5m', 'Check deploy status')
 * job.on('result', (r) => console.log(r.text))
 * job.on('error', (e) => console.error(e))
 * job.stop()
 * ```
 */
export class ScheduledJob extends EventEmitter<ScheduledJobEvents> {
  private timer: ReturnType<typeof setInterval> | null = null;
  private _tickCount = 0;
  private _running = false;
  private _stopped = false;

  readonly intervalMs: number;
  readonly prompt: string;

  constructor(
    intervalMs: number,
    prompt: string,
    private readonly queryFn: (prompt: string, options?: QueryOptions) => Promise<QueryResult>,
    private readonly options?: QueryOptions,
  ) {
    super();
    this.intervalMs = intervalMs;
    this.prompt = prompt;
  }

  /** Number of ticks (executions) so far. */
  get tickCount(): number {
    return this._tickCount;
  }

  /** Whether a query is currently running. */
  get running(): boolean {
    return this._running;
  }

  /** Whether the job has been stopped. */
  get stopped(): boolean {
    return this._stopped;
  }

  /**
   * Start the scheduled job.
   * Executes immediately, then repeats at the configured interval.
   */
  start(): this {
    if (this._stopped) return this;

    // Execute immediately on first tick
    void this.tick();

    this.timer = setInterval(() => {
      // Skip if previous tick is still running (no overlap)
      if (!this._running) {
        void this.tick();
      }
    }, this.intervalMs);

    // Allow the process to exit even if the timer is running
    if (this.timer && typeof this.timer === 'object' && 'unref' in this.timer) {
      this.timer.unref();
    }

    return this;
  }

  /**
   * Stop the scheduled job.
   */
  stop(): void {
    this._stopped = true;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.emit(SCHED_STOP);
  }

  private async tick(): Promise<void> {
    this._running = true;
    this._tickCount++;
    this.emit(SCHED_TICK, this._tickCount);

    try {
      const result = await this.queryFn(this.prompt, this.options);
      if (!this._stopped) {
        this.emit(SCHED_RESULT, result);
      }
    } catch (error) {
      if (!this._stopped) {
        this.emit(SCHED_ERROR, error instanceof Error ? error : new Error(String(error)));
      }
    } finally {
      this._running = false;
    }
  }
}

/**
 * Scheduler factory — creates ScheduledJob instances.
 *
 * Separated from Claude class to keep the client focused on core query logic.
 */
export class Scheduler {
  constructor(
    private readonly client: { query: (prompt: string, options?: QueryOptions) => Promise<QueryResult> },
  ) {}

  schedule(interval: string | number, prompt: string, options?: QueryOptions): ScheduledJob {
    const ms = parseInterval(interval);
    const job = new ScheduledJob(ms, prompt, (p, o) => this.client.query(p, o), options);
    return job.start();
  }
}
