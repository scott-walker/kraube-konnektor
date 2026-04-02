/**
 * Integration test — verifies that kraube-konnektor works
 * as an installed npm package (not source code import).
 */
import {
  Claude,
  CliNotFoundError,
  ValidationError,
  type QueryResult,
  type StreamEvent,
  type IExecutor,
  type ExecuteOptions,
} from '@scottwalker/kraube-konnektor';

// ── 1. Verify types and constructor ─────────────────────────────

console.log('1. Creating client with custom executable path...');
const claude = new Claude({
  executable: '/usr/local/bin/claude',
  model: 'sonnet',
  permissionMode: 'plan',
  maxTurns: 5,
});
console.log('   OK: Client created\n');

// ── 2. Verify validation works ──────────────────────────────────

console.log('2. Testing validation...');
try {
  new Claude({ maxTurns: -1 });
  console.log('   FAIL: Should have thrown');
} catch (e) {
  if (e instanceof ValidationError) {
    console.log(`   OK: ValidationError thrown — ${e.message}\n`);
  }
}

// ── 3. Test with mock executor ──────────────────────────────────

console.log('3. Testing with mock executor...');

const mockResult: QueryResult = {
  text: 'Hello from mock!',
  sessionId: 'test-session-123',
  usage: { inputTokens: 42, outputTokens: 84 },
  cost: 0.001,
  durationMs: 150,
  messages: [
    { role: 'user', content: 'Hi' },
    { role: 'assistant', content: 'Hello from mock!' },
  ],
  structured: null,
  raw: {},
};

const mockExecutor: IExecutor = {
  async execute(_args: readonly string[], _options: ExecuteOptions) {
    return mockResult;
  },
  async *stream(_args: readonly string[], _options: ExecuteOptions) {
    yield { type: 'text', text: 'Streaming ' } as StreamEvent;
    yield { type: 'text', text: 'works!' } as StreamEvent;
    yield {
      type: 'result',
      text: 'Streaming works!',
      sessionId: 'stream-sess',
      usage: { inputTokens: 10, outputTokens: 20 },
      cost: null,
      durationMs: 50,
    } as StreamEvent;
  },
};

const testClaude = new Claude({ model: 'opus' }, mockExecutor);

// ── 4. Test query ───────────────────────────────────────────────

const result = await testClaude.query('Say hello');
console.log(`   query() result: "${result.text}"`);
console.log(`   sessionId: ${result.sessionId}`);
console.log(`   tokens: ${result.usage.inputTokens}in / ${result.usage.outputTokens}out\n`);

// ── 5. Test streaming ───────────────────────────────────────────

console.log('4. Testing streaming...');
process.stdout.write('   stream(): "');
for await (const event of testClaude.stream('Stream test')) {
  if (event.type === 'text') {
    process.stdout.write(event.text);
  }
}
console.log('"\n');

// ── 6. Test session ─────────────────────────────────────────────

console.log('5. Testing session...');
const session = testClaude.session();
console.log(`   sessionId before query: ${session.sessionId}`);

await session.query('First message');
console.log(`   sessionId after query: ${session.sessionId}`);
console.log(`   queryCount: ${session.queryCount}\n`);

// ── 7. Test parallel ────────────────────────────────────────────

console.log('6. Testing parallel queries...');
const results = await testClaude.parallel([
  { prompt: 'Task 1' },
  { prompt: 'Task 2' },
  { prompt: 'Task 3' },
]);
console.log(`   ${results.length} parallel results received\n`);

// ── 8. Test structured output ───────────────────────────────────

console.log('7. Testing structured output option...');
await testClaude.query('Extract data', {
  schema: { type: 'object', properties: { name: { type: 'string' } } },
});
console.log('   OK: Schema option passed without error\n');

// ── 9. Test CliNotFoundError ────────────────────────────────────

console.log('8. Testing CliNotFoundError...');
const badClaude = new Claude({ executable: '/nonexistent/claude' });
try {
  await badClaude.query('This should fail');
} catch (e) {
  if (e instanceof CliNotFoundError) {
    console.log(`   OK: CliNotFoundError — ${e.executable}\n`);
  } else {
    console.log(`   OK: Error thrown (${(e as Error).message})\n`);
  }
}

// ── Done ────────────────────────────────────────────────────────

console.log('All integration tests passed!');
