import test from 'node:test';
import assert from 'node:assert/strict';
import { PeriodError, validateExpectedPeriodConfig, validatePeriodConfig, validatePeriodExtension, validatePeriodInput, validatePeriodClose } from './period-input';

test('period input allows a validated schedule and trims display values', () => {
  const input = validatePeriodInput({ slug: 'osis-2026', name: '  Pemilihan OSIS ', academicYear: ' 2026/2027 ', opensAt: '2026-11-01T01:00:00.000Z', closesAt: '2026-11-01T03:00:00.000Z' });
  assert.equal(input.slug, 'osis-2026');
  assert.equal(input.name, 'Pemilihan OSIS');
  assert.equal(input.academicYear, '2026/2027');
  assert.ok(input.closesAt > input.opensAt);
});

test('period input rejects unsafe slug, unsupported fields, and inverted schedule', () => {
  assert.throws(() => validatePeriodInput({ slug: '../x', name: 'X', academicYear: '2026', opensAt: '2026-11-01T01:00Z', closesAt: '2026-11-01T02:00Z' }), PeriodError);
  assert.throws(() => validatePeriodInput({ slug: 'x', name: 'X', academicYear: '2026', opensAt: '2026-11-01T02:00Z', closesAt: '2026-11-01T01:00Z' }), PeriodError);
  assert.throws(() => validatePeriodInput({ slug: 'x', name: 'X', academicYear: '2026', opensAt: '2026-11-01T01:00Z', closesAt: '2026-11-01T02:00Z', state: 'SCHEDULED' }), PeriodError);
});

test('period configuration and expected snapshot accept only editable fields', () => {
  const value = { name: 'Pemilihan', academicYear: '2026/2027', opensAt: '2026-11-01T01:00:00.000Z', closesAt: '2026-11-01T03:00:00.000Z' };
  assert.deepEqual(validateExpectedPeriodConfig(value), validatePeriodConfig(value));
  assert.throws(() => validatePeriodConfig({ ...value, slug: 'changed' }), PeriodError);
  assert.throws(() => validateExpectedPeriodConfig({ ...value, state: 'SCHEDULED' }), PeriodError);
});

test('period extension accepts a reason code and reauthentication password only', () => {
  assert.deepEqual(validatePeriodExtension({ reasonCode: 'TECHNICAL_DISRUPTION', adminPassword: 'secret' }),
    { reasonCode: 'TECHNICAL_DISRUPTION', adminPassword: 'secret' });
  assert.throws(() => validatePeriodExtension({ reasonCode: 'technical disruption', adminPassword: 'secret' }), PeriodError);
  assert.throws(() => validatePeriodExtension({ reasonCode: 'VALID_REASON', adminPassword: 'secret', minutes: 60 }), PeriodError);
});

test('period close requires a password and explicit boolean early opt-in, without force fields', () => {
  assert.deepEqual(validatePeriodClose({adminPassword: 'secret'}), {adminPassword: 'secret', early: false});
  assert.deepEqual(validatePeriodClose({adminPassword: 'secret', early: true}), {adminPassword: 'secret', early: true});
  assert.equal(validatePeriodClose({adminPassword: 'secret', early: false}).early, false);
  for (const value of [null, [], {}, {adminPassword: ''}, {adminPassword: 'x'.repeat(257)},
    {adminPassword: 'secret', early: 'true'}, {adminPassword: 'secret', early: 1},
    {adminPassword: 'secret', early: true, force: true}]) {
    assert.throws(() => validatePeriodClose(value), PeriodError);
  }
});

test('test classification is explicit at creation and cannot be edited with configuration', () => {
  const value = {slug: 'uji', name: 'Uji', academicYear: '2026/2027', opensAt: '2026-11-01T01:00Z', closesAt: '2026-11-01T02:00Z'};
  assert.equal(validatePeriodInput(value).isTest, false);
  assert.equal(validatePeriodInput({...value, isTest: true}).isTest, true);
  assert.throws(() => validatePeriodInput({...value, isTest: 'true'}));
  const {slug, ...config} = value;
  assert.throws(() => validatePeriodConfig({...config, isTest: true}));
});
