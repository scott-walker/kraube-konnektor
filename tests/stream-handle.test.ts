import { describe, it, expect, vi } from 'vitest';
import { Readable } from 'node:stream';
import { StreamHandle } from '../src/client/stream-handle.js';
import type { StreamEvent, StreamResultEvent } from '../src/types/index.js';

function createSource(events: StreamEvent[]): () => AsyncIterable<StreamEvent> {
  return async function* () {
    for (const event of events) yield event;
  };
}

const sampleEvents: StreamEvent[] = [
  { type: 'text', text: 'Hello ' },
  { type: 'text', text: 'world' },
  { type: 'tool_use', toolName: 'Read', toolInput: { file_path: 'src/index.ts' } },
  {
    type: 'result',
    text: 'Hello world',
    sessionId: 'sess-1',
    usage: { inputTokens: 10, outputTokens: 20 },
    cost: 0.01,
    durationMs: 500,
  },
];

describe('StreamHandle', () => {
  describe('done()', () => {
    it('returns the result event', async () => {
      const handle = new StreamHandle(createSource(sampleEvents));
      const result = await handle.done();

      expect(result.type).toBe('result');
      expect(result.sessionId).toBe('sess-1');
      expect(result.durationMs).toBe(500);
    });

    it('fires registered callbacks', async () => {
      const texts: string[] = [];
      const tools: string[] = [];

      const handle = new StreamHandle(createSource(sampleEvents))
        .on('text', (t) => texts.push(t))
        .on('tool_use', (e) => tools.push(e.toolName));

      await handle.done();

      expect(texts).toEqual(['Hello ', 'world']);
      expect(tools).toEqual(['Read']);
    });

    it('throws if stream has no result event', async () => {
      const handle = new StreamHandle(createSource([
        { type: 'text', text: 'partial' },
      ]));

      await expect(handle.done()).rejects.toThrow('Stream ended without a result event');
    });
  });

  describe('text()', () => {
    it('collects text chunks into a string', async () => {
      const handle = new StreamHandle(createSource(sampleEvents));
      const text = await handle.text();

      expect(text).toBe('Hello world');
    });

    it('fires callbacks while collecting', async () => {
      const results: StreamResultEvent[] = [];

      const handle = new StreamHandle(createSource(sampleEvents))
        .on('result', (r) => results.push(r));

      await handle.text();

      expect(results).toHaveLength(1);
    });
  });

  describe('pipe()', () => {
    it('writes text to a writable and returns result', async () => {
      const chunks: string[] = [];
      const writable = { write: (chunk: string) => { chunks.push(chunk); return true; } };

      const handle = new StreamHandle(createSource(sampleEvents));
      const result = await handle.pipe(writable);

      expect(chunks).toEqual(['Hello ', 'world']);
      expect(result.sessionId).toBe('sess-1');
    });
  });

  describe('toReadable()', () => {
    it('returns a Node.js Readable that emits text chunks', async () => {
      const handle = new StreamHandle(createSource(sampleEvents));
      const readable = handle.toReadable();

      expect(readable).toBeInstanceOf(Readable);

      const chunks: string[] = [];
      for await (const chunk of readable) {
        chunks.push(chunk as string);
      }

      expect(chunks.join('')).toBe('Hello world');
    });
  });

  describe('[Symbol.asyncIterator]', () => {
    it('yields all StreamEvent objects (backward compat)', async () => {
      const handle = new StreamHandle(createSource(sampleEvents));
      const events: StreamEvent[] = [];

      for await (const event of handle) {
        events.push(event);
      }

      expect(events).toHaveLength(4);
      expect(events[0]!.type).toBe('text');
      expect(events[2]!.type).toBe('tool_use');
      expect(events[3]!.type).toBe('result');
    });
  });

  describe('on() chaining', () => {
    it('returns this for fluent chaining', () => {
      const handle = new StreamHandle(createSource([]));

      const result = handle
        .on('text', () => {})
        .on('tool_use', () => {})
        .on('result', () => {})
        .on('error', () => {})
        .on('system', () => {});

      expect(result).toBe(handle);
    });
  });

  describe('error and system events', () => {
    it('dispatches error events', async () => {
      const errors: string[] = [];
      const events: StreamEvent[] = [
        { type: 'error', message: 'something failed', code: 'E001' },
        { type: 'result', text: '', sessionId: '', usage: { inputTokens: 0, outputTokens: 0 }, cost: null, durationMs: 0 },
      ];

      await new StreamHandle(createSource(events))
        .on('error', (e) => errors.push(e.message))
        .done();

      expect(errors).toEqual(['something failed']);
    });

    it('dispatches system events', async () => {
      const systems: string[] = [];
      const events: StreamEvent[] = [
        { type: 'system', subtype: 'init', data: { model: 'sonnet' } },
        { type: 'result', text: '', sessionId: '', usage: { inputTokens: 0, outputTokens: 0 }, cost: null, durationMs: 0 },
      ];

      await new StreamHandle(createSource(events))
        .on('system', (e) => systems.push(e.subtype))
        .done();

      expect(systems).toEqual(['init']);
    });
  });
});
