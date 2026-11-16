'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { vlen, wrap, inline, fetchError } = require('../index.js');
const strip = (s) => s.replace(/\x1b\[[0-9;]*m/g, '');

test('vlen counts CJK as two columns', () => {
  assert.strictEqual(vlen('abc'), 3);
  assert.strictEqual(vlen('中文'), 4);
  assert.strictEqual(vlen('\x1b[1m中\x1b[0ma'), 3);
});

test('Chinese paragraphs wrap inside the width (no spaces to split on)', () => {
  const text = '这是一段没有空格的中文段落，'.repeat(12);
  const out = wrap(text, 40, '   ', '   ');
  const lines = out.split('\n');
  assert.ok(lines.length > 3);
  for (const l of lines) assert.ok(vlen(l) <= 40, `too wide: ${vlen(l)} ${l}`);
  for (const l of lines.slice(1)) assert.ok(!/^\s*[，。]/.test(l), 'line starts with punctuation');
  assert.strictEqual(lines.map((l) => l.trim()).join(''), text);
});

test('English still wraps on spaces', () => {
  const out = wrap('the quick brown fox jumps over the lazy dog '.repeat(4), 30, '', '');
  for (const l of out.split('\n')) { assert.ok(vlen(l) <= 30); assert.ok(!/^\S+\S$/.test('') ); }
  assert.ok(!out.split('\n').some((l) => /^(own|ump|azy)/.test(l)), 'split inside a word');
});

test('very long URLs are hard-wrapped instead of overflowing', () => {
  const out = wrap('see ' + 'https://example.com/' + 'a'.repeat(120), 40, '', '');
  for (const l of out.split('\n')) assert.ok(vlen(l) <= 40);
});

test('underscores in URLs and identifiers are not turned into italics', () => {
  assert.strictEqual(strip(inline('call snake_case_name now')), 'call snake_case_name now');
  assert.ok(strip(inline('[docs](https://a.com/some_long_path_x)')).includes('some_long_path_x'));
  assert.ok(strip(inline('go https://a.com/x_y_z here')).includes('x_y_z'));
  assert.ok(!inline('`a_b_c`').includes('\x1b[3m'));
});

test('real emphasis still renders', () => {
  assert.ok(inline('this is _italic_ text').includes('\x1b[3mitalic'));
  assert.ok(inline('this is *italic* text').includes('\x1b[3mitalic'));
  assert.ok(inline('**bold**').includes('\x1b[1mbold'));
  assert.ok(inline('a * b * c').indexOf('\x1b[3m') === -1, 'spaced asterisks are not emphasis');
});

test('Jina 401 explains itself and points to JINA_API_KEY', () => {
  const m = fetchError(401, 'AuthenticationRequiredError: You have been blocked from performing anonymous queries due to bad IP reputation. Please authenticate.', false);
  assert.ok(m.startsWith('HTTP 401 · You have been blocked'), m);
  assert.ok(m.includes('JINA_API_KEY'));
  assert.ok(!fetchError(401, 'nope', true).includes('JINA_API_KEY'), 'no hint when a key is already set');
  assert.strictEqual(fetchError(500, ''), 'HTTP 500');
});
