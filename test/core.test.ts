import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildChangeFile } from '../src/core/changeFile.ts';
import { joinParts, normalize, sameParts } from '../src/core/text.ts';

test('normalize collapses whitespace', () => {
  assert.equal(normalize('  Get\n   Started '), 'Get Started');
});

test('joinParts reads pieces as one sentence', () => {
  assert.equal(joinParts(['Leverage ', 'cutting-edge', ' solutions']), 'Leverage cutting-edge solutions');
});

test('sameParts compares piece by piece', () => {
  assert.ok(sameParts(['a', 'b'], ['a', 'b']));
  assert.ok(!sameParts(['a', 'b'], ['ab']));
});

test('change file lists every edit with before and after', () => {
  const file = buildChangeFile('https://example.com/', [
    { label: 'H1', before: 'Old  headline', after: 'New headline' },
    { label: 'Button', before: 'Get Started', after: 'Book a call' },
  ]);
  assert.equal(
    file,
    '# Copy changes\nPage: https://example.com/\nChanges: 2\n\n## 1. H1\nBefore: Old headline\nAfter:  New headline\n\n## 2. Button\nBefore: Get Started\nAfter:  Book a call\n',
  );
});

test('change file with no edits', () => {
  assert.equal(buildChangeFile('https://example.com/', []), '# Copy changes\nPage: https://example.com/\nChanges: 0\n');
});
