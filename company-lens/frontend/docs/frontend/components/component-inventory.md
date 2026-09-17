# 可复用组件索引

下表列当前源码中可优先查阅的组件，不维护容易过期的全量数量。组件存在不表示所有 props 或新服务行为已验证；使用前读取实际实现。

| 组件 | 职责 | 源码 |
|---|---|---|
| Button | 按钮与状态 | [Button](../../../src/shared/ui/Button/Button.tsx) |
| PageState | loading/empty/error 展示 | [PageState](../../../src/shared/ui/PageState/PageState.tsx) |
| MarkdownContent | Markdown/GFM 内容 | [MarkdownContent](../../../src/shared/ui/MarkdownContent/MarkdownContent.tsx) |
| BackToTop | 长页面返回顶部 | [BackToTop](../../../src/shared/ui/BackToTop/BackToTop.tsx) |
| SettingsMenu | 主题与语言入口 | [SettingsMenu](../../../src/shared/ui/SettingsMenu/SettingsMenu.tsx) |
| AccountMenu | 账号操作入口 | [AccountMenu](../../../src/shared/ui/AccountMenu/AccountMenu.tsx) |
| MarketSelect | 市场选择 | [MarketSelect](../../../src/entities/market/ui/MarketSelect/MarketSelect.tsx) |
| StructuredReportValue | 结构化报告值展示 | [StructuredReportValue](../../../src/entities/company-research/ui/StructuredReportValue/StructuredReportValue.tsx) |
| ResearchLaunchForm | 研究发起 | [ResearchLaunchForm](../../../src/features/research-launch/ui/ResearchLaunchForm/ResearchLaunchForm.tsx) |
| PreflightResolutionPanel / StockCandidateList | 歧义确认与候选选择 | [research-launch](../../../src/features/research-launch/ui/) |
| AuthForm / LoginModal / GoogleLoginButton | 认证交互 | [auth](../../../src/features/auth/ui/) |
| SaveReportToHistory / DeleteHistoryDialog | 保存与删除历史 | [保存](../../../src/features/save-report-to-history/ui/)、[删除](../../../src/features/research-history/ui/) |
| ShareDialog / SharePoster | 分享对话框与海报 | [share](../../../src/features/share/ui/ShareDialog/) |
| AppHeader / AppShell | 应用顶栏与页面壳 | [widgets](../../../src/widgets/) |

拆分和公共 API 规则见[组件规范](components.md)。旧 LoginHeader 记录已移除，以实际组件和路由为准。
