import { describe, it, expect } from 'vitest';
import { parseJsonResult } from '../src/parser/json-parser.js';
import { ParseError } from '../src/errors/errors.js';

describe('parseJsonResult', () => {
  it('parses a standard CLI JSON response', () => {
    const json = JSON.stringify({
      session_id: 'abc-123',
      result: 'The answer is 42',
      messages: [
        { role: 'user', content: 'What is the answer?' },
        { role: 'assistant', content: 'The answer is 42' },
      ],
      usage: { input_tokens: 100, output_tokens: 50 },
      duration_ms: 1500,
      total_cost_usd: 0.003,
    });

    const result = parseJsonResult(json);

    expect(result.text).toBe('The answer is 42');
    expect(result.sessionId).toBe('abc-123');
    expect(result.usage.inputTokens).toBe(100);
    expect(result.usage.outputTokens).toBe(50);
    expect(result.cost).toBe(0.003);
    expect(result.durationMs).toBe(1500);
    expect(result.messages).toHaveLength(2);
    expect(result.structured).toBeNull();
  });

  it('parses structured output', () => {
    const json = JSON.stringify({
      session_id: 'abc-123',
      result: '',
      structured_output: { functions: ['auth', 'login'] },
      usage: { input_tokens: 50, output_tokens: 30 },
      duration_ms: 800,
    });

    const result = parseJsonResult(json);

    expect(result.structured).toEqual({ functions: ['auth', 'login'] });
  });

  it('falls back to last assistant message when result field is missing', () => {
    const json = JSON.stringify({
      session_id: 'abc-123',
      messages: [
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi there!' },
      ],
      usage: {},
    });

    const result = parseJsonResult(json);

    expect(result.text).toBe('Hi there!');
  });

  it('extracts text from content blocks', () => {
    const json = JSON.stringify({
      session_id: 'abc-123',
      messages: [
        {
          role: 'assistant',
          content: [
            { type: 'text', text: 'First ' },
            { type: 'text', text: 'Second' },
          ],
        },
      ],
      usage: {},
    });

    const result = parseJsonResult(json);

    expect(result.text).toBe('First Second');
  });

  it('throws ParseError on empty output', () => {
    expect(() => parseJsonResult('')).toThrow(ParseError);
    expect(() => parseJsonResult('  ')).toThrow(ParseError);
  });

  it('throws ParseError on invalid JSON', () => {
    expect(() => parseJsonResult('not json')).toThrow(ParseError);
  });

  it('handles missing usage gracefully', () => {
    const json = JSON.stringify({
      session_id: 'abc-123',
      result: 'OK',
    });

    const result = parseJsonResult(json);

    expect(result.usage.inputTokens).toBe(0);
    expect(result.usage.outputTokens).toBe(0);
  });

  it('handles null cost', () => {
    const json = JSON.stringify({
      session_id: 'abc-123',
      result: 'OK',
      usage: {},
    });

    const result = parseJsonResult(json);

    expect(result.cost).toBeNull();
  });

  it('preserves raw JSON for advanced use', () => {
    const raw = {
      session_id: 'abc-123',
      result: 'OK',
      usage: {},
      custom_field: 'extra',
    };

    const result = parseJsonResult(JSON.stringify(raw));

    expect(result.raw['custom_field']).toBe('extra');
  });
});
