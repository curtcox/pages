const test = require('node:test'); const assert = require('node:assert/strict'); const crypto = require('node:crypto');
const { encodeQr } = require('../src/qr.js');
test('QR byte-mode vector, finder pattern and capacity are stable', () => {
  const qr = encodeQr('https://example.com/'); assert.equal(qr.version, 2); assert.equal(qr.size, 25);
  assert.equal(qr.modules.length, 25); assert.equal(qr.modules[0].slice(0,7).join(''), 'truetruetruetruetruetruetrue');
  assert.deepEqual(encodeQr('https://example.com/'), qr); assert.equal(encodeQr('x'.repeat(5000)), null);
});
