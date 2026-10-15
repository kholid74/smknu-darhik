import test from 'node:test';
import assert from 'node:assert/strict';
import { generatePin, pinFingerprint, pinHashMaterial, PinError, validatePinRequest } from './pin-input';

test('PIN request validates bounded unique versioned targets and reset reason', () => {
  const voterId = '94e2e7e3-1e63-4c31-ae85-48263d8e1a91';
  assert.equal(validatePinRequest({ targets: [{ voterId, pinVersion: 0 }], mode: 'issue', adminPassword: 'secret' }).mode, 'issue');
  assert.equal(validatePinRequest({ targets: [{ voterId, pinVersion: 1 }], mode: 'reset', reasonCode: 'LOST_SLIP', adminPassword: 'secret' }).reasonCode, 'LOST_SLIP');
  assert.throws(() => validatePinRequest({ targets: [{ voterId, pinVersion: 1 }], mode: 'reset', adminPassword: 'secret' }), PinError);
  assert.throws(() => validatePinRequest({ targets: [{ voterId, pinVersion: 0 }, { voterId, pinVersion: 0 }], mode: 'issue', adminPassword: 'secret' }), PinError);
});

test('generated PIN is 10 decimal digits and keyed derivations are domain-separated', () => {
  const pin = generatePin();
  assert.match(pin, /^\d{10}$/);
  assert.notEqual(pinHashMaterial('s'.repeat(32), 'period', 'nisn', pin), pinFingerprint('s'.repeat(32), 'period', pin));
  assert.notEqual(pinFingerprint('s'.repeat(32), 'period-a', pin), pinFingerprint('s'.repeat(32), 'period-b', pin));
});
