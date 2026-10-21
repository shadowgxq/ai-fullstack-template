# Web 设计交接

适用于 `frontend/` 的 React/Vite Web。通用来源记录、设计就绪、双主题表达、Pencil 操作和验证证据遵循 [共同交付约定](../../docs/design/design-handoff.md)，本页只补充 Web 参数。任务选择见 [前端导航](../../docs/engineering/frontend/README.md#任务路径)，当前设计库与预览见 [资产登记](README.md#资产登记)。

## Web 组件与 Token

按 [组件治理](../../docs/engineering/frontend/components/components.md) 选择；[组件清单](../../docs/engineering/frontend/components/component-inventory.md) 只负责发现/可见性，实际 import 必须核对 export、类型与必要调用点。Pen 变体、模式和 Frame 不要求逐一生成 React 组件。

交接区分设计当前所在文件、目标归属和实际代码入口；按 [公共层准入](../../docs/engineering/frontend/components/components.md#公共层准入) 判断，不从 `shared/ui` 路径、跨页使用或外观直接推定公共归属。公共库集中维护公共控件与模板共用能力；使用方的实际业务组合在本端业务消费稿中演进，不为设计归属调整创建对应 React 包装或搬迁源码。

主组件、用法示例与实际页面按 [维护单元](../../docs/engineering/frontend/components/components.md#主组件用法与页面) 区分。公共稿可用 Label + Input 或内容 Skeleton 解释用法；需要展示模板页面时，使用 Examples 普通 Frame。使用方的真实业务流程与页面在自己的消费稿中表达。交接不把控件所在的展示板或组件目录分类当作公共准入证据。

归属同步须在设计修改获授权后执行：先核对主组件与直接实例依赖，再在实际归属文件中承接并更新引用；模板共用设计在公共库集中维护，公共库不能反向引用使用方的业务消费稿。同步后回读导入、主题、实例覆盖和受影响画面，再更新清单中的实际位置；规范中的目标归属不代表节点已经迁移。

Token 按 [选择政策](tokens.md) 使用，运行时定义在 [global.css](../src/shared/styles/global.css)；设计与代码的对应关系见 [同步约定](tokens.md#设计与代码同步)。交接记录设计节点/角色 → 实际组件或组合 → API/语义 Token → 主题和适配。支持属性用真实绑定，解析值及 `metadata.token-map` 单独记录限制。

设计默认 sans 为 Inter，技术参数使用 IBM Plex Mono；Web 以相同字体为首选，并保留系统与中文 fallback。字体接线在主题指南维护；fallback 不代表跨系统字形完全一致，也不证明运行时字体已加载。

基础 Button 和菜单项使用最小高度、Token Padding 与自然换行；纯图标按钮保持方形尺寸。设计稿表达默认几何和允许的内容增长，字体放大、触控几何及必要边界仍按真实消费者核验，规范要求不等于浏览器验收已完成。组件尺寸读取实际节点；设计 opacity 百分数在 CSS 中转换为比例，`token-map` 仅帮助定位，不冒充自动联动。

## Web 布局与宿主

应用标题、导航、设置与账户由 AppHeader / AppShell 承担；页面负责自己的内容。当前 AppShell 的 props 和路由用法需核对源码；不能按手机稿统一删除应用顶栏。系统时间、电池和浏览器 chrome 不重绘。

模板示例只组合已有能力：LoginModal 是当前页面上的认证浮层，`/login` 重定向并打开它；ShareDialog 消费调用方提供的 poster，窄屏可采用实际实现的底部浮层。不可把画布中的反馈当作真实请求或浏览器能力证明。

认证设计在 `core.lib.pen` 的 `bzlJA` 维护，展示可选的邮箱验证码、双方式登录与邮箱注册；字段组合公共 Label / Input，浮层复用 Dialog。该展示不改变默认生产能力开关，当前设计覆盖见 [组件清单](../../docs/engineering/frontend/components/component-inventory.md#pencil-定位与映射)。认证字段、操作、切换和记住我使用认证节点的 `font-size-lg` 与行高覆盖；辅助说明和请求反馈使用各自的文字角色。认证卡片及浮层底部的文字按钮使用 `primary`，hover 使用 `primary-hover`；保持普通文字的 `foreground`。认证源码仍由 `features/auth` 拥有。

比较时固定主题、状态、平台、逻辑尺寸与已批准适配，注明整页、内容区和宿主边界；不裁剪隐藏重复顶栏、缺失区块或溢出。

本端稿不证明微信移动设计或绑定已完成。微信原生导航、TabBar、安全区和触控几何只在 [小程序设计](../../miniprogram/design/README.md) 维护，不从本页推导。
