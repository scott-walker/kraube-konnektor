import { ParseError } from '../errors/errors.js';
import type { QueryResult, Message, TokenUsage } from '../types/index.js';

/**
 * Parses the JSON output from `claude -p --output-format json`.
 *
 * ## Expected CLI output structure
 *
 * ```json
 * {
 *   "session_id": "uuid",
 *   "result": "text response",
 *   "messages": [...],
 *   "usage": { "input_tokens": N, "output_tokens": N },
 *   "duration_ms": N,
 *   "total_cost_usd": N | null
 * }
 * ```
 *
 * The parser is intentionally lenient — it extracts known fields and passes
 * the rest through as `raw`. This way new CLI fields don't break the parser.
 */
export function parseJsonResult(stdout: string): QueryResult {
  const trimmed = stdout.trim();
  if (!trimmed) {
    throw new ParseError('Empty output from CLI', stdout);
  }

  let json: Record<string, unknown>;
  try {
    json = JSON.parse(trimmed);
  } catch {
    throw new ParseError(`Failed to parse CLI JSON output: ${trimmed.slice(0, 200)}`, stdout);
  }

  const usage = parseUsage(json['usage']);
  const messages = parseMessages(json['messages']);

  return {
    text: typeof json['result'] === 'string' ? json['result'] : extractText(json),
    sessionId: String(json['session_id'] ?? ''),
    usage,
    cost: typeof json['total_cost_usd'] === 'number' ? json['total_cost_usd'] : null,
    durationMs: typeof json['duration_ms'] === 'number' ? json['duration_ms'] : 0,
    messages,
    structured: json['structured_output'] ?? null,
    raw: json,
  };
}

function parseUsage(raw: unknown): TokenUsage {
  if (raw && typeof raw === 'object') {
    const obj = raw as Record<string, unknown>;
    return {
      inputTokens: typeof obj['input_tokens'] === 'number' ? obj['input_tokens'] : 0,
      outputTokens: typeof obj['output_tokens'] === 'number' ? obj['output_tokens'] : 0,
    };
  }
  return { inputTokens: 0, outputTokens: 0 };
}

function parseMessages(raw: unknown): Message[] {
  if (!Array.isArray(raw)) return [];

  return raw.map((msg: Record<string, unknown>) => ({
    role: msg['role'] as 'user' | 'assistant',
    content: typeof msg['content'] === 'string' ? msg['content'] : msg['content'] as Message['content'],
  }));
}

/**
 * Fallback text extraction when 'result' field is missing.
 * Looks for the last assistant message content.
 */
function extractText(json: Record<string, unknown>): string {
  const messages = json['messages'];
  if (!Array.isArray(messages)) return '';

  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i] as Record<string, unknown>;
    if (msg['role'] === 'assistant') {
      if (typeof msg['content'] === 'string') return msg['content'];
      if (Array.isArray(msg['content'])) {
        const textBlocks = (msg['content'] as Record<string, unknown>[])
          .filter((b) => b['type'] === 'text')
          .map((b) => b['text'] as string);
        return textBlocks.join('');
      }
    }
  }
  return '';
}
