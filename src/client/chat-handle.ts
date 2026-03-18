import { spawn, type ChildProcess } from 'node:child_process';
import { Readable, Duplex } from 'node:stream';
import { parseStreamLine } from '../parser/stream-parser.js';
import {
  EVENT_TEXT,
  EVENT_TOOL_USE,
  EVENT_RESULT,
  EVENT_ERROR,
  EVENT_SYSTEM,
  CHAT_USER_MESSAGE,
  SIGNAL_SIGTERM,
} from '../constants.js';
import type {
  StreamEvent,
  StreamToolUseEvent,
  StreamResultEvent,
  StreamErrorEvent,
  StreamSystemEvent,
} from '../types/index.js';

type TextCallback = (text: string) => void;
type ToolUseCallback = (event: StreamToolUseEvent) => void;
type ResultCallback = (event: StreamResultEvent) => void;
type ErrorCallback = (event: StreamErrorEvent) => void;
type SystemCallback = (event: StreamSystemEvent) => void;

/**
 * Bidirectional streaming handle for real-time conversation.
 *
 * Uses `--input-format stream-json` to maintain a persistent CLI process.
 * Send prompts with `.send()`, receive responses via callbacks or Node.js streams.
 *
 * ## Fluent callbacks
 *
 * ```ts
 * const chat = claude.chat()
 *   .on('text', (text) => process.stdout.write(text))
 *   .on('result', (event) => console.log('Turn done'))
 *
 * await chat.send('What files are in src?')
 * await chat.send('Fix the largest one')
 * chat.end()
 * ```
 *
 * ## Node.js Duplex stream
 *
 * ```ts
 * const duplex = claude.chat().toDuplex()
 * inputStream.pipe(duplex).pipe(process.stdout)
 * ```
 */
export class ChatHandle {
  private readonly child: ChildProcess;
  private readonly textCallbacks: TextCallback[] = [];
  private readonly toolUseCallbacks: ToolUseCallback[] = [];
  private readonly resultCallbacks: ResultCallback[] = [];
  private readonly errorCallbacks: ErrorCallback[] = [];
  private readonly systemCallbacks: SystemCallback[] = [];

  private buffer = '';
  private _closed = false;
  private _sessionId: string | null = null;
  private _turnCount = 0;

