import { spawn, type ChildProcess } from 'node:child_process';
import { parseJsonResult } from '../parser/json-parser.js';
import { parseStreamLine } from '../parser/stream-parser.js';
import { CliExecutionError, CliNotFoundError, CliTimeoutError } from '../errors/errors.js';
import type { QueryResult, StreamEvent } from '../types/index.js';
import type { IExecutor, ExecuteOptions } from './interface.js';
import {
  DEFAULT_TIMEOUT_MS,
  DEFAULT_EXECUTABLE,
  ERR_ENOENT,
  SIGNAL_SIGTERM,
  EVENT_SYSTEM,
  SYSTEM_STDERR,
} from '../constants.js';

/**
 * Executor implementation that spawns the Claude Code CLI as a child process.
 *
 * ## How it works
 *
 * - `execute()` spawns `claude -p <prompt> --output-format json` and collects stdout.
 * - `stream()` spawns `claude -p <prompt> --output-format stream-json` and parses
 *   newline-delimited JSON (NDJSON) from stdout in real time.
 *
 * ## Error handling
 *
 * - Non-zero exit code → {@link CliExecutionError}
 * - `ENOENT` (binary not found) → {@link CliNotFoundError}
 * - Timeout → {@link CliTimeoutError}
 *
 * ## Lifecycle
 *
 * Each call to `execute()` or `stream()` spawns a fresh process.
 * The executor is stateless — safe to use concurrently from multiple queries.
 */
export class CliExecutor implements IExecutor {
  private readonly executable: string;
  private readonly timeoutMs: number;
  private activeProcess: ChildProcess | null = null;

  constructor(executable: string = DEFAULT_EXECUTABLE, timeoutMs: number = DEFAULT_TIMEOUT_MS) {
    this.executable = executable;
    this.timeoutMs = timeoutMs;
  }

  async execute(args: readonly string[], options: ExecuteOptions): Promise<QueryResult> {
    const { stdout, stderr, exitCode } = await this.spawn(args, options);

    if (exitCode !== 0) {
      throw new CliExecutionError(
        `CLI exited with code ${exitCode}: ${stderr}`,
        exitCode,
        stderr,
      );
    }

    return parseJsonResult(stdout);
  }

  async *stream(args: readonly string[], options: ExecuteOptions): AsyncIterable<StreamEvent> {
    const child = this.spawnProcess(args, options);
    this.activeProcess = child;

    // Wire AbortSignal for per-query cancellation
    if (options.signal) {
      if (options.signal.aborted) {
        child.kill(SIGNAL_SIGTERM);
        this.activeProcess = null;
        return;
      }
      options.signal.addEventListener('abort', () => {
        if (!child.killed) {
          child.kill(SIGNAL_SIGTERM);
        }
      }, { once: true });
    }

    try {
      yield* this.readStream(child);
    } finally {
      this.activeProcess = null;
    }
  }

  abort(): void {
    if (this.activeProcess && !this.activeProcess.killed) {
      this.activeProcess.kill(SIGNAL_SIGTERM);
      this.activeProcess = null;
    }
  }

  // ── Private helpers ───────────────────────────────────────────────

