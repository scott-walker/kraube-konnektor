import type { StreamEvent } from '../types/index.js';
import {
  KEY_TYPE, KEY_RESULT, KEY_SESSION_ID, KEY_USAGE, KEY_INPUT_TOKENS, KEY_OUTPUT_TOKENS,
  KEY_TOTAL_COST, KEY_DURATION, KEY_MESSAGE, KEY_CONTENT, KEY_TEXT, KEY_NAME, KEY_INPUT,
  KEY_ERROR, KEY_CODE, KEY_SUBTYPE, KEY_STRUCTURED_OUTPUT,
  EVENT_RESULT, EVENT_ERROR, EVENT_TEXT, EVENT_TOOL_USE, EVENT_SYSTEM,
  ROLE_ASSISTANT, BLOCK_TEXT, BLOCK_TOOL_USE, SYSTEM_UNKNOWN,
} from '../constants.js';

/**
 * Parses a single line of NDJSON from `claude -p --output-format stream-json`.
 *
 * ## Stream format
 *
 * Each line is a self-contained JSON object. The structure varies:
 *
 * ```jsonl
 * {"type":"assistant","message":{"role":"assistant","content":[{"type":"text","text":"..."}]}}
 * {"type":"assistant","message":{"role":"assistant","content":[{"type":"tool_use","name":"Read","input":{...}}]}}
 * {"type":"result","session_id":"...","usage":{...},"duration_ms":...}
 * ```
 *
 * The parser maps these into the typed {@link StreamEvent} union.
 * Unknown event types are forwarded as `system` events for extensibility.
 *
 * @returns Parsed event, or `null` if the line should be skipped.
 */
export function parseStreamLine(line: string): StreamEvent | null {
  let json: Record<string, unknown>;
  try {
    json = JSON.parse(line);
  } catch {
    // Malformed line — skip gracefully
    return null;
  }

  const type = json[KEY_TYPE];

  if (type === EVENT_RESULT) {
    return parseResultEvent(json);
  }

  if (type === ROLE_ASSISTANT) {
    return parseAssistantEvent(json);
  }

  if (type === EVENT_ERROR) {
    return {
      type: EVENT_ERROR,
      message: String(json[KEY_MESSAGE] ?? json[KEY_ERROR] ?? 'Unknown error'),
      code: typeof json[KEY_CODE] === 'string' ? json[KEY_CODE] : undefined,
    };
  }

  // Forward unknown types as system events
  return {
    type: EVENT_SYSTEM,
    subtype: String(type ?? SYSTEM_UNKNOWN),
    data: json,
  };
}

function parseResultEvent(json: Record<string, unknown>): StreamEvent {
  const usage = json[KEY_USAGE] as Record<string, unknown> | undefined;
  const subtype = json[KEY_SUBTYPE] as string | undefined;

  return {
    type: EVENT_RESULT,
    subtype: subtype === 'success' ? 'success' : subtype?.startsWith('error') ? 'error' : subtype ?? 'success',
    text: typeof json[KEY_RESULT] === 'string' ? json[KEY_RESULT] : '',
    sessionId: String(json[KEY_SESSION_ID] ?? ''),
    usage: {
      inputTokens: typeof usage?.[KEY_INPUT_TOKENS] === 'number' ? usage[KEY_INPUT_TOKENS] : 0,
      outputTokens: typeof usage?.[KEY_OUTPUT_TOKENS] === 'number' ? usage[KEY_OUTPUT_TOKENS] : 0,
    },
    cost: typeof json[KEY_TOTAL_COST] === 'number' ? json[KEY_TOTAL_COST] : null,
    durationMs: typeof json[KEY_DURATION] === 'number' ? json[KEY_DURATION] : 0,
    isError: json['is_error'] === true,
    stopReason: typeof json['stop_reason'] === 'string' ? json['stop_reason'] : null,
    numTurns: typeof json['num_turns'] === 'number' ? json['num_turns'] : undefined,
    structured: json[KEY_STRUCTURED_OUTPUT] ?? null,
  };
}

function parseAssistantEvent(json: Record<string, unknown>): StreamEvent | null {
  const message = json[KEY_MESSAGE] as Record<string, unknown> | undefined;
  if (!message) return null;

  const content = message[KEY_CONTENT];
  if (!Array.isArray(content) || content.length === 0) return null;

  // Process the last content block (most relevant for streaming)
  const block = content[content.length - 1] as Record<string, unknown>;

  if (block[KEY_TYPE] === BLOCK_TEXT && typeof block[KEY_TEXT] === 'string') {
    return { type: EVENT_TEXT, text: block[KEY_TEXT] };
  }

  if (block[KEY_TYPE] === BLOCK_TOOL_USE) {
    return {
      type: EVENT_TOOL_USE,
      toolName: String(block[KEY_NAME] ?? ''),
      toolInput: (block[KEY_INPUT] as Record<string, unknown>) ?? {},
    };
  }

  return null;
}
