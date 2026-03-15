import { describe, it, expect } from 'vitest';
import { Readable, Duplex } from 'node:stream';
import { ChatHandle } from '../src/client/chat-handle.js';

// ChatHandle spawns a real process, so we test it with a mock script
// that echoes NDJSON responses. For unit tests, we test the class structure.

describe('ChatHandle', () => {
  // Use 'echo' as a harmless process that exits immediately
  function createTestChat(): ChatHandle {
    return new ChatHandle('echo', ['{}'], {
      cwd: process.cwd(),
      env: {},
    });
  }

  describe('properties', () => {
    it('starts with null sessionId', () => {
      const chat = createTestChat();
      expect(chat.sessionId).toBeNull();
      expect(chat.turnCount).toBe(0);
      expect(chat.closed).toBe(false);
      chat.abort();
    });
  });

  describe('on() chaining', () => {
    it('returns this for fluent chaining', () => {
      const chat = createTestChat();

      const result = chat
        .on('text', () => {})
        .on('tool_use', () => {})
        .on('result', () => {})
        .on('error', () => {})
        .on('system', () => {});

      expect(result).toBe(chat);
      chat.abort();
    });
  });

  describe('toReadable()', () => {
    it('returns a Node.js Readable', () => {
      const chat = createTestChat();
      const readable = chat.toReadable();

      expect(readable).toBeInstanceOf(Readable);
      chat.abort();
    });
  });

  describe('toDuplex()', () => {
    it('returns a Node.js Duplex', () => {
      const chat = createTestChat();
      const duplex = chat.toDuplex();

      expect(duplex).toBeInstanceOf(Duplex);
      chat.abort();
    });
  });

  describe('pipe()', () => {
    it('returns the destination for chaining', () => {
      const chat = createTestChat();
      const dest = { write: () => true } as unknown as NodeJS.WritableStream;

      const result = chat.pipe(dest);
      expect(result).toBe(dest);
      chat.abort();
    });
  });

  describe('end()', () => {
    it('marks the chat as closed', () => {
      const chat = createTestChat();
      chat.end();

      expect(chat.closed).toBe(true);
    });

    it('is idempotent', () => {
      const chat = createTestChat();
      chat.end();
      chat.end(); // no error

      expect(chat.closed).toBe(true);
    });
  });

  describe('abort()', () => {
    it('marks the chat as closed', () => {
      const chat = createTestChat();
      chat.abort();

      expect(chat.closed).toBe(true);
    });
  });

  describe('send() after close', () => {
    it('rejects when chat is closed', async () => {
      const chat = createTestChat();
      chat.end();

      await expect(chat.send('hello')).rejects.toThrow('Chat is closed');
    });
  });
});
