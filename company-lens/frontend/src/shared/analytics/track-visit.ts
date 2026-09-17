import { request } from '../api';

/** 本机「今日已上报」标记 key（按天本地去重，减少无谓请求；真正去重由后端主键保证）。 */
const LAST_VISIT_KEY = 'sa.uv.lastVisitDate';

/** 本地日期 YYYY-MM-DD（用本地时区，贴合用户「一天」的直觉）。 */
function todayLocal(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

/**
 * 记录一次访问用于 UV 统计。
 * - 每设备每天最多上报一次（localStorage 本地去重）。
 * - fire-and-forget：失败静默，绝不阻塞或影响页面渲染。
 * - 上报成功后才写「今日已报」标记；失败则下次进入重试。
 * - 设备标识由 requestClient 的 X-Device-Id 拦截器自动携带，无需入参。
 */
export function trackVisit(): void {
  try {
    const today = todayLocal();
    if (localStorage.getItem(LAST_VISIT_KEY) === today) {
      return;
    }
    void request({ method: 'POST', url: '/v1/analytics/visit' })
      .then(() => {
        try {
          localStorage.setItem(LAST_VISIT_KEY, today);
        } catch {
          /* localStorage 写入失败可忽略：至多多上报几次，后端仍按天去重 */
        }
      })
      .catch(() => {
        /* 上报失败不标记，下次进入自动重试；不影响用户 */
      });
  } catch {
    /* localStorage 不可用等异常一律忽略 */
  }
}
