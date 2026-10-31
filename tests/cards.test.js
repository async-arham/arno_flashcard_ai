import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import handler from '../api/generate.js';
import { cleanCards, parseModelCards, prepareSource } from '../lib/cards.js';

const study = 'Photosynthesis is the process plants use to make food. Chlorophyll absorbs sunlight. Chloroplasts contain chlorophyll. Water is needed for photosynthesis.';
const success = { choices: [{ message: { content: JSON.stringify({ cards: [{ q: 'What is photosynthesis?', a: 'The process plants use to make food.' }] }) } }] };

function mockRes() {
  return {
    code: null, data: null, headers: {},
    setHeader(key, value) { this.headers[key] = value; },
    status(code) { this.code = code; return this; },
    json(data) { this.data = data; return this; },
  };
}
async function call(textOrBody = { text: study }, method = 'POST') {
  const res = mockRes();
  await handler({ method, body: textOrBody }, res);
  return res;
}
async function withProvider(key, implementation, fn) {
  const oldFetch = globalThis.fetch;
  const oldKey = process.env.GROQ_API_KEY;
  const oldModel = process.env.GROQ_MODEL;
  if (key === undefined) delete process.env.GROQ_API_KEY;
  else process.env.GROQ_API_KEY = key;
  delete process.env.GROQ_MODEL;
  globalThis.fetch = implementation;
  try { return await fn(); }
  finally {
    globalThis.fetch = oldFetch;
    if (oldKey === undefined) delete process.env.GROQ_API_KEY;
    else process.env.GROQ_API_KEY = oldKey;
    if (oldModel === undefined) delete process.env.GROQ_MODEL;
    else process.env.GROQ_MODEL = oldModel;
  }
}
const response = (status, payload, retryAfter = null) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => payload,
  headers: { get: name => name === 'retry-after' ? retryAfter : null },
});

test('AI parser accepts valid structured JSON, cleans duplicate questions', () => {
  assert.deepEqual(parseModelCards('```json\n{"cards":[{"q":"Q?","a":"A"},{"q":" q? ","a":"different"},{"q":"Another?","a":"Yes"}]}\n```'),
    [{ q: 'Q?', a: 'A' }, { q: 'Another?', a: 'Yes' }]);
});

test('reject invalid cards and length-limit valid cards', () => {
  assert.deepEqual(cleanCards([null, {}, { q: '', a: 'bad' }, { q: ' One? ', a: ' Answer ' }, { q: 'Two?', a: 'B' }], 1),
    [{ q: 'One?', a: 'Answer' }]);
  assert.deepEqual(parseModelCards('not JSON'), []);
  assert.deepEqual(parseModelCards(JSON.stringify([{ q: 'Q?', a: 'A' }])), []);
});

test('long text samples beginning, middle and end; short text unmodified', () => {
  assert.deepEqual(prepareSource('  hello  '), { text: 'hello', truncated: false });
  const original = 'START_' + 'a'.repeat(16000) + 'MIDDLE_' + 'b'.repeat(16000) + 'END';
  const sample = prepareSource(original);
  assert.equal(sample.truncated, true);
  assert.ok(sample.text.includes('START_'));
  assert.ok(sample.text.includes('MIDDLE_'));
  assert.ok(sample.text.includes('END'));
  assert.ok(sample.text.length < original.length);
});

test('HTML has no deck notice, quick mode, or offline generator', async () => {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  const lib = await readFile(new URL('../lib/cards.js', import.meta.url), 'utf8');
  assert.doesNotMatch(html, /deckNotice|deck-notice|mode === 'quick'/);
  assert.match(html, /data\.mode !== 'ai'/);
  assert.doesNotMatch(lib, /function quickCards|export const quickCards/);
});

test('no Groq key: fails clearly and never manufactures cards', async () => {
  await withProvider(undefined, () => { throw Error('fetch must not be called'); }, async () => {
    const res = await call();
    assert.equal(res.code, 503);
    assert.match(res.data.error.message, /GROQ_API_KEY/);
    assert.equal(res.data.cards, undefined);
  });
});

test('empty, invalid, tiny and oversized requests are rejected', async () => {
  for (const [body, method, code] of [
    [{}, 'GET', 405],
    [{}, 'POST', 400],
    [null, 'POST', 400],
    ['invalid JSON', 'POST', 400],
    [{ text: 5 }, 'POST', 400],
    [{ text: 'abc' }, 'POST', 422],
    [{ text: 'x'.repeat(300001) }, 'POST', 413],
  ]) {
    const res = await call(body, method);
    assert.equal(res.code, code, JSON.stringify({ method, code }));
    assert.ok(res.data.error.message);
  }
});

