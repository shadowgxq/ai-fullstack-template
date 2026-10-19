/** 配置只在 Node 构建阶段校验，不向小程序引入浏览器 URL 或服务密钥。 */
export function normalizeApiBaseUrl(value: string | undefined, production: boolean): string {
  if (!value?.trim()) return '';
  const url = new URL(value.trim());
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
    throw new Error('TARO_APP_API_BASE_URL 必须是无凭据的 HTTP(S) 地址');
  }
  if (url.pathname !== '/' || url.search || url.hash) {
    throw new Error('TARO_APP_API_BASE_URL 只配置 origin，不包含 API 路径、查询或片段');
  }
  if (production && url.protocol !== 'https:') {
    throw new Error('生产构建的 TARO_APP_API_BASE_URL 必须使用 HTTPS');
  }
  return url.origin;
}
