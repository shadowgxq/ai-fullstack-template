# 个人资料实现

## Context

范围见 [proposal](proposal.md)，消费 `623e964` 的[账户与资料方案](../../../docs/architecture/wardrobe/features/account-and-profile.md)及[衣物媒体 §3](../../../docs/architecture/wardrobe/features/wardrobe.md#3-图片上传与访问)。`wear-history` 已 code-verified，个人内容可以消费真实衣物/历史。当前 GET profile 只有可选资料字段、没有版本或 PATCH；avatar 上传的服务端用途已可用，但小程序上传/decoder 固定 garment。现有资料默认创建、账户锁、私有下载与退出机制均复用。

## Goals / Non-Goals

**Goals:** 将个人内容与独立设置接入真实资料/历史，资料并发、媒体绑定与会话边界一致。

**Non-Goals:** 不自动取得头像昵称，不新增手机号/时区/注销；偏好及有效城市写入归其对应 Change，当前 PATCH 不接收无法验证的 city_id。不重复实现衣柜/历史或持久化另一份资料。

## Decisions

### 数据与 API

- `user_profiles` 增加正整数 `version`，新旧资料初始1；GET/PATCH 的 ProfileResponse 统一加 version。nickname/avatar/city 原字段保留，城市当前只读。ProfilePatch 仅 `expected_version`（strict int≥1）、可选 nickname 与 avatar_media_id，extra forbid；missing 保持，null 清除，昵称 trim 空白归 null、最长80字符。
- `ProfileService(repo,revisions,media)` 复用同一 Session，transaction → account revision锁 → profile按user_id锁且refresh → version校验 → 新avatar按owner锁并校验purpose/status → 更新/version++ → commit。资料不改变 inventory/history revision，不访问文件系统或建立资料Redis缓存。
- 头像只用本人 ready/用途avatar媒体。清理器已有账户锁和真实profile引用保护；替换/清除不删除旧文件，旧未引用文件按既有24h清理。保留此策略避免扩大媒体保留范围或添加跨系统事务。
- PATCH 返回完整本人资料；401/404/409/422沿业务契约。city_id/timezone/phone/owner不接受，后续city-weather只在定义有效ID校验后扩展同一PATCH。缺失profile不静默补造，旧账户由已验证迁移与本次版本回填保证。

### 客户端与平台

- 复用 shared gateway 的 GET profile/decoder，增加 PATCH 消费；同步 version 到直接登录/默认资料消费者和测试，不维护第二个Profile DTO。媒体上传统一支持显式 garment/avatar 用途并校验匹配响应，更新原garment调用与测试；不复制另一套上传/私有缓存实现。
- 资料草稿固定开始编辑时版本；平台 chooseAvatar 取得临时图片后走认证avatar上传，nickname 使用真实小程序填写能力，取消不变，失败保留字段/文件/上传键。未知 PATCH 结果先读取本人资料核对，冲突保留草稿；每个 await 后检查会话和卸载/取消，避免旧回包/导航干扰。
- 个人页使用默认资料及真实衣物/历史内容 Tab，按原业务模块抽取必要展示出口复用；不复制另一份事实/查询。示例数量不是产品数据，未取得全量时不显示误导总数。设置为独立路由，从个人齿轮进入；公共宿主个人入口指向该真实个人页。
- 当前仅接通已完成的资料/退出入口；偏好、城市入口随其Change真实接线，不指向模板偏好或假页面。保留模板辅助路由与已验证会话退出函数，业务退出按捕获会话清理/反馈，切号后不执行旧导航。

## UI 实现依据

消费[设计交付：微信登录与个人](../../../miniprogram/design/wardrobe-ui-ux.md#微信登录与个人)及[业务 UI](../../../miniprogram/design/wardrobe-ui-spec.md)。当前 MCP 依据为个人 `QL83M/JGka6`、已登录空态 `q5sgBH`、设置 `fkIRs/XzsEz` 与独立资料页 `LgGyr`；衣物复用 `zkPuC`、历史复用 `C0p2tC`、空态复用 `SKORD`。资料入口进入 `pages/profile-edit/index`，沿用同一资料版本/媒体/会话边界；保存成功后的返回失败只重试导航。当前原生读取、快照与代码检查见 [M1–M3 对齐记录](../outfit-recommendations/verify-report.md#2026-10-23-m1m3-当前设计对齐)。

平台属性以真实 Taro API 为准，不把 Web props 当可用能力。源稿只读；字体资源和独立库源同步尚未取得严格绑定证据，宿主与实现视觉均不以设计导出图或静态代码检查代替。

## Risks / Trade-offs

- [头像文件已上传但资料未提交] → 保留同次上传身份，绑定失败可重试，未引用文件走现有清理。
- [绑定与清理竞争/版本写失败] → 同一账户锁与短事务、真实PG/临时文件检查，失败不改变版本和引用。
- [新version影响默认资料解码] → 统一生成契约并更新真实直接消费者与相邻回归；不加缺省兼容绕过版本。
- [与统计共享装配/路由/生成类型] → 统计稳定检查与审查完成后串行启动本项共享写入，不让未完成迁移干扰统计测试。

## Migration Plan

仅增加 profile version 与正数约束，基于当前实际 head 在隔离PG autogenerate、回填并验证旧账户/旧资料保留；不因当前头像字段无FK而额外引入未验证的数据清理。Backend执行者独占本项迁移/装配，客户端消费协调者生成类型。部署、真实权限/宿主操作另行验收，不自动清库/清卷回滚。
