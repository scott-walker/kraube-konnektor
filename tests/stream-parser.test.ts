import { describe, it, expect } from 'vitest';
import { parseStreamLine } from '../src/parser/stream-parser.js';

describe('parseStreamLine', () => {
  it('parses a text assistant event', () => {
    const line = JSON.stringify({
      type: 'assistant',
      message: {
        role: 'assistant',
        content: [{ type: 'text', text: 'Hello world' }],
      },
    });

    const event = parseStreamLine(line);

    expect(event).toEqual({ type: 'text', text: 'Hello world' });
  });

  it('parses a tool_use assistant event', () => {
    const line = JSON.stringify({
      type: 'assistant',
      message: {
        role: 'assistant',
        content: [
          { type: 'tool_use', name: 'Read', input: { file_path: '/src/index.ts' } },
        ],
      },
    });

    const event = parseStreamLine(line);

    expect(event).toEqual({
      type: 'tool_use',
      toolName: 'Read',
      toolInput: { file_path: '/src/index.ts' },
    });
  });

  it('parses a result event', () => {
    const line = JSON.stringify({
      type: 'result',
      result: 'Done!',
      session_id: 'sess-123',
      usage: { input_tokens: 200, output_tokens: 100 },
      total_cost_usd: 0.005,
      duration_ms: 3000,
    });

    const event = parseStreamLine(line);

    expect(event).toEqual({
      type: 'result',
      text: 'Done!',
      sessionId: 'sess-123',
      usage: { inputTokens: 200, outputTokens: 100 },
      cost: 0.005,
      durationMs: 3000,
    });
  });

  it('parses an error event', () => {
    const line = JSON.stringify({
      type: 'error',
      message: 'Rate limited',
      code: 'rate_limit',
    });

    const event = parseStreamLine(line);

    expect(event).toEqual({
      type: 'error',
      message: 'Rate limited',
      code: 'rate_limit',
    });
  });

  it('returns null for malformed JSON', () => {
    expect(parseStreamLine('not json')).toBeNull();
  });

  it('returns null for assistant event with empty content', () => {
    const line = JSON.stringify({
      type: 'assistant',
      message: { role: 'assistant', content: [] },
    });

    expect(parseStreamLine(line)).toBeNull();
  });

  it('forwards unknown types as system events', () => {
    const line = JSON.stringify({
      type: 'custom_event',
      data: { foo: 'bar' },
    });

    const event = parseStreamLine(line);

    expect(event).toEqual({
      type: 'system',
      subtype: 'custom_event',
      data: { type: 'custom_event', data: { foo: 'bar' } },
    });
  });

  it('takes last content block for streaming', () => {
    const line = JSON.stringify({
      type: 'assistant',
      message: {
        role: 'assistant',
        content: [
          { type: 'text', text: 'Thinking...' },
          { type: 'tool_use', name: 'Bash', input: { command: 'ls' } },
        ],
      },
    });

    const event = parseStreamLine(line);

    expect(event).toEqual({
      type: 'tool_use',
      toolName: 'Bash',
      toolInput: { command: 'ls' },
    });
  });
});
