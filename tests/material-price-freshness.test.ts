import assert from 'node:assert/strict';
import test from 'node:test';
import { selectBestStoredPrice, selectBestStoredPriceForStock, shouldRefreshPriceFeeds, type StoredPriceSnapshot } from '../lib/instant-quote/material-price-feed';
const now = new Date('2026-09-21T12:00:00Z');
function snapshot(sourceId: string, fetchedAt: string, status: StoredPriceSnapshot['status'] = 'ok'): StoredPriceSnapshot {
  return { sourceId, fetchedAt, sourceDate: '2026-09-21', status, rows: [{materialId:'cold', thicknessMm:2, rubPerTon:100000, source:'Synthetic fixture', fetchedAt, sourceDate:'2026-09-21', size:'2x1250x2500'}] };
}
test('fresh matching source wins over expired supplier priority for both selectors', () => {
  const rows = [snapshot('atlantik-smolensk', '2026-09-10T12:00:00Z'), snapshot('manual-confirmed', now.toISOString())];
  assert.equal(selectBestStoredPrice(rows,'cold',2,now).sourceId,'manual-confirmed');
  assert.equal(selectBestStoredPriceForStock(rows,'cold',2,{widthMm:100,heightMm:100},now).sourceId,'manual-confirmed');
});
test('explicitly stale and invalid or future fetch timestamps never become fresh', () => {
  for (const row of [snapshot('atlantik-smolensk',now.toISOString(),'stale'),snapshot('atlantik-smolensk','invalid'),snapshot('atlantik-smolensk','2027-01-01')]) {
    assert.equal(selectBestStoredPrice([row],'cold',2,now).stale,true);
    assert.equal(shouldRefreshPriceFeeds([row],now),true);
  }
});
test('expired price remains available only with explicit stale status and no zero substitute', () => {
  assert.equal(selectBestStoredPrice([snapshot('atlantik-smolensk','2026-09-10')],'cold',2,now).stale,true);
  assert.equal(selectBestStoredPrice([],'cold',2,now).price,null);
});
