/** 与当前服务端边界对齐；用户名不 trim，避免改变账户身份。 */
export function validateCredentials(
  username: string,
  password: string,
): { username?: string; password?: string } {
  const errors: { username?: string; password?: string } = {};
  if (!username || Array.from(username).length > 50) errors.username = '用户名长度应为 1–50 个字符';
  // 使用 Unicode code point 计算 UTF-8 字节数，不依赖宿主 TextEncoder。
  let bytes = 0;
  let invalidUnicode = false;
  for (const char of password) {
    const code = char.codePointAt(0)!;
    if (code >= 0xd800 && code <= 0xdfff) invalidUnicode = true;
    bytes += code <= 0x7f ? 1 : code <= 0x7ff ? 2 : code <= 0xffff ? 3 : 4;
  }
  if (!password || bytes > 72 || invalidUnicode)
    errors.password = '密码不能为空，且 UTF-8 长度不能超过 72 字节';
  return errors;
}
