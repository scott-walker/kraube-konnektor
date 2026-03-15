import type { ClientOptions, QueryOptions, QueryResult, StreamEvent } from '../types/index.js';
import type { SessionOptions } from '../types/session.js';
import type { IExecutor } from '../executor/interface.js';
import { CliExecutor } from '../executor/cli-executor.js';
import { SdkExecutor, type InitStage, type SdkExecutorOptions } from '../executor/sdk-executor.js';
import { buildArgs, mergeOptions, resolveEnv } from '../builder/args-builder.js';
import { validateClientOptions, validateQueryOptions, validatePrompt } from '../utils/validation.js';
import {
  FORMAT_JSON,
  FORMAT_STREAM_JSON,
  DEFAULT_EXECUTABLE,
  INIT_EVENT_STAGE,
  INIT_EVENT_READY,
  INIT_EVENT_ERROR,
} from '../constants.js';
import { Session } from './session.js';
import { StreamHandle } from './stream-handle.js';
import { ChatHandle } from './chat-handle.js';
import { Scheduler, type ScheduledJob } from '../scheduler/scheduler.js';

/**
 * Main entry point for claude-connector.
 *
 * @example
 * ```ts
 * const claude = new Claude({ model: 'sonnet' })
 * const result = await claude.query('Fix bugs')
 *
 * // Streaming with fluent API
 * await claude.stream('Explain auth.ts')
 *   .on('text', (t) => process.stdout.write(t))
 *   .done()
 *
 * // Bidirectional chat
 * const chat = claude.chat()
 * await chat.send('What files are in src?')
 * await chat.send('Fix the largest one')
 * chat.end()
 * ```
 */
export class Claude {
  private readonly options: Readonly<ClientOptions>;
  private readonly executor: IExecutor;
  private readonly sdkExecutor: SdkExecutor | null = null;

  constructor(options: ClientOptions = {}, executor?: IExecutor) {
    validateClientOptions(options);
    this.options = Object.freeze({ ...options });

    const useSdk = options.useSdk !== false;

    if (executor) {
      this.executor = executor;
    } else if (useSdk) {
      const sdkOpts: SdkExecutorOptions = {
        model: options.model,
        pathToClaudeCodeExecutable: options.executable,
        permissionMode: options.permissionMode,
        allowedTools: options.allowedTools ? [...options.allowedTools] : undefined,
        disallowedTools: options.disallowedTools ? [...options.disallowedTools] : undefined,
        env: options.env,
        systemPrompt: options.systemPrompt,
        appendSystemPrompt: options.appendSystemPrompt,
        maxTurns: options.maxTurns,
      };
      this.sdkExecutor = new SdkExecutor(sdkOpts);
      this.executor = this.sdkExecutor;
    } else {
      this.executor = new CliExecutor(options.executable);
    }
  }

  /**
   * Initialize the SDK session (warm up).
   * Only needed when `useSdk: true`. In CLI mode this is a no-op.
   */
  async init(): Promise<void> {
    if (this.sdkExecutor) {
      await this.sdkExecutor.init();
    }
  }

  /** Whether the SDK session is initialized and ready (always true for CLI mode). */
  get ready(): boolean {
    if (this.sdkExecutor) return this.sdkExecutor.ready;
    return true;
  }

  /**
   * Subscribe to initialization events.
   */
  on(event: typeof INIT_EVENT_STAGE, listener: (stage: InitStage, message: string) => void): this;
  on(event: typeof INIT_EVENT_READY, listener: () => void): this;
  on(event: typeof INIT_EVENT_ERROR, listener: (error: Error) => void): this;
  on(event: string, listener: (...args: never[]) => void): this;
  on(event: string, listener: (...args: never[]) => void): this {
    if (this.sdkExecutor) {
      this.sdkExecutor.on(event as typeof INIT_EVENT_STAGE, listener as (stage: InitStage, message: string) => void);
    }
    return this;
  }

