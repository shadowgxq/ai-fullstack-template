# 浏览器验收

针对本地可丢弃环境运行真实浏览器，不 mock 网络。范围：标准首页/组件/主题、light/dark 与 Signal/Neutral、语言持久化、Dialog 键盘、移动布局，以及当前 Backend 真实注册/登录/刷新/撤销会话。

```bash
make up-web
npm install --prefix .tools/browser --no-save playwright@1.63.0
.tools/browser/node_modules/.bin/playwright install chromium
NODE_PATH="$PWD/.tools/browser/node_modules" node scripts/browser_smoke.cjs
```

Linux CI 可为 install 增加 `--with-deps`；本机系统依赖安装需要操作者授权。工具不进入 frontend 依赖/lockfile；容器 CI 与本机浏览器依赖独立。

默认地址为 `http://127.0.0.1:8080`；只接受 loopback。结果/截图写 `manager/runtime/evidence/browser`，CI 上传供 review，不提交认证凭证或本地会话。失败继续其他独立用例，最终非零退出；该 smoke 不代替具体业务 E2E、生产性能/安全验收。
