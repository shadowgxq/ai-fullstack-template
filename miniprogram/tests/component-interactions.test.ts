import { describe, expect, it } from 'vitest';
import {
  moveItem,
  parseDragMetrics,
  dragPosition,
  dragLayout,
  reorderExamples,
} from '../src/features/component-library/interaction-model';

const ids = (rows: readonly { id: string }[]) => rows.map((row) => row.id);
const rows = reorderExamples;
const metrics = rows.map((row, index) => ({ id: row.id, top: 100 + index * 84, height: 76 }));

describe('reorder interaction', () => {
  it('accepts the native geometry only when all current row identities match', () => {
    const raw = metrics.map((row) => ({ ...row, id: `sort-${row.id}` }));
    expect(parseDragMetrics(raw, ids(rows))).toEqual(metrics);
    expect(parseDragMetrics(raw, ids([...rows].reverse()))).toBeNull();
    expect(parseDragMetrics(raw.slice(1), ids(rows))).toBeNull();
    expect(parseDragMetrics(null, ids(rows))).toBeNull();
  });
  it('rejects invalid or overlapping row geometry', () => {
    const raw = metrics.map((row) => ({ ...row, id: `sort-${row.id}` }));
    for (const invalid of [{ top: NaN }, { height: 0 }, { height: Infinity }, { top: 50 }]) {
      expect(
        parseDragMetrics(
          raw.map((row, index) => (index === 1 ? { ...row, ...invalid } : row)),
          ids(rows),
        ),
      ).toBeNull();
    }
  });
  it('moves the first row to the last slot and clamps the dragged surface to the list', () => {
    const next = dragPosition(rows, rows[0].id, 9999, metrics)!;
    expect(ids(next.rows)).toEqual(['input', 'card', 'feedback', 'button']);
    expect(next.top).toBe(352);
    expect(next.offset).toBe(0);
    expect(rows[0].id).toBe('button');
  });
  it('moves the last row to the first slot without dropping or duplicating row data', () => {
    const next = dragPosition(rows, rows[3].id, -100, metrics)!;
    expect(ids(next.rows)).toEqual(['feedback', 'button', 'input', 'card']);
    expect(next.top).toBe(100);
    expect(next.offset).toBe(0);
    expect(next.rows.find((row) => row.id === 'feedback')).toBe(rows[3]);
  });
  it('tracks the finger between slots and can return to the original order', () => {
    const down = dragPosition(rows, 'button', 280, metrics)!;
    expect(ids(down.rows)).toEqual(['input', 'card', 'button', 'feedback']);
    expect(down.offset).toBe(12);
    const up = dragPosition(down.rows, 'button', 100, metrics)!;
    expect(ids(up.rows)).toEqual(ids(rows));
  });
  it('does not oscillate after a preview reorder when measured row heights differ', () => {
    const varying = [
      { id: 'button', top: 100, height: 40 },
      { id: 'input', top: 148, height: 120 },
    ];
    const first = dragPosition(rows.slice(0, 2), 'button', 150, varying)!;
    expect(ids(first.rows)).toEqual(['input', 'button']);
    const second = dragPosition(first.rows, 'button', 150, varying)!;
    expect(ids(second.rows)).toEqual(ids(first.rows));
    expect(second.top).toBe(first.top);
    expect(dragLayout(first.rows, varying)).toEqual([
      { id: 'input', top: 100, height: 120 },
      { id: 'button', top: 228, height: 40 },
    ]);
  });
  it('leaves the original snapshot intact for touch cancellation and rejects invalid moves', () => {
    const original = [...rows];
    const moved = moveItem(original, 'button', 3);
    expect(ids(original)).toEqual(['button', 'input', 'card', 'feedback']);
    expect(ids(moved)).toEqual(['input', 'card', 'feedback', 'button']);
    for (const to of [-1, 4, 0.5]) expect(moveItem(original, 'button', to)).toEqual(original);
    expect(moveItem(original, 'missing', 1)).toEqual(original);
    expect(dragPosition(original, 'missing', 100, metrics)).toBeNull();
  });
});
