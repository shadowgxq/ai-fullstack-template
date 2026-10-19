# 小程序开发规范

继承 [公共代码质量](../../common/code-quality.md)。本页只补 Taro、微信宿主和客户端状态规则；视觉与组件参数分别归 [移动 UI](../../../design/mobile/ui-spec.md)、[Token](../../../design/mobile/tokens.md) 和 [组件清单](../components/component-inventory.md)。

## 组件与页面

使用 `View / Text / Button / Input / Image` 或本端 shared/ui；不用 HTML 标签、DOM API、localStorage、React Router、浏览器 fetch 或 Web UI 导入。ESLint 检查这些明显跨平台误用。使用 React Hooks 的约束不变，但宿主页保留不等于 React 卸载，刷新/恢复使用 `useDidShow`，需要后台暂停的工作配合 `useDidHide`。

一个页面一个注册路径，普通页面 `navigateTo/navigateBack`，Tab 页面 `switchTab`。保持返回栈，不用统一 redirect 替代导航。大业务按实际包体和入口设计分包；不在模板先切出空分包。页面只组合 UI 与功能，不把所有业务塞入 shared。

公共控件保持可见状态：disabled/loading 阻止重复操作，失败保留输入并给出重试，文本自然换行。输入有独立 Label，placeholder 不是标签；不把浏览器 ARIA/焦点方法未经核实移植到小程序。

## API 与会话

API origin 由构建环境注入，解析相对路径；Bearer 只发送到受信 Backend，公共 health/login 不携带当前 Token。类型从 OpenAPI 生成，网络数据仍须运行时检查。HTTP、业务失败、解析失败、取消、网络错误分别处理，不用空数组、null 或默认成功遮盖异常。

请求超时 15 秒；Signal 取消底层任务，并忽略迟到回调。Taro 同时提供 Promise 与回调时要消费内部拒绝，避免处理了 fail 却仍出现未捕获异常。自动重试只归 QueryClient：读取的网络/5xx 最多一次，写操作不自动重试。后端已有幂等规则不能由前端 loading 替代。

Token 存储不属于加密保险箱。登录在存储成功后才切换内存；401 仅清除发出请求的匹配会话，旧请求不能清除新登录。清理会话要清除对应 Query 缓存，退出失败不能展示服务端已撤销。敏感 Token、密码、code、用户图片路径不写日志或 UI。只记忆偏好，不持久化用户 Query 缓存。

微信 code 仅交给受信后端交换，AppSecret 不下发。`chooseImage` 区分用户取消和拒绝授权；页面只能在用户操作后调用。选图不是上传；上传适配的返回 JSON 仍需由业务解析，2xx 不自动等于业务成功。业务提供受信上传地址/字段/凭据，禁止把本站 Bearer 附到任意第三方 URL。隐私声明、合法域名、文件大小/类型/内容校验与用户资源授权须随实际功能在后端和微信平台配置。

## 生命周期与状态所有权

组件局部状态就地维护；Zustand 只放跨页客户端状态，远端数据留在 Query。应用集中安装一份网络/主题监听并成对移除；网络事件比迟到的初始化快照优先，读网络状态失败不自动标记离线。

Query 的 `focusManager/onlineManager` 不会自动理解微信生命周期；本端通过 App show/hide 与微信网络事件接入。参考 [TanStack 非浏览器生命周期指南](https://tanstack.com/query/latest/docs/framework/react/react-native) 的管理器接口，具体微信实现以本端代码为准，不直接复制 React Native AppState。

CSS Modules 隔离组件样式，原生 page 与主题根类仅在 app.scss/Token 中定义。行内样式仅用于真实运行时测量，设备返回的 px 不再次转换 rpx；不引入 Tailwind 构建适配来复用 Web 类名。依赖与配置变化同时更新 README、锁文件、构建测试；跨端改动只补直接消费者。
