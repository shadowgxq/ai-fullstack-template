import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseCandidates, parseRecommendation, parseSelection } from '../src/features/outfits/api';
import { parseWearCreated, parseWearRecord } from '../src/features/wear-history/api';
import { parseStatistics } from '../src/features/statistics/api';
const receipt = readFileSync(new URL('./fixtures/outfit-provider.receipt', import.meta.url));
const provider: Record<string, unknown> = JSON.parse(receipt.toString('utf8'));

describe('recorded Backend HTTP responses through actual consumer decoders', () => {
  it('preserves the exact non-secret provider receipt bytes', () => {
    expect(createHash('sha256').update(receipt).digest('hex')).toBe(
      '7405a55fcc794913afea0aebc350d73124b6685a52814db1dbb16a5199a1144b',
    );
  });
  it('decodes all recommendation states, full replacement and confirmed wear/statistics', () => {
    expect(parseRecommendation(provider.empty).outcome).toBe('no_inventory');
    expect(parseRecommendation(provider.queued).status).toBe('dispatch_pending');
    expect(parseRecommendation(provider.generating).status).toBe('generating');
    const ready = parseRecommendation(provider.ready);
    expect(ready.status).toBe('ready');
    expect(ready.result?.selected_ids).toHaveLength(1);
    const candidates = parseCandidates(provider.candidates);
    expect(candidates.items.length).toBeGreaterThan(0);
    const selected = parseSelection(provider.selection);
    expect(selected.request_id).toBe(ready.request_id);
    expect(selected.selected_ids).toHaveLength(2);
    expect(selected.reasons.length).toBeGreaterThan(0);
    const created = parseWearCreated(provider.wear_created);
    const record = parseWearRecord(provider.wear_detail);
    expect(record.id).toBe(created.id);
    expect(record.recommendation_request_id).toBe(ready.request_id);
    expect(record.items.map((item) => item.garment_id).sort()).toEqual(
      [...selected.selected_ids].sort(),
    );
    expect(parseRecommendation(provider.stale)).toMatchObject({
      status: 'stale',
      error_code: 'input_changed',
      result: null,
    });
    expect(parseRecommendation(provider.cancelled).status).toBe('cancelled');
    expect(parseStatistics(provider.statistics).wear_record_count).toBeGreaterThan(0);
  });
});
