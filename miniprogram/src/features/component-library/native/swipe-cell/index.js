/* global Component */
// 手势与单层位移结构参考 Vant Weapp SwipeCell（MIT），授权见相邻 LICENSE。
// https://github.com/youzan/vant-weapp/tree/dev/packages/swipe-cell
const MIN_DISTANCE = 10;
const THRESHOLD = 0.3;

function touchPoint(event, key) {
  const touches = event[key];
  if (!Array.isArray(touches) || touches.length !== 1) return null;
  const point = touches[0];
  if (!point || typeof point !== 'object') return null;
  return Number.isFinite(point.clientX) && Number.isFinite(point.clientY) ? point : null;
}

Component({
  options: { multipleSlots: true },
  properties: {
    rightWidth: { type: Number, value: 0 },
    opened: {
      type: Boolean,
      value: false,
      observer(opened) {
        if (this._ready && !this._touch) this.settle(opened, false);
      },
    },
  },
  data: { wrapperStyle: '', catchMove: false },
  lifetimes: {
    attached() {
      this._ready = true;
      this._offset = 0;
      this._opened = false;
      this._touch = null;
      this._suppressTap = false;
      this.settle(this.data.opened, false);
    },
    detached() {
      this._ready = false;
      this._touch = null;
    },
  },
  methods: {
    noop() {},
    moveTo(offset, dragging) {
      this._offset = Math.max(-this.data.rightWidth, Math.min(0, Math.round(offset)));
      const transition = dragging ? 'none' : 'transform 220ms cubic-bezier(0.18,0.89,0.32,1)';
      const wrapperStyle = `transform:translate3d(${this._offset}px,0,0);transition:${transition};`;
      const patch = {};
      if (wrapperStyle !== this.data.wrapperStyle) patch.wrapperStyle = wrapperStyle;
      if (dragging !== this.data.catchMove) patch.catchMove = dragging;
      if (Object.keys(patch).length) this.setData(patch);
    },
    settle(opened, notify) {
      const next = Boolean(opened && this.data.rightWidth > 0);
      const changed = next !== this._opened;
      this._opened = next;
      this.moveTo(next ? -this.data.rightWidth : 0, false);
      if (notify && changed) this.triggerEvent('change', { opened: next });
    },
    startDrag(event) {
      if (this._touch) {
        this.cancelDrag();
        return;
      }
      const point = touchPoint(event, 'touches');
      if (!point) return;
      this._suppressTap = false;
      this._touch = {
        x: point.clientX,
        y: point.clientY,
        startOffset: this._offset,
        startedOpen: this._opened,
        direction: '',
      };
      this.triggerEvent('start');
    },
    onDrag(event) {
      const current = this._touch;
      if (!current) return;
      const point = touchPoint(event, 'touches');
      if (!point) {
        this.cancelDrag();
        return;
      }
      const dx = point.clientX - current.x;
      const dy = point.clientY - current.y;
      if (!current.direction) {
        if (Math.abs(dx) > MIN_DISTANCE && Math.abs(dx) > Math.abs(dy))
          current.direction = 'horizontal';
        else if (Math.abs(dy) > MIN_DISTANCE && Math.abs(dy) > Math.abs(dx))
          current.direction = 'vertical';
      }
      if (current.direction) this._suppressTap = true;
      if (current.direction !== 'horizontal') return;
      // 高频更新只在当前原生组件内发送一个位移，不回传 React 或修改内容宽度。
      this.moveTo(current.startOffset + dx, true);
    },
    endDrag(event) {
      const current = this._touch;
      if (!current) return;
      // 快速释放时用最终触点结算，不依赖最后一次 move 是否已送达。
      const point = touchPoint(event, 'changedTouches');
      if (point) this.onDrag({ touches: [point] });
      if (!this._touch) return;
      this._touch = null;
      if (current.direction !== 'horizontal') return;
      const threshold = current.startedOpen ? 1 - THRESHOLD : THRESHOLD;
      this.settle(-this._offset > this.data.rightWidth * threshold, true);
    },
    cancelDrag() {
      const current = this._touch;
      this._touch = null;
      this._suppressTap = true;
      if (current) this.settle(current.startedOpen, false);
    },
    onCellTap() {
      if (this._suppressTap) {
        this._suppressTap = false;
        return;
      }
      const wasOpen = this._opened;
      if (wasOpen) this.settle(false, true);
      this.triggerEvent('cellclick', { wasOpen });
    },
  },
});