  private spawnProcess(args: readonly string[], options: ExecuteOptions): ChildProcess {
    try {
      const child = spawn(this.executable, args as string[], {
        cwd: options.cwd,
        env: { ...process.env, ...options.env },
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      if (options.input && child.stdin) {
        child.stdin.write(options.input);
        child.stdin.end();
      } else if (child.stdin) {
        child.stdin.end();
      }

      return child;
    } catch (error: unknown) {
      if (isNodeError(error) && error.code === ERR_ENOENT) {
        throw new CliNotFoundError(this.executable);
      }
      throw error;
    }
  }

  private spawn(
    args: readonly string[],
    options: ExecuteOptions,
  ): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    return new Promise((resolve, reject) => {
      const child = this.spawnProcess(args, options);
      this.activeProcess = child;

      // Wire AbortSignal to kill the process
      if (options.signal) {
        if (options.signal.aborted) {
          child.kill(SIGNAL_SIGTERM);
          this.activeProcess = null;
          reject(new Error('Query aborted'));
          return;
        }
        options.signal.addEventListener('abort', () => {
          if (!child.killed) {
            child.kill(SIGNAL_SIGTERM);
          }
        }, { once: true });
      }

      const chunks: Buffer[] = [];
      const errChunks: Buffer[] = [];

      child.stdout!.on('data', (chunk: Buffer) => chunks.push(chunk));
      child.stderr!.on('data', (chunk: Buffer) => errChunks.push(chunk));

      const timer = setTimeout(() => {
        child.kill(SIGNAL_SIGTERM);
        reject(new CliTimeoutError(this.timeoutMs));
      }, this.timeoutMs);

      child.on('error', (err: NodeJS.ErrnoException) => {
        clearTimeout(timer);
        this.activeProcess = null;

        if (err.code === ERR_ENOENT) {
          reject(new CliNotFoundError(this.executable));
        } else {
          reject(err);
        }
      });

      child.on('close', (exitCode) => {
        clearTimeout(timer);
        this.activeProcess = null;

        resolve({
          stdout: Buffer.concat(chunks).toString('utf-8'),
          stderr: Buffer.concat(errChunks).toString('utf-8'),
          exitCode: exitCode ?? 1,
        });
      });
    });
  }

  private async *readStream(child: ChildProcess): AsyncIterable<StreamEvent> {
    // Buffer for incomplete lines (NDJSON may arrive in partial chunks)
    let buffer = '';

    const iterator = createAsyncIterator<StreamEvent | null>(
      child,
      (chunk: Buffer, push) => {
        buffer += chunk.toString('utf-8');

        const lines = buffer.split('\n');
        // Keep the last (possibly incomplete) line in the buffer
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;

          const event = parseStreamLine(trimmed);
          if (event) push(event);
        }
      },
      () => {
        // Flush remaining buffer on stream end
        const trimmed = buffer.trim();
        if (trimmed) {
          const event = parseStreamLine(trimmed);
          if (event) return event;
        }
        return null;
      },
    );

    for await (const event of iterator) {
      if (event !== null) {
        yield event;
      }
    }
  }
}

// ── Utility ───────────────────────────────────────────────────────

function isNodeError(err: unknown): err is NodeJS.ErrnoException {
  return err instanceof Error && 'code' in err;
}

/**
 * Creates an async iterator from a child process stdout.
 * Handles backpressure, errors, and process exit.
 */
function createAsyncIterator<T>(
  child: ChildProcess,
  onData: (chunk: Buffer, push: (item: T) => void) => void,
  onEnd: () => T | null,
): AsyncIterable<T> {
  return {
    [Symbol.asyncIterator]() {
      const queue: T[] = [];
      let resolve: ((value: IteratorResult<T>) => void) | null = null;
      let done = false;
      let error: Error | null = null;

      const push = (item: T) => {
        if (resolve) {
          const r = resolve;
          resolve = null;
          r({ value: item, done: false });
        } else {
          queue.push(item);
        }
      };

      child.stdout!.on('data', (chunk: Buffer) => {
        onData(chunk, push);
      });

      child.stderr!.on('data', (chunk: Buffer) => {
        // Capture stderr but don't fail — CLI may log warnings there
        const text = chunk.toString('utf-8').trim();
        if (text) {
          push({ type: EVENT_SYSTEM, subtype: SYSTEM_STDERR, data: { text } } as T);
        }
      });

      const finish = () => {
        if (done) return;
        done = true;

        const final = onEnd();
        if (final !== null) push(final);

        if (resolve) {
          const r = resolve;
          resolve = null;
          r({ value: undefined as T, done: true });
        }
      };

      child.on('close', finish);
      child.on('error', (err) => {
        error = err;
        finish();
      });

      return {
        next(): Promise<IteratorResult<T>> {
          if (queue.length > 0) {
            return Promise.resolve({ value: queue.shift()!, done: false });
          }
          if (done) {
            return Promise.resolve({ value: undefined as T, done: true });
          }
          if (error) {
            return Promise.reject(error);
          }
          return new Promise((r) => {
            resolve = r;
          });
        },
      };
    },
  };
}
