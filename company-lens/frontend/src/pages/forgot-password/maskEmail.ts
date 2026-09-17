/**
 * 邮箱脱敏：demo@example.com → d***o@example.com。
 *
 * 本地部分不超过两个字符时只保留首字符（ab@x.com → a***@x.com）：
 * 再露尾字符就把整个本地部分交代干净了，等于没脱敏。
 * 结构不完整（没有 @、@ 在首尾）时原样返回，交给上游的邮箱校验去挡。
 */
export function maskEmail(email: string): string {
  const at = email.lastIndexOf('@');
  if (at <= 0 || at === email.length - 1) {
    return email;
  }

  const name = email.slice(0, at);
  const domain = email.slice(at + 1);
  const tail = name.length > 2 ? name.slice(-1) : '';

  return `${name.slice(0, 1)}***${tail}@${domain}`;
}
