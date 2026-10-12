# React Native

先确认目标包是 RN/Expo 而非 React DOM，读取现有路由、组件库及样式方案。使用真实原生组件 API、平台语义 Token 和项目依赖；禁止默认输出 div、CSS 文件、DOM API，禁止用 WebView 绕过原生页面实现。

保留业务和数据层；检查安全区、键盘避让、滚动/列表、可触达点击区域、字体缩放、图片及加载/空/失败状态。设计像素和 RN 逻辑尺寸不可机械照搬倍率。已确认平台规范优先，页面布局按授权还原，差异记录清楚。

仅确有平台差异时用 Platform 或 `.ios/.android` 文件，不把每个控件拆两份。Web、iOS、Android 可共享页面语义但分别记录运行证据；RN Web 的浏览器截图不代表原生验证。

代码检查运行项目已有命令；原生验证读 design-qa/references/native.md，复用已安装 runner。无设备/模拟器就明确 not_run，不用源码断言、fixture 或 Web 截图冒充原生通过。

官方：
- https://reactnative.dev/docs/platform-specific-code
- https://reactnative.dev/docs/height-and-width
