/**
 * Options for creating or resuming a session.
 */
export interface SessionOptions {
  /**
   * Resume an existing session by ID.
   * If omitted, a new session is created on first query.
   */
  readonly resume?: string;

  /**
   * Fork the session instead of continuing in-place.
   * Creates a new session ID branching from the resumed session.
   * Only meaningful when `resume` is set.
   */
  readonly fork?: boolean;

  /**
   * Continue the most recent session in the working directory.
   * Mutually exclusive with `resume`.
   */
  readonly continue?: boolean;
}

/**
 * Metadata about a stored session.
 */
export interface SessionInfo {
  /** Unique session identifier. */
  readonly sessionId: string;

  /** Human-readable session name (if renamed). */
  readonly name?: string;

  /** Brief summary of the session. */
  readonly summary?: string;

  /** ISO 8601 timestamp of last activity. */
  readonly lastActive: string;

  /** Working directory associated with this session. */
  readonly cwd: string;
}