test('success returns strictly AI cards and does not expose the secret', async () => {
  await withProvider('test-private-secret', async (url, options) => {
    assert.match(url, /^https:\/\/api\.groq\.com/);
    assert.equal(options.headers.Authorization, 'Bearer test-private-secret');
    const payload = JSON.parse(options.body);
    assert.equal(payload.model, 'openai/gpt-oss-20b');
    assert.equal(payload.response_format.type, 'json_schema');
    assert.equal(payload.response_format.json_schema.strict, true);
    assert.equal(payload.include_reasoning, false);
    assert.match(payload.messages[1].content, /Photosynthesis/);
    return response(200, success);
  }, async () => {
    const res = await call();
    assert.equal(res.code, 200);
    assert.equal(res.data.mode, 'ai');
    assert.deepEqual(res.data.cards, [{ q: 'What is photosynthesis?', a: 'The process plants use to make food.' }]);
    assert.doesNotMatch(JSON.stringify(res.data), /test-private-secret/);
  });
});

test('truncated AI requests still return explicit truncated=true', async () => {
  await withProvider('fake', async (_, options) => {
    const payload = JSON.parse(options.body);
    assert.ok(payload.messages[1].content.length < 17000);
    return response(200, success);
  }, async () => {
    const res = await call({ text: 'long text '.repeat(4000) });
    assert.equal(res.code, 200);
    assert.equal(res.data.truncated, true);
  });
});

test('bad key and forbidden Groq account return errors, never quick cards', async () => {
  for (const status of [401, 403]) {
    await withProvider('fake', async () => response(status, { error: { message: 'key rejected' } }), async () => {
      const res = await call();
      assert.equal(res.code, 503);
      assert.match(res.data.error.message, /API key/);
      assert.equal(res.data.cards, undefined);
    });
  }
});

test('invalid model returns helpful error with no retry', async () => {
  let count = 0;
  await withProvider('fake', async () => { count++; return response(400, { error: { message: 'invalid model' } }); }, async () => {
    const res = await call();
    assert.equal(res.code, 502);
    assert.match(res.data.error.message, /model/i);
    assert.equal(count, 1);
  });
});

test('rate limit retries once then returns rate-limit error, not cards', async () => {
  let count = 0;
  await withProvider('fake', async () => { count++; return response(429, { error: { message: 'limit' } }, '0'); }, async () => {
    const res = await call();
    assert.equal(res.code, 429);
    assert.equal(count, 2);
    assert.equal(res.data.cards, undefined);
  });
});

test('transient network error retries once and succeeds with AI cards', async () => {
  let count = 0;
  await withProvider('fake', async () => {
    count++;
    if (count === 1) throw new Error('offline');
    return response(200, success);
  }, async () => {
    const res = await call();
    assert.equal(res.code, 200);
    assert.equal(res.data.mode, 'ai');
    assert.equal(count, 2);
  });
});

test('malformed Groq JSON retries once then fails instead of creating synthetic cards', async () => {
  let count = 0;
  await withProvider('fake', async () => { count++; return response(200, { choices: [{ message: { content: 'not-json' } }] }); }, async () => {
    const res = await call();
    assert.equal(res.code, 502);
    assert.match(res.data.error.message, /valid flashcards/);
    assert.equal(res.data.cards, undefined);
    assert.equal(count, 2);
  });
});

test('timeout and other provider errors return actionable failures', async () => {
  await withProvider('fake', async () => { throw Object.assign(new Error('timed out'), { name: 'AbortError' }); }, async () => {
    const res = await call();
    assert.equal(res.code, 504);
    assert.match(res.data.error.message, /too long/);
  });
  await withProvider('fake', async () => response(502, {}), async () => {
    const res = await call();
    assert.equal(res.code, 502);
    assert.match(res.data.error.message, /temporarily unavailable/);
  });
});

test('custom Groq model uses compatible JSON object mode', async () => {
  await withProvider('fake', async (_, options) => {
    assert.equal(JSON.parse(options.body).response_format.type, 'json_object');
    return response(200, success);
  }, async () => {
    process.env.GROQ_MODEL = 'llama-3.3-70b-versatile';
    const res = await call();
    assert.equal(res.code, 200);
  });
});
