# 账户密码体系：后端接口缺口与契约请求

> 历史参考：仅描述复制代码对应的旧服务；当前接口以 [接入入口](README.md) 链接的新合同为准。

> 日期：2026-08-05
> 背景：产品拍板以需求底稿（chushixuq.md）为准恢复密码体系，见 `specs/proposals/需求文档.md` 18.4/18.5 与 18.7。
> 状态更新（2026-08-05 同日）：产品拍板后端一并补齐，本文从「请求」转为「契约记录」。
> 三个接口已实现并通过集成测试，前端 api 数据源已接线（auth.api.ts）。
> 实现选型：password-login 采用方案 2a（同一路径双形态兼容，email=C 端、username=管理员）；
> 注册**要求邮箱验证码**（底稿 18.4 未列，同日产品拍板补上，理由见第 1 节）；
> 重置确认路径为 POST /api/v1/account/password-reset/confirm。

## 现状盘点（后端已有 / 缺失）

已有，可直接复用：

- `VerificationScene` 枚举已含 `RESET_PASSWORD("reset_password")`，且
  `POST /api/v1/account/email-code/send` 的 `fromValue` 归一化后能命中它——
  **发送找回验证码今天就能走通**，缺的只是消费端与专用邮件模板。
- `SysUser` 已有 `username` / `password`（BCrypt）/ `email` / `role`；`PasswordEncoder`
  与邮件发送基础设施在用。
- 存量 C 端用户的 `password` 为建号时的随机 UUID 摘要——即「无可用密码」，
  需经找回流程设置首个密码。

缺失（本文请求的三个接口）：

## 1. 邮箱密码注册

```
POST /api/v1/account/register
请求  { "email": string, "code": string, "password": string }
响应  LoginResponse（与 email-code/login 同构：token/expiresIn/newUser/user）
```

- 注册成功即签发会话（需求 18.4「自动登录」），`newUser` 恒为 true。
- 邮箱已存在（含验证码/Google 建的号）→ 业务错误码 `EMAIL_ALREADY_REGISTERED`。
  不建议此处做「已存在则视为登录」——那会把注册表单变成变相的密码探测器。
- 已定（2026-08-05）：要求邮箱验证。`code` 沿用 email-code/send（scene=REGISTER，
  归一化到 login_register 池）。校验顺序为先验码再查重：封占号（pre-hijack），
  同时让 EMAIL_ALREADY_REGISTERED 只对邮箱主人可见，注册不构成枚举口子。
- 密码规则请在契约中给出（前端暂按 ≥8 位做本地校验，以后端为准同步）。

## 2. C 端邮箱密码登录

```
POST /api/v1/account/password-login（扩展现有）或新路径（后端定）
请求  { "email": string, "password": string }
响应  LoginResponse
```

- 现有 `password-login` 收 `username` 且非管理员一律 403（`PASSWORD_LOGIN_ADMIN_ONLY`），
  与本需求不是同一能力。可选择：a) 扩展现有接口同时接受 email 并放开普通用户；
  b) 新开 C 端专用路径，管理员接口保持不动。前端不预设，按契约接。
- 失败统一 `INVALID_CREDENTIALS`（不区分「邮箱不存在/密码错」，防枚举）。
- 存量随机 UUID 密码不可能被命中，天然安全；无需数据迁移。

## 3. 重置密码（找回三段式的确认步）

```
POST /api/v1/account/password-reset/confirm（命名后端定）
请求  { "email": string, "code": string, "newPassword": string }
响应  成功无 data
```

- `code` 即 `email-code/send`（scene=RESET_PASSWORD）发出的验证码；请校验场景匹配、
  未过期、一次性失效。
- 邮箱未注册时建议与成功同响应（防枚举；发送侧文案已按「如果该邮箱已注册」措辞）。
- 错误码：`INVALID_CODE`（验证码错/过期）。
- 请为 RESET_PASSWORD 场景补一份专用邮件模板（现在会用登录注册的通用文案）。

## 前端接线现状（2026-08-05 已全部落地）

| 前端调用 | 现状 |
| --- | --- |
| `authGateway.register` | 已接 POST /account/register（409→已注册、400→验证码/密码不合规） |
| `authGateway.passwordLogin` | 已接 POST /account/password-login 的 email 形态（401→凭据错） |
| `authGateway.resetPassword` | 已接 POST /account/password-reset/confirm（400→验证码错） |
| `sendEmailCode({scene:'RESET_PASSWORD'})` | 直连现有 email-code/send，可工作 |

`CONTRACT_UNAVAILABLE` 机制（见 auth.gateway.ts）保留为仓库通用模式，本轮结束时已无调用方。

## 不在本次范围

- 修改用户名（底稿未列；C 端 username 由邮箱前缀自动派生，本人并不知道）。
- 管理员 password-login 的任何改动（除 2a 方案本身带来的路径共用）。

## 后续可能需要后端补的一件事

「修改密码」复用了找回链路（登录态进入 /forgot-password），因此没有新增接口。但
`password-reset/confirm` **不失效已签发的 token**——用户改完密码，其它设备上已登录的
会话仍然有效。若产品要求「改密码即踢下线其它设备」，需后端提供会话失效能力
（如按 userId 递增 token 版本号并在鉴权时比对）。
