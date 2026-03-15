import { EventEmitter } from 'node:events';
import type { QueryResult, StreamEvent, TokenUsage } from '../types/index.js';
import type { IExecutor, ExecuteOptions } from './interface.js';
import { CliExecutionError, ParseError } from '../errors/errors.js';
import {
  INIT_IMPORTING,
  INIT_CREATING,
  INIT_CONNECTING,
  INIT_READY,
  DEFAULT_MODEL,
  INIT_EVENT_STAGE,
  INIT_EVENT_READY,
  INIT_EVENT_ERROR,
  SYSTEM_INIT,
  EVENT_SYSTEM,
  EVENT_RESULT,
  EVENT_TEXT,
  EVENT_TOOL_USE,
  ROLE_ASSISTANT,
  KEY_MESSAGE,
  KEY_CONTENT,
  KEY_TYPE,
  KEY_TEXT,
  BLOCK_TOOL_USE,
  KEY_NAME,
  KEY_INPUT,
  KEY_RESULT,
  KEY_SESSION_ID,
  KEY_USAGE,
  KEY_INPUT_TOKENS,
  KEY_OUTPUT_TOKENS,
  KEY_TOTAL_COST,
  KEY_DURATION,
  KEY_MODEL,
  KEY_TOOLS,
  KEY_SUBTYPE,
  FLAGS_WITH_VALUE,
  FORMAT_JSON,
  FORMAT_STREAM_JSON,
} from '../constants.js';

// Dynamic import to avoid hard crash if SDK is not installed
type SDKModule = typeof import('@anthropic-ai/claude-agent-sdk');
type SDKSession = import('@anthropic-ai/claude-agent-sdk').SDKSession;
type SDKSessionOptions = import('@anthropic-ai/claude-agent-sdk').SDKSessionOptions;
type SDKMessage = import('@anthropic-ai/claude-agent-sdk').SDKMessage;

/**
 * Initialization stages emitted during SDK warm-up.
 */
export type InitStage =
  | typeof INIT_IMPORTING   // Loading SDK module
  | typeof INIT_CREATING    // Creating session via unstable_v2_createSession
  | typeof INIT_CONNECTING  // Waiting for first system message (init)
  | typeof INIT_READY;      // Session is warm and ready for queries

/**
 * Events emitted by SdkExecutor.
 */
export interface SdkExecutorEvents {
  /** Emitted as initialization progresses through stages. */
  [INIT_EVENT_STAGE]: [InitStage, string];
  /** Emitted once the session is fully warmed up. */
  [INIT_EVENT_READY]: [];
  /** Emitted if initialization fails. */
  [INIT_EVENT_ERROR]: [Error];
}

/**
 * Executor implementation using the Claude Agent SDK (V2 API).
 *
 * ## Why this exists
 *
 * The CLI executor (`CliExecutor`) spawns a new `claude` process for every query.
 * Each spawn has a cold-start cost: loading the CLI, authenticating, initializing
 * tools and MCP servers. For interactive use this delay is noticeable (5-15s).
 *
 * `SdkExecutor` solves this by creating a **persistent SDK session** via
 * `unstable_v2_createSession()`. The session stays warm — subsequent queries
 * use `session.send()` + `session.stream()` with near-zero overhead.
 *
 * ## Lifecycle
 *
 * ```
 * const executor = new SdkExecutor({ model: 'sonnet' })
 * await executor.init()          // warm up (emits stage events)
 * executor.execute(args, opts)   // fast — session already running
 * executor.execute(args, opts)   // fast
 * executor.close()               // cleanup
 * ```
 *
 * ## Initialization events
 *
 * Subscribe to stage events for UI feedback:
 * ```
 * executor.on('init:stage', (stage, message) => {
 *   console.log(`[${stage}] ${message}`)
 * })
 * executor.on('init:ready', () => console.log('Ready!'))
 * ```
 */
export class SdkExecutor extends EventEmitter<SdkExecutorEvents> implements IExecutor {
  private sdkModule: SDKModule | null = null;
  private session: SDKSession | null = null;
  private _ready = false;
  private initPromise: Promise<void> | null = null;
  private readonly sdkOptions: SdkExecutorOptions;

  constructor(options: SdkExecutorOptions) {
    super();
    this.sdkOptions = options;
  }

  /** Whether the session is initialized and ready for queries. */
  get ready(): boolean {
    return this._ready;
  }

  /**
   * Initialize the SDK session (warm up).
   *
   * This imports the SDK, creates a persistent session, and waits for
   * the `system/init` message confirming Claude Code is ready.
   *
   * Call this once at startup. Subsequent queries will be fast.
   * Safe to call multiple times — only initializes once.
   */
  async init(): Promise<void> {
    if (this._ready) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = this.doInit();
    return this.initPromise;
  }