  /**
   * Execute a one-shot query and return the complete result.
   */
  async query(prompt: string, options?: QueryOptions): Promise<QueryResult> {
    validatePrompt(prompt);
    if (options) validateQueryOptions(options);

    const resolved = mergeOptions(this.options, options, {
      prompt,
      outputFormat: FORMAT_JSON,
    });
    const args = buildArgs(resolved);
    const env = resolveEnv(this.options, options);

    return this.executor.execute(args, {
      cwd: resolved.cwd,
      env,
      input: options?.input,
      systemPrompt: resolved.systemPrompt,
    });
  }

  /**
   * Execute a query with streaming response.
   * Returns a {@link StreamHandle} with fluent callbacks, Node.js stream support,
   * and backward-compatible async iteration.
   *
   * ```ts
   * // Fluent
   * await claude.stream('Fix bugs').on('text', t => process.stdout.write(t)).done()
   *
   * // Collect text
   * const text = await claude.stream('Summarize').text()
   *
   * // Pipe
   * const result = await claude.stream('Explain').pipe(process.stdout)
   *
   * // Node.js Readable
   * claude.stream('Generate').toReadable().pipe(createWriteStream('out.txt'))
   *
   * // Raw iteration (backward compat)
   * for await (const event of claude.stream('Analyze')) { ... }
   * ```
   */
  stream(prompt: string, options?: QueryOptions): StreamHandle {
    validatePrompt(prompt);
    if (options) validateQueryOptions(options);

    const resolved = mergeOptions(this.options, options, {
      prompt,
      outputFormat: FORMAT_STREAM_JSON,
    });
    const args = buildArgs(resolved);
    const env = resolveEnv(this.options, options);

    const executor = this.executor;
    const execOpts = {
      cwd: resolved.cwd,
      env,
      input: options?.input,
      systemPrompt: resolved.systemPrompt,
    };

    return new StreamHandle(() => executor.stream(args, execOpts));
  }

  /**
   * Open a bidirectional chat — a persistent CLI process for real-time conversation.
   * Uses `--input-format stream-json` for multi-turn dialogue over a single process.
   *
   * ```ts
   * const chat = claude.chat()
   *   .on('text', (t) => process.stdout.write(t))
   *
   * await chat.send('What files are in src?')
   * await chat.send('Now fix the bugs')
   * chat.end()
   * ```
   */
  chat(options?: QueryOptions): ChatHandle {
    if (options) validateQueryOptions(options);

    const resolved = mergeOptions(this.options, options, {
      prompt: undefined as unknown as string,
      outputFormat: FORMAT_STREAM_JSON,
    });

    // Override: chat mode uses bidirectional stream-json
    const args = buildArgs({
      ...resolved,
      prompt: undefined,
      inputFormat: FORMAT_STREAM_JSON,
    });

    const env = resolveEnv(this.options, options);
    const executable = this.options.executable ?? DEFAULT_EXECUTABLE;

    return new ChatHandle(executable, args, {
      cwd: resolved.cwd,
      env: { ...process.env, ...env } as Record<string, string>,
    });
  }

  /**
   * Create a session for multi-turn conversation.
   */
  session(sessionOptions?: SessionOptions): Session {
    return new Session(this.options, this.executor, sessionOptions);
  }

  /**
   * Schedule a recurring query (equivalent of /loop).
   */
  loop(interval: string | number, prompt: string, options?: QueryOptions): ScheduledJob {
    const scheduler = new Scheduler(this);
    return scheduler.schedule(interval, prompt, options);
  }

  /**
   * Run multiple queries in parallel.
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
   * Close the SDK session and free resources.
   */
  close(): void {
    if (this.sdkExecutor) {
      this.sdkExecutor.close();
    }
  }

  /**
   * Access the underlying executor (for advanced use / testing).
   */
  getExecutor(): IExecutor {
    return this.executor;
  }
}