  constructor(
    executable: string,
    args: readonly string[],
    options: { cwd: string; env: Record<string, string> },
  ) {
    this.child = spawn(executable, args as string[], {
      cwd: options.cwd,
      env: { ...process.env, ...options.env },
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    this.child.on('error', (err) => {
      this._closed = true;
      this.rejectPending(err);
    });

    this.child.on('close', (code) => {
      this._closed = true;
      if (code !== 0 && code !== null) {
        this.rejectPending(new Error(`CLI process exited with code ${code}`));
      }
    });

    this.startReading();
  }

  /** Session ID (populated after the first result). */
  get sessionId(): string | null {
    return this._sessionId;
  }

  /** Number of completed turns. */
  get turnCount(): number {
    return this._turnCount;
  }

  /** Whether the chat has been closed. */
  get closed(): boolean {
    return this._closed;
  }

  /**
   * Register a callback. Returns `this` for chaining.
   */
  on(type: typeof EVENT_TEXT, callback: TextCallback): this;
  on(type: typeof EVENT_TOOL_USE, callback: ToolUseCallback): this;
  on(type: typeof EVENT_RESULT, callback: ResultCallback): this;
  on(type: typeof EVENT_ERROR, callback: ErrorCallback): this;
  on(type: typeof EVENT_SYSTEM, callback: SystemCallback): this;
  on(type: string, callback: (...args: never[]) => void): this {
    switch (type) {
      case EVENT_TEXT: this.textCallbacks.push(callback as TextCallback); break;
      case EVENT_TOOL_USE: this.toolUseCallbacks.push(callback as ToolUseCallback); break;
      case EVENT_RESULT: this.resultCallbacks.push(callback as ResultCallback); break;
      case EVENT_ERROR: this.errorCallbacks.push(callback as ErrorCallback); break;
      case EVENT_SYSTEM: this.systemCallbacks.push(callback as SystemCallback); break;
    }
    return this;
  }

  /**
   * Send a prompt and wait for the complete response.
   * Returns the result event when this turn finishes.
   *
   * ```ts
   * const result = await chat.send('Find bugs in auth.ts')
   * console.log(result.durationMs)
   *
   * const result2 = await chat.send('Now fix them')
   * ```
   */
  send(prompt: string): Promise<StreamResultEvent> {
    if (this._closed) {
      return Promise.reject(new Error('Chat is closed'));
    }

    const message = JSON.stringify({ type: CHAT_USER_MESSAGE, content: prompt });
    this.child.stdin!.write(message + '\n');

    return new Promise<StreamResultEvent>((resolve, reject) => {
      const onResult = (event: StreamResultEvent) => {
        const idx = this.resultCallbacks.indexOf(onResult);
        if (idx >= 0) this.resultCallbacks.splice(idx, 1);
        resolve(event);
      };
      const onError = (event: StreamErrorEvent) => {
        const idx = this.errorCallbacks.indexOf(onError);
        if (idx >= 0) this.errorCallbacks.splice(idx, 1);
        reject(new Error(event.message));
      };
      this.resultCallbacks.push(onResult);
      this.errorCallbacks.push(onError);
    });
  }

  /**
   * Pipe text output to a writable stream.
   * Returns the destination for chaining (Node.js convention).
   *
   * ```ts
   * chat.pipe(process.stdout)
   * chat.pipe(fs.createWriteStream('log.txt'))
   * ```
   */
  pipe<T extends NodeJS.WritableStream>(dest: T): T {
    this.textCallbacks.push((text) => dest.write(text));
    return dest;
  }

  /**
   * Get a Node.js Readable that emits text chunks.
   *
   * ```ts
   * claude.chat().toReadable().pipe(res)
   * ```
   */
  toReadable(): Readable {
    const readable = new Readable({
      encoding: 'utf-8',
      read() { /* data is pushed asynchronously */ },
    });

    this.textCallbacks.push((text) => readable.push(text));
    this.child.on('close', () => readable.push(null));

    return readable;
  }

  /**
   * Get a Node.js Duplex stream.
   * Write side accepts prompts (one per write). Read side emits text.
   *
   * ```ts
   * const duplex = claude.chat().toDuplex()
   * inputStream.pipe(duplex).pipe(process.stdout)
   * ```
   */
  toDuplex(): Duplex {
    const chat = this;

    const duplex = new Duplex({
      encoding: 'utf-8',
      write(chunk, _encoding, callback) {
        const prompt = chunk.toString().trim();
        if (prompt) {
          const message = JSON.stringify({ type: CHAT_USER_MESSAGE, content: prompt });
          chat.child.stdin!.write(message + '\n');
        }
        callback();
      },
      read() { /* data is pushed asynchronously */ },
    });

    this.textCallbacks.push((text) => duplex.push(text));
    this.child.on('close', () => duplex.push(null));

    return duplex;
  }

  /**
   * Close the chat gracefully — signals EOF to the CLI process.
   */
  end(): void {
    if (this._closed) return;
    this._closed = true;
    if (this.child.stdin && !this.child.stdin.destroyed) {
      this.child.stdin.end();
    }
  }

  /**
   * Abort the chat — kills the CLI process immediately.
   */
  abort(): void {
    this._closed = true;
    if (!this.child.killed) {
      this.child.kill(SIGNAL_SIGTERM);
    }
  }

  // ── Private ───────────────────────────────────────────────────────

  private startReading(): void {
    this.child.stdout!.on('data', (chunk: Buffer) => {
      this.buffer += chunk.toString('utf-8');

      const lines = this.buffer.split('\n');
      this.buffer = lines.pop() ?? '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        const event = parseStreamLine(trimmed);
        if (event) {
          if (event.type === EVENT_RESULT) {
            this._sessionId = event.sessionId || this._sessionId;
            this._turnCount++;
          }
          this.dispatch(event);
        }
      }
    });

    // Flush remaining buffer on close
    this.child.stdout!.on('end', () => {
      const trimmed = this.buffer.trim();
      if (trimmed) {
        const event = parseStreamLine(trimmed);
        if (event) this.dispatch(event);
      }
    });
  }

  private rejectPending(error: Error): void {
    // Reject any pending send() promises by dispatching an error event
    const callbacks = [...this.errorCallbacks];
    for (const cb of callbacks) {
      try { cb({ type: EVENT_ERROR, message: error.message }); } catch { /* ignore */ }
    }
  }

  private dispatch(event: StreamEvent): void {
    const safeCall = <T>(callbacks: Array<(arg: T) => void>, arg: T) => {
      for (const cb of callbacks) {
        try { cb(arg); } catch { /* user callback error should not break the stream */ }
      }
    };

    switch (event.type) {
      case EVENT_TEXT:
        safeCall(this.textCallbacks, event.text);
        break;
      case EVENT_TOOL_USE:
        safeCall(this.toolUseCallbacks, event);
        break;
      case EVENT_RESULT:
        safeCall(this.resultCallbacks, event);
        break;
      case EVENT_ERROR:
        safeCall(this.errorCallbacks, event);
        break;
      case EVENT_SYSTEM:
        safeCall(this.systemCallbacks, event);
        break;
    }
  }
}
