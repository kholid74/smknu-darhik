import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildStudentDashboard } from './student-dashboard-model';

const period = { id: 'period-id', slug: 'pemilu-2026', name: 'Pemilihan 2026', opensAt: new Date(0), closesAt: new Date(1) };

test('dashboard exposes only participation status and points to the next organization', () => {
  const dashboard = buildStudentDashboard(period, ['OSIS']);
  assert.equal(dashboard.scope, 'ELECTION_VOTING');
  assert.equal(dashboard.participation.OSIS, true);
  assert.equal(dashboard.participation.DEWAN_AMBALAN, false);
  assert.equal(dashboard.nextOrganization, 'DEWAN_AMBALAN');
  assert.equal(dashboard.services[0].href, '/siswa/e-voting/pemilu-2026/pilih');
  assert.equal('name' in dashboard, false);
  assert.equal('nisn' in dashboard, false);
  assert.deepEqual(dashboard.services.slice(1).map(({ status }) => status), ['coming_soon', 'coming_soon']);
  assert.equal('href' in dashboard.services[1], false);
});

test('dashboard marks all organizations complete without inventing a next action', () => {
  const dashboard = buildStudentDashboard(period, ['OSIS', 'DEWAN_AMBALAN', 'IPNU', 'IPPNU']);
  assert.equal(dashboard.complete, true);
  assert.equal(dashboard.nextOrganization, null);
});
