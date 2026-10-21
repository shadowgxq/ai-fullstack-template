# 微信小程序设计规范与资产

适用于 `miniprogram/` 的微信宿主，不是手机 Web 或 React Native 的通用规范。任务从 [小程序协作入口](../AGENTS.md) 和 [专项导航](../../docs/engineering/miniprogram/README.md#任务路径) 进入，只读取受影响范围。

## 规则归属

| 内容 | 唯一正文 |
|---|---|
| 移动布局、触控、导航与宿主 | [UI 规范](ui-spec.md) |
| 三层 Token、独立几何和原生主题生成 | [Token 架构](tokens.md) |
| 当前设计范围、Frame、素材与接受边界 | [设计交接](design-handoff.md) |
| 跨端配色与共同交付接口 | [共享配色](../../docs/design/tokens.md)、[共同交付约定](../../docs/design/design-handoff.md) |
| 组件与源码能力 | [本端组件清单](../../docs/engineering/miniprogram/components/component-inventory.md)；API 以实际源码为准 |
| 运行与真实交互验证 | [运行验收](../../docs/engineering/miniprogram/guides/runtime-and-verification.md) |

## 资产登记

| 资产 | 用途 |
|---|---|
| [mobile.lib.pen](mobile.lib.pen) | 微信小程序设计库、模板页面与基础组件示例；实际内容以当前源稿回读为准 |
| [images/](images/) | 设计稿直接引用的独立素材；与 Pen 保持同级相对路径，不是运行时资源目录 |
| [previews/mobile-reference-c/](previews/mobile-reference-c/) | 已登记的参考 C 导出图与局部/三屏对照；不代替当前源稿 |
| [previews/mobile-light-native/](previews/mobile-light-native/)、[previews/mobile-template/](previews/mobile-template/) | 保留的先前预览，不作为当前实现的默认基线 |

公共库与业务消费稿按实际职责维护；业务消费稿只在出现真实需求时建立并正式导入公共库，不为每项任务新建一份设计文件。设计变量、Frame ID、主题和覆盖在使用前回读，旧截图不能证明当前源稿或运行时代码一致。

品牌共享不等于几何或组件共享，不因 Web 已存在某个控件就自动纳入小程序。设计样例与已实现业务、公开 API、人工接受分别登记；执行过程和验证证据归根 PR/change，不复制一套端内任务状态。

工程规范仍归 `docs/engineering/miniprogram/`。产品需求、系统架构、API 契约、Manager 和 OpenSpec 仍由仓库根统一维护；本目录仅拥有小程序专属设计。