  async execute(args: readonly string[], options: ExecuteOptions): Promise<QueryResult> {
    await this.ensureReady();

    const prompt = extractPrompt(args);
    const systemPrompt = options.systemPrompt;

    // Prepend system prompt context if provided per-query
    const effectivePrompt = systemPrompt
      ? `[System instruction: ${systemPrompt}]\n\n${prompt}`
      : prompt;

    await this.session!.send(effectivePrompt);

    let resultText = '';
    let sessionId = '';
    let usage: TokenUsage = { inputTokens: 0, outputTokens: 0 };
    let cost: number | null = null;
    let durationMs = 0;
    let structured: unknown = null;

    for await (const msg of this.session!.stream()) {
      const parsed = this.mapMessage(msg);
      if (!parsed) continue;

      if (parsed.type === EVENT_TEXT) {
        resultText += parsed.text;
      } else if (parsed.type === EVENT_RESULT) {
        resultText = parsed.text || resultText;
        sessionId = parsed.sessionId;
        usage = parsed.usage;
        cost = parsed.cost;
        durationMs = parsed.durationMs;
      }
    }

    return {
      text: resultText,
      sessionId,
      usage,
      cost,
      durationMs,
      messages: [],
      structured,
      raw: {},
    };
  }

  async *stream(args: readonly string[], options: ExecuteOptions): AsyncIterable<StreamEvent> {
    await this.ensureReady();

    const prompt = extractPrompt(args);
    const systemPrompt = options.systemPrompt;

    const effectivePrompt = systemPrompt
      ? `[System instruction: ${systemPrompt}]\n\n${prompt}`
      : prompt;

    await this.session!.send(effectivePrompt);

    for await (const msg of this.session!.stream()) {
      const event = this.mapMessage(msg);
      if (event) yield event;
    }
  }

  abort(): void {
    // SDK sessions don't have a per-query abort — close the whole session
    this.close();
  }

  /**
   * Close the SDK session and free resources.
   */
  close(): void {
    if (this.session) {
      this.session.close();
      this.session = null;
    }
    this._ready = false;
    this.initPromise = null;
  }

  // ── Private ───────────────────────────────────────────────────────

  private async doInit(): Promise<void> {
    try {
      // Stage 1: Import SDK
      this.emit(INIT_EVENT_STAGE, INIT_IMPORTING, 'Loading Claude Agent SDK...');
      this.sdkModule = await import('@anthropic-ai/claude-agent-sdk');

      // Stage 2: Create session
      this.emit(INIT_EVENT_STAGE, INIT_CREATING, 'Creating persistent session...');
      const sessionOptions: SDKSessionOptions = {
        model: this.sdkOptions.model ?? DEFAULT_MODEL,
        permissionMode: this.sdkOptions.permissionMode as SDKSessionOptions['permissionMode'],
        allowedTools: this.sdkOptions.allowedTools as string[] | undefined,
        disallowedTools: this.sdkOptions.disallowedTools as string[] | undefined,
      };

      if (this.sdkOptions.pathToClaudeCodeExecutable) {
        sessionOptions.pathToClaudeCodeExecutable = this.sdkOptions.pathToClaudeCodeExecutable;
      }

      // BUG-2 fix: pass systemPrompt to SDK session
      if (this.sdkOptions.systemPrompt) {
        (sessionOptions as Record<string, unknown>)['systemPrompt'] = this.sdkOptions.systemPrompt;
      }
      if (this.sdkOptions.appendSystemPrompt) {
        (sessionOptions as Record<string, unknown>)['appendSystemPrompt'] = this.sdkOptions.appendSystemPrompt;
      }
      if (this.sdkOptions.maxTurns !== undefined) {
        (sessionOptions as Record<string, unknown>)['maxTurns'] = this.sdkOptions.maxTurns;
      }

      if (this.sdkOptions.env) {
        sessionOptions.env = { ...process.env, ...this.sdkOptions.env } as Record<string, string | undefined>;
      }

      this.session = this.sdkModule.unstable_v2_createSession(sessionOptions);

      // Stage 3: Warm up — send a no-op to trigger initialization, wait for init message
      this.emit(INIT_EVENT_STAGE, INIT_CONNECTING, 'Waiting for Claude Code to initialize...');
      // The session initializes on first send+stream
      await this.session.send('.');

      for await (const msg of this.session.stream()) {
        if (msg.type === EVENT_SYSTEM && KEY_SUBTYPE in msg && msg.subtype === SYSTEM_INIT) {
          const sysMsg = msg as Record<string, unknown>;
          this.emit(
            INIT_EVENT_STAGE,
            INIT_CONNECTING,
            `Connected: model=${sysMsg[KEY_MODEL]}, tools=${(sysMsg[KEY_TOOLS] as string[] | undefined)?.length ?? 0}`,
          );
        }
        if (msg.type === EVENT_RESULT) {
          break;
        }
      }

      // Stage 4: Ready
      this._ready = true;
      this.emit(INIT_EVENT_STAGE, INIT_READY, 'Session is warm and ready');
      this.emit(INIT_EVENT_READY);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      this.emit(INIT_EVENT_ERROR, error);
      throw error;
    }
  }

