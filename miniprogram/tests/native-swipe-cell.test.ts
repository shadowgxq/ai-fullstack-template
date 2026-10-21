import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { beforeEach, describe, expect, it, vi } from 'vitest';

interface CellData {
  rightWidth: number;
  opened: boolean;
  wrapperStyle: string;
  catchMove: boolean;
}
interface TouchEvent {
  touches?: unknown;
  changedTouches?: unknown;
}
interface Cell {
  data: CellData;
  _offset: number;
  _opened: boolean;
  _suppressTap: boolean;
  setData: (patch: Partial<CellData>) => void;
  triggerEvent: (name: string, detail?: { opened?: boolean; wasOpen?: boolean }) => void;
  startDrag: (event: TouchEvent) => void;
  onDrag: (event: TouchEvent) => void;
  endDrag: (event: TouchEvent) => void;
  cancelDrag: () => void;
  onCellTap: () => void;
  settle: (opened: boolean, notify: boolean) => void;
}
interface Definition {
  data: Pick<CellData, 'wrapperStyle' | 'catchMove'>;
  methods: Pick<Cell, 'startDrag' | 'onDrag' | 'endDrag' | 'cancelDrag' | 'onCellTap' | 'settle'>;
  properties: { opened: { observer: (this: Cell, opened: boolean) => void } };
  lifetimes: { attached: (this: Cell) => void; detached: (this: Cell) => void };
}
const captured: { definition?: Definition } = {};
// 执行生产原生组件，替换宿主边界；不另写一份算法当作被测实现。
runInNewContext(
  readFileSync(
    new URL('../src/features/component-library/native/swipe-cell/index.js', import.meta.url),
    'utf8',
  ),
  {
    Component: (definition: Definition) => {
      captured.definition = definition;
    },
  },
);
if (!captured.definition) throw new Error('Native component was not registered');
const definition = captured.definition;
const point = (x: number, y = 100) => ({ clientX: x, clientY: y });
const move = (x: number, y = 100) => ({ touches: [point(x, y)] });
const release = (x: number, y = 100) => ({ changedTouches: [point(x, y)] });
let cell: Cell;
const updates = vi.fn<(patch: Partial<CellData>) => void>();
const events = vi.fn<Cell['triggerEvent']>();
function setOpened(opened: boolean) {
  cell.data.opened = opened;
  definition.properties.opened.observer.call(cell, opened);
}
beforeEach(() => {
  cell = Object.assign(
    {
      data: { ...definition.data, rightWidth: 128, opened: false },
      _offset: 0,
      _opened: false,
      _suppressTap: false,
      setData: (patch: Partial<CellData>) => {
        Object.assign(cell.data, patch);
        updates(patch);
      },
      triggerEvent: events,
    },
    definition.methods,
  );
  definition.lifetimes.attached.call(cell);
  updates.mockClear();
  events.mockClear();
});

describe('native swipe cell', () => {
  it('tracks a left swipe with one transform and notifies React only at the boundary', () => {
    cell.startDrag(move(200));
    events.mockClear();
    for (let x = 199; x >= 100; x--) cell.onDrag(move(x));
    expect(events).not.toHaveBeenCalled();
    expect(cell.data.catchMove).toBe(true);
    expect(cell._offset).toBe(-100);
    expect(cell.data.wrapperStyle).toContain('translate3d(-100px,0,0)');
    cell.endDrag(release(100));
    expect(cell._offset).toBe(-128);
    expect(cell.data.catchMove).toBe(false);
    expect(events).toHaveBeenCalledExactlyOnceWith('change', { opened: true });
  });
  it('preserves vertical scrolling and locks the first unambiguous direction', () => {
    cell.startDrag(move(200));
    cell.onDrag(move(198, 130));
    cell.onDrag(move(50, 150));
    cell.endDrag(release(50, 150));
    expect(cell._offset).toBe(0);
    expect(cell.data.catchMove).toBe(false);
    expect(updates).not.toHaveBeenCalled();
    expect(events.mock.calls.filter(([name]) => name === 'change')).toEqual([]);
  });
  it('keeps horizontal tracking when a later move becomes diagonal', () => {
    cell.startDrag(move(200));
    cell.onDrag(move(180, 102));
    cell.onDrag(move(100, 200));
    expect(cell._offset).toBe(-100);
    expect(cell.data.catchMove).toBe(true);
  });
  it('uses different open and close thresholds to avoid snapping back on small reverse moves', () => {
    cell.startDrag(move(200));
    cell.endDrag(release(170));
    expect(cell._opened).toBe(false);
    cell.startDrag(move(200));
    cell.endDrag(release(155));
    expect(cell._opened).toBe(true);
    cell.startDrag(move(100));
    cell.endDrag(release(130));
    expect(cell._opened).toBe(true);
    cell.startDrag(move(100));
    cell.endDrag(release(150));
    expect(cell._opened).toBe(false);
  });
  it('uses the release point even when no final move event was delivered', () => {
    cell.startDrag(move(200));
    cell.onDrag(move(180));
    cell.endDrag(release(60));
    expect(cell._offset).toBe(-128);
    expect(cell._opened).toBe(true);
  });
  it('restores the state at gesture start when the host cancels the touch', () => {
    setOpened(true);
    events.mockClear();
    cell.startDrag(move(100));
    cell.onDrag(move(200));
    cell.cancelDrag();
    expect(cell._opened).toBe(true);
    expect(cell._offset).toBe(-128);
    expect(cell.data.catchMove).toBe(false);
    expect(events.mock.calls.filter(([name]) => name === 'change')).toEqual([]);
  });
  it('cancels multiple fingers and rejects malformed coordinates without leaving scroll locked', () => {
    cell.startDrag(move(200));
    cell.onDrag(move(100));
    cell.onDrag({ touches: [point(100), point(101)] });
    expect(cell._offset).toBe(0);
    expect(cell.data.catchMove).toBe(false);
    cell.startDrag({ touches: [point(NaN)] });
    cell.onDrag(move(50));
    expect(cell._offset).toBe(0);
  });
  it('deduplicates repeated pixels and clamps overscroll without redundant native updates', () => {
    cell.startDrag(move(200));
    cell.onDrag(move(100));
    const count = updates.mock.calls.length;
    for (let index = 0; index < 100; index++) cell.onDrag(move(100));
    expect(updates).toHaveBeenCalledTimes(count);
    cell.onDrag(move(-500));
    expect(cell._offset).toBe(-128);
    const edge = updates.mock.calls.length;
    cell.onDrag(move(-800));
    expect(updates).toHaveBeenCalledTimes(edge);
  });
  it('suppresses the synthetic tap from a swipe but accepts a new tap immediately', () => {
    cell.startDrag(move(200));
    cell.endDrag(release(100));
    events.mockClear();
    cell.onCellTap();
    expect(events).not.toHaveBeenCalled();
    cell.startDrag(move(200));
    cell.endDrag(release(200));
    cell.onCellTap();
    expect(events).toHaveBeenCalledWith('cellclick', { wasOpen: true });
    expect(cell._opened).toBe(false);
    cell.startDrag(move(200));
    cell.endDrag(release(202));
    cell.onCellTap();
    expect(events).toHaveBeenLastCalledWith('cellclick', { wasOpen: false });
  });
  it('responds to outside close and reset through its controlled property without echoing changes', () => {
    setOpened(true);
    expect(cell._offset).toBe(-128);
    setOpened(false);
    expect(cell._offset).toBe(0);
    expect(events).not.toHaveBeenCalled();
  });
});
