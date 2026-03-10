/**
 * Base error class for all claude-connector errors.
 *
 * Consumers can catch this to handle any library error uniformly:
 * ```ts
 * try {
 *   await claude.query('...')
 * } catch (e) {
 *   if (e instanceof ClaudeConnectorError) { ... }
 * }
 * ```
 */
export class ClaudeConnectorError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ClaudeConnectorError';
  }
}

/**
 * Thrown when the Claude Code CLI binary cannot be found at the specified path.
 */
export class CliNotFoundError extends ClaudeConnectorError {
  readonly executable: string;

  constructor(executable: string) {
    super(
      `Claude Code CLI not found at '${executable}'. ` +
      `Ensure it is installed and the path is correct. ` +
      `Install: https://docs.anthropic.com/en/docs/claude-code/overview`,
    );
    this.name = 'CliNotFoundError';
    this.executable = executable;
  }
}

/**
 * Thrown when the CLI process exits with a non-zero code.
 */
export class CliExecutionError extends ClaudeConnectorError {
  readonly exitCode: number;
  readonly stderr: string;

  constructor(message: string, exitCode: number, stderr: string) {
    super(message);
    this.name = 'CliExecutionError';
    this.exitCode = exitCode;
    this.stderr = stderr;
  }
}

/**
 * Thrown when the CLI process exceeds the configured timeout.
 */
export class CliTimeoutError extends ClaudeConnectorError {
  readonly timeoutMs: number;

  constructor(timeoutMs: number) {
    super(`Claude Code CLI timed out after ${timeoutMs}ms`);
    this.name = 'CliTimeoutError';
    this.timeoutMs = timeoutMs;
  }
}

/**
 * Thrown when CLI output cannot be parsed (unexpected format).
 */
export class ParseError extends ClaudeConnectorError {
  readonly rawOutput: string;

  constructor(message: string, rawOutput: string) {
    super(message);
    this.name = 'ParseError';
    this.rawOutput = rawOutput;
  }
}

/**
 * Thrown when invalid options are provided to the client.
 */
export class ValidationError extends ClaudeConnectorError {
  readonly field: string;

  constructor(field: string, message: string) {
    super(`Invalid option '${field}': ${message}`);
    this.name = 'ValidationError';
    this.field = field;
  }
}