  private async ensureReady(): Promise<void> {
    if (!this._ready) {
      await this.init();
    }
  }

  /**
   * Map an SDK message to our StreamEvent type.
   */
  private mapMessage(msg: SDKMessage): StreamEvent | null {
    switch (msg.type) {
      case ROLE_ASSISTANT: {
        const assistantMsg = msg as Record<string, unknown>;
        const message = assistantMsg[KEY_MESSAGE] as Record<string, unknown> | undefined;
        const content = message?.[KEY_CONTENT] as Array<Record<string, unknown>> | undefined;
        if (!content?.length) return null;

        const lastBlock = content[content.length - 1]!;
        if (lastBlock[KEY_TYPE] === EVENT_TEXT && typeof lastBlock[KEY_TEXT] === 'string') {
          return { type: EVENT_TEXT, text: lastBlock[KEY_TEXT] };
        }
        if (lastBlock[KEY_TYPE] === BLOCK_TOOL_USE) {
          return {
            type: EVENT_TOOL_USE,
            toolName: String(lastBlock[KEY_NAME] ?? ''),
            toolInput: (lastBlock[KEY_INPUT] as Record<string, unknown>) ?? {},
          };
        }
        return null;
      }

      case EVENT_RESULT: {
        const result = msg as Record<string, unknown>;
        const usage = result[KEY_USAGE] as Record<string, unknown> | undefined;
        return {
          type: EVENT_RESULT,
          text: typeof result[KEY_RESULT] === 'string' ? result[KEY_RESULT] : '',
          sessionId: String(result[KEY_SESSION_ID] ?? ''),
          usage: {
            inputTokens: typeof usage?.[KEY_INPUT_TOKENS] === 'number' ? usage[KEY_INPUT_TOKENS] : 0,
            outputTokens: typeof usage?.[KEY_OUTPUT_TOKENS] === 'number' ? usage[KEY_OUTPUT_TOKENS] : 0,
          },
          cost: typeof result[KEY_TOTAL_COST] === 'number' ? result[KEY_TOTAL_COST] : null,
          durationMs: typeof result[KEY_DURATION] === 'number' ? result[KEY_DURATION] : 0,
        };
      }

      default:
        return null;
    }
  }
}

/**
 * Options for SdkExecutor.
 */
export interface SdkExecutorOptions {
  /** Model to use. Default: 'sonnet'. */
  readonly model?: string;

  /** Path to Claude Code executable (for SDK internal use). */
  readonly pathToClaudeCodeExecutable?: string;

  /** Permission mode. */
  readonly permissionMode?: string;

  /** Auto-approved tools. */
  readonly allowedTools?: readonly string[];

  /** Denied tools. */
  readonly disallowedTools?: readonly string[];

  /** Extra environment variables. */
  readonly env?: Readonly<Record<string, string>>;

  /** System prompt for the session. */
  readonly systemPrompt?: string;

  /** Append to the default system prompt. */
  readonly appendSystemPrompt?: string;

  /** Maximum agentic turns. */
  readonly maxTurns?: number;
}

/**
 * Extract the prompt string from a CLI args array.
 * In our args format, the prompt is the first positional argument
 * (after --print and --output-format flags).
 */
function extractPrompt(args: readonly string[]): string {
  // The prompt is typically the argument right after '--print', '--output-format', 'json/stream-json'
  // In buildArgs: ['--print', '--output-format', 'json', '--verbose'?, <prompt>, ...flags]
  // Find the first arg that doesn't start with '--' and isn't a flag value
  let skipNext = false;
  for (const arg of args) {
    if (skipNext) {
      skipNext = false;
      continue;
    }
    if (arg.startsWith('--')) {
      // Flags that take a value
      if ((FLAGS_WITH_VALUE as readonly string[]).includes(arg)) {
        skipNext = true;
      }
      continue;
    }
    // Skip format values
    if (arg === FORMAT_JSON || arg === FORMAT_STREAM_JSON || arg === 'text') continue;
    // This should be the prompt
    return arg;
  }
  return '';
}
