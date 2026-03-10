import type { ClientOptions, QueryOptions, QueryResult, StreamEvent } from '../types/index.js';
import type { SessionOptions } from '../types/session.js';
import type { IExecutor } from '../executor/interface.js';
import { CliExecutor } from '../executor/cli-executor.js';
import { buildArgs, mergeOptions, resolveEnv } from '../builder/args-builder.js';
import { validateClientOptions, validateQueryOptions, validatePrompt } from '../utils/validation.js';
import { Session } from './session.js';
import { Scheduler, type ScheduledJob } from '../scheduler/scheduler.js';

/**
 * Main entry point for claude-connector.
 *
 * `Claude` is a **facade** that orchestrates the executor, argument builder,
 * and parsers behind a clean, minimal API.
 *
 * ## Design principles
 *
 * - **Immutable configuration**: options are frozen at construction time.
 *   Per-query overrides are applied non-destructively.
 * - **Executor abstraction**: the client delegates all I/O to an {@link IExecutor}.
 *   Default is {@link CliExecutor}; pass a custom executor for testing or
 *   future transport mechanisms.
 * - **Stateless queries**: each `query()` / `stream()` call is independent.
 *   For stateful conversations, use `session()`.
 *
 * @example
 * ```ts
 * const claude = new Claude({
 *   executable: '/usr/local/bin/claude',
 *   model: 'sonnet',
 *   permissionMode: 'acceptEdits',
 * })
 *
 * const result = await claude.query('Find bugs in auth.ts')
 * console.log(result.text)
 * ```
 */
export class Claude {
  /** Frozen client-level options. */
  private readonly options: Readonly<ClientOptions>;

  /** Executor responsible for running CLI commands. */
  private readonly executor: IExecutor;

  constructor(options: ClientOptions = {}, executor?: IExecutor) {
    validateClientOptions(options);
    this.options = Object.freeze({ ...options });
    this.executor = executor ?? new CliExecutor(options.executable);
  }

  /**
   * Execute a one-shot query and return the complete result.
   *
   * @param prompt  - The question or instruction for Claude.
   * @param options - Per-query overrides (model, tools, limits, etc.).
   * @returns Complete query result with text, usage, session ID.
   *
   * @example
   * ```ts
   * const result = await claude.query('Refactor the auth module', {
   *   permissionMode: 'plan',
   *   maxTurns: 5,
   * })
   * ```
   */
  async query(prompt: string, options?: QueryOptions): Promise<QueryResult> {
    validatePrompt(prompt);
    if (options) validateQueryOptions(options);

    const resolved = mergeOptions(this.options, options, {
      prompt,
      outputFormat: 'json',
    });
    const args = buildArgs(resolved);
    const env = resolveEnv(this.options, options);

    return this.executor.execute(args, {
      cwd: resolved.cwd,
      env,
      input: options?.input,
    });
  }

  /**
   * Execute a query with streaming response.
   *
   * Returns an async iterable that yields events as they arrive.
   * The final event is always `type: 'result'` or `type: 'error'`.
   *
   * @example
   * ```ts
   * for await (const event of claude.stream('Rewrite this module')) {
   *   if (event.type === 'text') process.stdout.write(event.text)
   *   if (event.type === 'tool_use') console.log(`Using: ${event.toolName}`)
   * }
   * ```
   */
  async *stream(prompt: string, options?: QueryOptions): AsyncIterable<StreamEvent> {
    validatePrompt(prompt);
    if (options) validateQueryOptions(options);

    const resolved = mergeOptions(this.options, options, {
      prompt,
      outputFormat: 'stream-json',
    });
    const args = buildArgs(resolved);
    const env = resolveEnv(this.options, options);

    yield* this.executor.stream(args, {
      cwd: resolved.cwd,
      env,
      input: options?.input,
    });
  }

  /**
   * Create a session for multi-turn conversation.
   *
   * Sessions maintain context across queries by using Claude Code's
   * `--continue` and `--resume` flags.
   *
   * @example
   * ```ts
   * // New session
   * const session = claude.session()
   * await session.query('Analyze the architecture')
   * await session.query('Now suggest improvements')  // remembers context
   *
   * // Resume existing session
   * const s2 = claude.session({ resume: 'session-id-xxx' })
   *
   * // Fork a session
   * const s3 = claude.session({ resume: 'session-id-xxx', fork: true })
   * ```
   */
  session(sessionOptions?: SessionOptions): Session {
    return new Session(this.options, this.executor, sessionOptions);
  }

  /**
   * Schedule a recurring query (equivalent of /loop).
   *
   * Since /loop only works in interactive CLI mode, this implements
   * the same behavior at the Node.js level using setInterval.
   *
   * @param interval - Interval string ('5m', '1h', '30s') or milliseconds.
   * @param prompt   - Query to execute on each tick.
   * @param options  - Per-query overrides.
   * @returns A ScheduledJob that can be stopped and emits results.
   *
   * @example
   * ```ts
   * const job = claude.loop('5m', 'Check deployment status')
   * job.on('result', (r) => console.log(r.text))
   * job.on('error', (e) => console.error(e))
   * // Later:
   * job.stop()
   * ```
   */
  loop(interval: string | number, prompt: string, options?: QueryOptions): ScheduledJob {
    const scheduler = new Scheduler(this);
    return scheduler.schedule(interval, prompt, options);
  }

  /**
   * Run multiple queries in parallel.
   *
   * Each query spawns an independent CLI process. Useful for parallelizing
   * independent tasks across different directories or with different configs.
   *
   * @example
   * ```ts
   * const [bugs, tests, docs] = await claude.parallel([
   *   { prompt: 'Find bugs', options: { cwd: './src' } },
   *   { prompt: 'Run tests', options: { cwd: './tests' } },
   *   { prompt: 'Check docs', options: { permissionMode: 'plan' } },
   * ])
   * ```
   */
  async parallel(
    queries: readonly { prompt: string; options?: QueryOptions }[],
  ): Promise<QueryResult[]> {
    return Promise.all(
      queries.map(({ prompt, options }) => this.query(prompt, options)),
    );
  }

  /**
   * Abort any running execution on the underlying executor.
   */
  abort(): void {
    this.executor.abort?.();
  }

  /**
   * Access the underlying executor (for advanced use / testing).
   */
  getExecutor(): IExecutor {
    return this.executor;
  }
}
