import { Readable } from 'node:stream';
import {
  EVENT_TEXT,
  EVENT_TOOL_USE,
  EVENT_RESULT,
  EVENT_ERROR,
  EVENT_SYSTEM,
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
 * A streaming response handle with fluent callback API and Node.js stream support.
 *
 * ## 1. Fluent callbacks
 *
 * ```ts
 * await claude.stream('Refactor auth')
 *   .on('text', (text) => process.stdout.write(text))
 *   .on('tool_use', (event) => console.log(event.toolName))
 *   .done()
 * ```
 *
 * ## 2. Convenience methods
 *
 * ```ts
 * const text = await claude.stream('Summarize').text()
 * const result = await claude.stream('Explain').pipe(process.stdout)
 * ```
 *
 * ## 3. Node.js Readable stream
 *
 * ```ts
 * import { pipeline } from 'node:stream/promises'
 * await pipeline(claude.stream('Generate').toReadable(), createGzip(), file)
 * ```
 *
 * ## 4. Raw async iteration (backward compat)
 *
 * ```ts
 * for await (const event of claude.stream('Analyze')) { ... }
 * ```
 */
export class StreamHandle implements AsyncIterable<StreamEvent> {
  private readonly source: () => AsyncIterable<StreamEvent>;
  private readonly textCallbacks: TextCallback[] = [];
  private readonly toolUseCallbacks: ToolUseCallback[] = [];
  private readonly resultCallbacks: ResultCallback[] = [];
  private readonly errorCallbacks: ErrorCallback[] = [];
  private readonly systemCallbacks: SystemCallback[] = [];

  constructor(source: () => AsyncIterable<StreamEvent>) {
    this.source = source;
  }

  /**
   * Register a callback for a specific event type. Returns `this` for chaining.
   *
   * `text` callback receives just the string. All others receive the full event.
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
   * Consume the stream, fire all registered callbacks, return the final result.
   */
  async done(): Promise<StreamResultEvent> {
    let result: StreamResultEvent | null = null;

    for await (const event of this.source()) {
      this.dispatch(event);
      if (event.type === EVENT_RESULT) result = event;
    }

    if (!result) {
      throw new Error('Stream ended without a result event');
    }
    return result;
  }

  /**
   * Collect all text chunks into a single string.
   */
  async text(): Promise<string> {
    let collected = '';

    for await (const event of this.source()) {
      if (event.type === EVENT_TEXT) collected += event.text;
      this.dispatch(event);
    }

    return collected;
  }

  /**
   * Pipe text to a writable stream. Returns the final result.
   *
   * ```ts
   * const result = await claude.stream('Explain').pipe(process.stdout)
   * ```
   */
  async pipe(writable: { write(chunk: string): unknown }): Promise<StreamResultEvent> {
    this.textCallbacks.push((text) => writable.write(text));
    return this.done();
  }

  /**
   * Get a Node.js Readable that emits text chunks.
   * Use for `pipeline()`, standard `.pipe()` chaining, HTTP responses, etc.
   *
   * ```ts
   * claude.stream('Generate').toReadable().pipe(res)
   *
   * await pipeline(
   *   claude.stream('Report').toReadable(),
   *   createGzip(),
   *   createWriteStream('report.gz'),
   * )
   * ```
   */
  toReadable(): Readable {
    const source = this.source;
    const textStream = async function* () {
      for await (const event of source()) {
        if (event.type === EVENT_TEXT) yield event.text;
      }
    };
    return Readable.from(textStream(), { encoding: 'utf-8' });
  }

  /**
   * Async iteration — yields StreamEvent objects. Backward compatible with `for await`.
   */
  async *[Symbol.asyncIterator](): AsyncIterator<StreamEvent> {
    yield* this.source();
  }

  private dispatch(event: StreamEvent): void {
    switch (event.type) {
      case EVENT_TEXT:
        for (const cb of this.textCallbacks) cb(event.text);
        break;
      case EVENT_TOOL_USE:
        for (const cb of this.toolUseCallbacks) cb(event);
        break;
      case EVENT_RESULT:
        for (const cb of this.resultCallbacks) cb(event);
        break;
      case EVENT_ERROR:
        for (const cb of this.errorCallbacks) cb(event);
        break;
      case EVENT_SYSTEM:
        for (const cb of this.systemCallbacks) cb(event);
        break;
    }
  }
}
