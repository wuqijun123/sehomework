const assert = require('node:assert/strict');
const { normalizeLegacyTab } = require('../frontend/apps/web-antd/src/router/legacy-route.ts');
const tabs = ['overview', 'training', 'intelligent', 'tasks', 'history'];
const normalize = path => normalizeLegacyTab(new URL('http://127.0.0.1:8765/' + path), tabs);
for (const tab of tabs) {
  const url = normalize('?tab=' + tab);
  assert.equal(url.hash, '#/' + tab);
  assert.equal(url.searchParams.has('tab'), false);
}
assert.equal(normalize('?tab=tasks#/').hash, '#/tasks');
assert.equal(normalize('?tab=tasks#/intelligent').hash, '#/intelligent');
assert.equal(normalize('?tab=unknown').hash, '');
assert.equal(normalize('?tab=unknown').searchParams.get('tab'), 'unknown');
const nested = normalize('?tab=tasks&next=duo&join=ABCDEF1234&submission=42');
assert.equal(nested.searchParams.get('next'), 'duo');
assert.equal(nested.searchParams.get('join'), 'ABCDEF1234');
assert.equal(nested.searchParams.get('submission'), '42');
assert.equal(normalize('#/history').hash, '#/history');
console.log('Vben routes passed: legacy tabs, explicit hash priority and preserved query parameters.');
