# 微信小程序

独立、可选的 Taro/React 客户端，共用根需求、架构、API 契约和交付流程。Web 不需要安装或启动本目录。技术决策见 [技术基线](../docs/engineering/miniprogram/architecture/technology-options.md)，开发规则见 [专项导航](../docs/engineering/miniprogram/README.md)；本端 [design/](design/README.md) 拥有设计稿、视觉规范、Token 架构与设计交接。

## 本地开发

Node 22、pnpm 10.33.0。微信开发者工具运行在 Windows/macOS，源码和 Watch 编译进程尽量位于同一文件系统。

```bash
cd miniprogram
pnpm install --frozen-lockfile
cp .env.example .env.development.local
pnpm dev:weapp
```

开发者工具导入 **miniprogram 目录**，`project.config.json` 的 `miniprogramRoot` 已指向 `dist/`。首次编译完成后再查看模拟器。`touristappid` 仅供受限本地预览；真实登录、媒体权限、真机和上传验证必须换成自己的 AppID。AppID 不是 AppSecret；真实账号配置仅在本地维护，不向仓库提交私人配置。

保存 TSX/SCSS → Taro Watch 增量编译 → 开发者工具检测产物并刷新。不承诺跨页面/组件状态保留；工程配置、依赖或环境变量变化后重启 Watch。共享配色变化需运行 `pnpm tokens`，它不由 Taro 的源码监听自动触发。没有 H5 代理，也不运行浏览器开发服务器。

Webpack 关闭依赖预打包（`compiler.prebundle.enable: false`），开发与生产均使用普通打包，避免开发者工具跨 WSL 读取 `prebundle` 分块时出现失效文件引用；源码 Watch 仍然启用。

WSL2 中的源码与 Windows 开发者工具跨文件系统时，需要实际确认文件访问与刷新；不稳定时，将整个业务工作区放到 Windows 可访问路径并用 Windows Node/pnpm 编译，不在两个位置维护手工同步的源码副本。

## 后端连接

`TARO_APP_API_BASE_URL` 是后端 **origin**，例如开发使用 `http://127.0.0.1:8000`，不附加 `/api/v1`。空值允许离线查看基础页面，网络功能明确显示未配置。生产配置要求 HTTPS；未配置的生产构建只用于工程验证，不应作为联网产品发布。

小程序不直接调用 `ai-service`。Backend/AI 凭据、AppSecret 与数据库连接绝不放入客户端环境变量。模拟器的 localhost 与真机不是同一设备：真机需可访问的 HTTPS 开发域名，配置小程序合法域名及服务网络。只为本地调试临时关闭开发工具域名检查，不修改模板默认 `urlCheck: true`，更不能当作线上配置。

首页、组件库、我的使用原生 TabBar；“我的”沿用 `pages/settings/index` 路由。首页搜索将关键词带入组件库，分类卡进入 `pages/demo/index` 对应的基础控件、内容与列表、状态与反馈、弹窗与弹层、手势交互分组；二级页面使用原生返回。系统设置位于 `pages/preferences/index`，提供外观偏好与账户操作。

首页最近使用、个人中心三项统计和目录组件数量为设计中的静态样例，不读取或写入用户历史。收藏、指南、社区、反馈等未接服务的入口显示原生说明；版本显示当前包版本，不模拟更新检查结果。导航对应关系：

| 入口                               | 目标                                   |
| ---------------------------------- | -------------------------------------- |
| 首页搜索 / 浏览组件库 / 查看全部   | 组件库 Tab；搜索词只传递一次           |
| 表单输入 / 按钮类 / 导航类         | 基础控件演示的相应区块                 |
| 数据展示 / 首页列表与卡片样例      | 内容与列表演示                         |
| 反馈与提示 / 弹窗与弹层 / 手势交互 | 对应的独立演示分组                     |
| 我的头像与账户按钮                 | 未登录进入账户登录，已登录进入系统设置 |
| 我的 → 系统设置                    | 外观与账户操作                         |
| 账户登录成功                       | 返回来源页，无返回栈时回到“我的” Tab   |

弹窗演示提供原生对话框、动作面板和整页底部弹层，筛选只有确认应用后更新列表。手势演示提供三条侧滑数据和四条拖动排序数据；侧滑支持详情、收藏、删除、点击外部关闭，拖动支持取消恢复与重置。示例状态仅保留在当前页面，不写入账户收藏或服务端。

侧滑的原生组件位于 `src/features/component-library/native/swipe-cell`，通过页面 `usingComponents` 和 Taro `Slot` 接入。它参考 [Vant Weapp SwipeCell](https://github.com/youzan/vant-weapp/tree/dev/packages/swipe-cell) 的方向锁定、开合阈值与单层位移，触点移动只更新当前原生组件，React 接收开始和开合事件；授权随源码和产物保留。拖动排序在 16ms 窗口内合并触点更新，松手直接结算最终顺序。

账户登录消费当前 Backend 的用户名密码接口；先在 Backend 注册测试账户。`requestWeChatLoginCode()` 只获取一次性 code，不等于已完成微信登录。微信身份交换、账户绑定、上传业务接口仍需产品需求和服务端契约。

## 检查与构建

```bash
pnpm check          # 生成物漂移、类型、Lint、单测与格式
pnpm build:weapp    # 生成契约/颜色/图标，生产编译到 dist
pnpm check:dist     # 检查微信产物、页面、原生导航、两主题图标
```

根目录有 `make install-miniprogram / dev-miniprogram / check-miniprogram / build-miniprogram`。现有 `make install / check / up` 保持原含义，均不强制加入小程序；小程序 CI 按路径触发，独立 frozen-lockfile 安装。

类型来源为根 `docs/contracts/generated/backend.openapi.json`。Provider 变化后先在根执行 `make contracts`，再 `pnpm contracts`；不要编辑 `schema.generated.ts`。颜色变化用 `pnpm tokens`，同时更新同源 TabBar 图标；完整重生成用 `pnpm generate`。页面图标与 TabBar 共用本地 Lucide 线条来源：`scripts/icon-shapes.json` 保存向量，`icon-masks.json` 为离线栅格遮罩，授权见 `scripts/lucide-LICENSE`。修改形状后用 `node scripts/generate-icon-masks.mjs <已安装的 sharp 模块路径>` 生成遮罩，再执行 `pnpm tokens`；日常颜色同步无需 sharp。页面图标通过 `copy.patterns` 复制入包，不依赖微信 SVG 或远程字体支持。

图标形状、主题映射与生成物归属见 [移动 Token](design/tokens.md)，不要手工改生成 PNG 的颜色。

单测使用显式 Taro mock，构建检查只证明产物结构。原生导航/胶囊、触控、输入键盘、安全区、选图隐私授权、真实登录、断网恢复与 iOS/Android 真机体验，按 [运行验收](../docs/engineering/miniprogram/guides/runtime-and-verification.md) 单独记录，不能由 mock、编译成功或代码截图替代。模板不包含微信上传/发布凭据，也不会自动发布。
