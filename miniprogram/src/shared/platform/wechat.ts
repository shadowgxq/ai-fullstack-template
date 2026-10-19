import Taro from '@tarojs/taro';

/** code 只交给受信后端；这不是完整登录，也不在客户端持有 AppSecret。 */
export async function requestWeChatLoginCode(): Promise<string> {
  const result = await Taro.login();
  if (!result.code) throw new Error('未获取到微信登录凭证，请重试');
  return result.code;
}

export async function chooseImage(): Promise<string | null> {
  try {
    const result = await Taro.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
    });
    const path = result.tempFiles[0]?.tempFilePath;
    if (!path) throw new Error('未获取到图片，请重新选择');
    return path;
  } catch (error) {
    const message =
      error && typeof error === 'object' && 'errMsg' in error ? String(error.errMsg) : '';
    if (/cancel/i.test(message)) return null;
    throw new Error('无法选择图片，请检查授权后重试');
  }
}

/** 本地选择不等于上传；业务确定上传契约后再由功能层调用 uploadFile。 */
export async function uploadImage(options: {
  url: string;
  filePath: string;
  name: string;
  header?: Record<string, string>;
}): Promise<unknown> {
  if (!/^https:\/\//.test(options.url)) throw new Error('上传地址必须使用 HTTPS');
  const response = await Taro.uploadFile({ ...options, timeout: 30000 });
  if (response.statusCode < 200 || response.statusCode >= 300)
    throw new Error('图片上传失败，请重试');
  try {
    return JSON.parse(response.data);
  } catch {
    throw new Error('上传响应格式不正确');
  }
}
