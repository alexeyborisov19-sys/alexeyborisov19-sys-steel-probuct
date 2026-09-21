import assert from 'node:assert/strict';
import test from 'node:test';
import { bendConfigurationConflict } from '../lib/instant-quote/cad-configuration-conflicts';
test('model bends cannot be removed or overridden by a public edit', () => {
  assert.ok(bendConfigurationConflict(2,[],2));
  assert.ok(bendConfigurationConflict(2,['bending'],0));
  assert.ok(bendConfigurationConflict(2,['bending'],3));
  assert.equal(bendConfigurationConflict(2,['bending'],2),null);
  assert.equal(bendConfigurationConflict(2,['bending']),null);
  assert.equal(bendConfigurationConflict(null,['bending'],3),null);
});
