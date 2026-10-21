export interface TouchPoint {
  clientX: number;
  clientY: number;
}

/** View 的事件声明未带触点字段，在宿主边界检查实际原生触点。 */
export function readTouchPoint(
  event: unknown,
  key: 'touches' | 'changedTouches',
): TouchPoint | null {
  if (!event || typeof event !== 'object' || !(key in event)) return null;
  const touches: unknown = Reflect.get(event, key);
  if (!Array.isArray(touches)) return null;
  const point: unknown = touches[0];
  if (!point || typeof point !== 'object' || !('clientX' in point) || !('clientY' in point))
    return null;
  if (
    typeof point.clientX !== 'number' ||
    typeof point.clientY !== 'number' ||
    !Number.isFinite(point.clientX) ||
    !Number.isFinite(point.clientY)
  )
    return null;
  return { clientX: point.clientX, clientY: point.clientY };
}
