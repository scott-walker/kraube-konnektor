/**
 * Result of a completed (non-streaming) query.
 */
export interface QueryResult {
  /** The text response from Claude. */
  readonly text: string;

  /** Session ID for resuming this conversation. */
  readonly sessionId: string;

  /** Token usage statistics. */
  readonly usage: TokenUsage;

  /** Total cost in USD (available for API users). */
  readonly cost: number | null;

  /** Wall-clock duration in milliseconds. */
  readonly durationMs: number;

  /** Full message history from the conversation. */
  readonly messages: readonly Message[];

  /**
   * Structured output when a JSON schema was provided.
   * `null` if no schema was used.
   */
  readonly structured: unknown | null;

  /** Raw JSON response from CLI (for advanced use). */
  readonly raw: Record<string, unknown>;
}

/**
 * A single event emitted during streaming.
 *
 * Discriminated union on the `type` field.
 */
export type StreamEvent =
  | StreamTextEvent
  | StreamToolUseEvent
  | StreamResultEvent
  | StreamErrorEvent
  | StreamSystemEvent;

export interface StreamTextEvent {
  readonly type: 'text';

  /** Incremental text chunk. */
  readonly text: string;
}

export interface StreamToolUseEvent {
  readonly type: 'tool_use';

  /** Tool being invoked (e.g. 'Read', 'Bash'). */
  readonly toolName: string;

  /** Input parameters passed to the tool. */
  readonly toolInput: Record<string, unknown>;
}

export interface StreamResultEvent {
  readonly type: 'result';

  /** Final text result. */
  readonly text: string;

  /** Session ID. */
  readonly sessionId: string;

  /** Token usage. */
  readonly usage: TokenUsage;

  /** Cost in USD. */
  readonly cost: number | null;

  /** Duration in milliseconds. */
  readonly durationMs: number;
}

export interface StreamErrorEvent {
  readonly type: 'error';

  /** Error message. */
  readonly message: string;

  /** Error code if available. */
  readonly code?: string;
}

export interface StreamSystemEvent {
  readonly type: 'system';

  /** System event subtype. */
  readonly subtype: string;

  /** Event-specific data. */
  readonly data: Record<string, unknown>;
}

export interface TokenUsage {
  readonly inputTokens: number;
  readonly outputTokens: number;
}

export interface Message {
  readonly role: 'user' | 'assistant';
  readonly content: string | readonly ContentBlock[];
}

export type ContentBlock = TextBlock | ToolUseBlock | ToolResultBlock;

export interface TextBlock {
  readonly type: 'text';
  readonly text: string;
}

export interface ToolUseBlock {
  readonly type: 'tool_use';
  readonly id: string;
  readonly name: string;
  readonly input: Record<string, unknown>;
}

export interface ToolResultBlock {
  readonly type: 'tool_result';
  readonly tool_use_id: string;
  readonly content: string;
}
