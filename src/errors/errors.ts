import {
  ERR_NAME_BASE,
  ERR_NAME_NOT_FOUND,
  ERR_NAME_EXECUTION,
  ERR_NAME_TIMEOUT,
  ERR_NAME_PARSE,
  ERR_NAME_VALIDATION,
} from '../constants.js';

/**
 * Base error class for all kraube-konnektor errors.
 *
 * Consumers can catch this to handle any library error uniformly:
 * ```ts
 * try {
 *   await claude.query('...')
 * } catch (e) {
 *   if (e instanceof KraubeKonnektorError) { ... }
 * }
 * ```
 */
export class KraubeKonnektorError extends Error {
  constructor(message: string) {
    super(message);
    this.name = ERR_NAME_BASE;
  }
}

/**
 * Thrown when the Claude Code CLI binary cannot be found at the specified path.
 */
export class CliNotFoundError extends KraubeKonnektorError {
  readonly executable: string;

  constructor(executable: string) {
    super(
      `Claude Code CLI not found at '${executable}'. ` +
      `Ensure it is installed and the path is correct. ` +
      `Install: https://docs.anthropic.com/en/docs/claude-code/overview`,
    );
    this.name = ERR_NAME_NOT_FOUND;
    this.executable = executable;
  }
}

/**
 * Thrown when the CLI process exits with a non-zero code.
 */
export class CliExecutionError extends KraubeKonnektorError {
  readonly exitCode: number;
  readonly stderr: string;

  constructor(message: string, exitCode: number, stderr: string) {
    super(message);
    this.name = ERR_NAME_EXECUTION;
    this.exitCode = exitCode;
    this.stderr = stderr;
  }
}

/**
 * Thrown when the CLI process exceeds the configured timeout.
 */
export class CliTimeoutError extends KraubeKonnektorError {
  readonly timeoutMs: number;

  constructor(timeoutMs: number) {
    super(`Claude Code CLI timed out after ${timeoutMs}ms`);
    this.name = ERR_NAME_TIMEOUT;
    this.timeoutMs = timeoutMs;
  }
}

/**
 * Thrown when CLI output cannot be parsed (unexpected format).
 */
export class ParseError extends KraubeKonnektorError {
  readonly rawOutput: string;

  constructor(message: string, rawOutput: string) {
    super(message);
    this.name = ERR_NAME_PARSE;
    this.rawOutput = rawOutput;
  }
}

/**
 * Thrown when invalid options are provided to the client.
 */
export class ValidationError extends KraubeKonnektorError {
  readonly field: string;

  constructor(field: string, message: string) {
    super(`Invalid option '${field}': ${message}`);
    this.name = ERR_NAME_VALIDATION;
    this.field = field;
  }
}
