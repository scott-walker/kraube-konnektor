import type { StreamEvent } from '../types/index.js';

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

  const type = json['type'];

  if (type === 'result') {
    return parseResultEvent(json);
  }

  if (type === 'assistant') {
    return parseAssistantEvent(json);
  }

  if (type === 'error') {
    return {
      type: 'error',
      message: String(json['message'] ?? json['error'] ?? 'Unknown error'),
      code: typeof json['code'] === 'string' ? json['code'] : undefined,
    };
  }

  // Forward unknown types as system events
  return {
    type: 'system',
    subtype: String(type ?? 'unknown'),
    data: json,
  };
}

function parseResultEvent(json: Record<string, unknown>): StreamEvent {
  const usage = json['usage'] as Record<string, unknown> | undefined;

  return {
    type: 'result',
    text: typeof json['result'] === 'string' ? json['result'] : '',
    sessionId: String(json['session_id'] ?? ''),
    usage: {
      inputTokens: typeof usage?.['input_tokens'] === 'number' ? usage['input_tokens'] : 0,
      outputTokens: typeof usage?.['output_tokens'] === 'number' ? usage['output_tokens'] : 0,
    },
    cost: typeof json['total_cost_usd'] === 'number' ? json['total_cost_usd'] : null,
    durationMs: typeof json['duration_ms'] === 'number' ? json['duration_ms'] : 0,
  };
}

function parseAssistantEvent(json: Record<string, unknown>): StreamEvent | null {
  const message = json['message'] as Record<string, unknown> | undefined;
  if (!message) return null;

  const content = message['content'];
  if (!Array.isArray(content) || content.length === 0) return null;

  // Process the last content block (most relevant for streaming)
  const block = content[content.length - 1] as Record<string, unknown>;

  if (block['type'] === 'text' && typeof block['text'] === 'string') {
    return { type: 'text', text: block['text'] };
  }

  if (block['type'] === 'tool_use') {
    return {
      type: 'tool_use',
      toolName: String(block['name'] ?? ''),
      toolInput: (block['input'] as Record<string, unknown>) ?? {},
    };
  }

  return null;
}
