/** 小程序没有浏览器绘制循环；合并一个 16ms 窗口内的触点，只提交最后一项。 */
export function createGestureFrame<T>(publish: (value: T) => void) {
  let pending: { value: T } | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  const cancel = () => {
    if (timer !== null) clearTimeout(timer);
    timer = null;
    pending = null;
  };
  const flush = () => {
    if (timer !== null) clearTimeout(timer);
    timer = null;
    const current = pending;
    pending = null;
    if (current) publish(current.value);
  };
  return {
    queue(value: T) {
      pending = { value };
      if (timer === null) timer = setTimeout(flush, 16);
    },
    flush,
    cancel,
  };
}
