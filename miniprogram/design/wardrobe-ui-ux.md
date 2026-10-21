# 智能衣柜 V1 设计交付

## 范围与来源

需求来源为 [PRD V1.2](../../docs/product/01-prd-draft.md)，目标为微信小程序。当前覆盖 FR-001～FR-006 的业务页面及必要局部。白底、深蓝文字、青绿色主色和整体样式方向已确认；添加衣物、个人页、微信登录及小程序宿主适配为本次修订，待用户验收。

可编辑来源为 [wardrobe.pen](wardrobe.pen)，通过别名 `z` 导入 [公共库](../../frontend/design/core.lib.pen)。业务组合在消费稿内维护，公共库未修改。实现目标为仓库现有 `miniprogram/` 工程，采用 Taro + React + TypeScript；`frontend/` 保留 Web 模板。小程序基础工程已存在，智能衣柜业务页面与后端接线尚未实现。

## 样式与宿主

布局、字号、触控、底部操作和安全区规则唯一维护在 [业务移动 UI](wardrobe-ui-spec.md#布局与宿主)，通用移动规则见 [移动 UI](ui-spec.md)，颜色与主题来源见 [移动 Token](tokens.md)。主画布为 390 × 844 逻辑 px，左右留边 16px；Light/Dark 共用结构，不另做 PC 页面。

导航标题为 20px，主页面左侧提供个人入口，子页面提供返回，右侧预留微信系统胶囊。状态栏 44px、胶囊 88 × 32px、底部安全区 24px 均为设备展示尺寸，不能写成运行时常量；系统层不由业务重绘。微信宿主信息可通过 [官方 API 定义](https://github.com/wechat-miniprogram/api-typings/blob/master/types/wx/lib.wx.api.d.ts) 中的窗口和胶囊信息能力取得，实际端适配仍待实现。

每个页面视口引用唯一完整内容源，中间滚动与固定操作区分开；长内容保留在完整源中，不以缩小字号或删字段适配首屏。穿搭主操作高 50px，添加衣物主操作 52px，表单控件 48px、圆角 12px，为业务覆盖。三 Tab 为衣柜、穿搭、记录；统计归记录，个人是二级页。

## 页面定位

预览目录为 `previews/wardrobe/light/`、`previews/wardrobe/dark/`，同名 ID 对应同一源节点的主题渲染。

| 页面 | 视口 / 唯一完整内容源 | Light 预览 |
| --- | --- | --- |
| 今日穿搭 | `P9tls` / `ZHXw9` | [穿搭](previews/wardrobe/light/P9tls.png) |
| 我的衣柜 | `ddC69` / `zkPuC` | [衣柜](previews/wardrobe/light/ddC69.png) |
| 衣物详情 | `WV7wn` / `StjQC` | [详情](previews/wardrobe/light/WV7wn.png) |
| 添加/编辑衣物 | `Ro2vL` / `FfxoI` | [基础表单](previews/wardrobe/light/Ro2vL.png) |
| 已有照片与属性展开 | `jxBYZ` / 同一 `FfxoI` | [展开示例](previews/wardrobe/light/jxBYZ.png) |
| 衣物更多属性 | `Y8xJCl`，由 `TgbKZ` 引用 | [完整展开内容](previews/wardrobe/light/Y8xJCl.png) |
| 穿着记录 | `HI38Z` / `C0p2tC` | [历史](previews/wardrobe/light/HI38Z.png) |
| 确认/补录/修正穿着 | `tz4GK` / `RYACG` | [记录表单](previews/wardrobe/light/tz4GK.png) |
| 衣柜统计 | `ywaWl` / `a7xEg` | [统计](previews/wardrobe/light/ywaWl.png) |
| 穿搭偏好 | `OgxoN` / `Z8EEvN` | [偏好](previews/wardrobe/light/OgxoN.png) |
| 个人 | `QL83M` / `JGka6` | [个人](previews/wardrobe/light/QL83M.png) |
| 微信登录 | `asaVm` | [登录](previews/wardrobe/light/asaVm.png) |

`jxBYZ` 仅用同一表单内容源的实例覆盖表达照片已选择和属性已展开，不维护第二套字段。照片示例使用既有 `images/generated*.png`，候选使用 `images/pants-black.png`、`images/pants-khaki.png`；库存数量、天气、图片和选择值均为示例，不替代数据契约。

## 关键局部

| 入口与用途 | Frame | Light 预览 |
| --- | --- | --- |
| 当次推荐场景 | `Q3U4y` | [场景](previews/wardrobe/light/Q3U4y.png) |
| 推荐中的单品替换 | `AvD3c` | [替换单品](previews/wardrobe/light/AvD3c.png) |
| 城市与定位 | `NLCY6` | [城市](previews/wardrobe/light/NLCY6.png) |
| 实际穿着衣物多选 | `mKPcR` | [选择穿着衣物](previews/wardrobe/light/mKPcR.png) |
| 衣物分类 | `phKmP` | [分类](previews/wardrobe/light/phKmP.png) |
| 更多颜色 | `zXmjy` | [颜色](previews/wardrobe/light/zXmjy.png) |
| 自定义标签 | `kopCO` | [标签](previews/wardrobe/light/kopCO.png) |
| 个人资料 | `LgGyr` | [资料](previews/wardrobe/light/LgGyr.png) |
| 删除误记录/归档的确认结构 | `m0rZ7` | [确认](previews/wardrobe/light/m0rZ7.png) |
| 空数据共用结构 | `SKORD` | [空态](previews/wardrobe/light/SKORD.png) |

## 交互及状态

### 添加与编辑衣物

基础字段按照片、名称、分类、主要颜色排列；更多属性默认收起，包含季节、场合、标签与备注，收起不清空内容。未填写时不默认选中季节、颜色或场合；展开示例中的春秋等为已填数据。

拍照和相册分别触发对应媒体来源；当前画面以单张主照片演示，已选后支持移除、重新拍照或从相册更换。参考图中的“最多 5 张”未作为产品限制。取消选择不改变原照片；失败保留名称及其他输入，不暗示自动识别。

照片或名称至少一项，规则引用 FR-001。点击添加时若两者均缺失，在照片/名称附近显示“请添加照片或填写衣物名称”，保留其他字段并引导补充；上传未成功不能视作已有有效照片。提交 pending 防重，失败保留输入并可重试，成功回衣柜显示新衣物。通用错误/加载表达复用 [移动状态规则](ui-spec.md#组件交互与状态) 及小程序端 Notice、StatePanel，不逐状态复制整页。

分类触发器打开 `phKmP`，选择后回填并关闭；清除分类回未知，关闭不选择保持原值。颜色为单选，快捷色块和 `zXmjy` 使用同一当前值，选中有勾选和名称，支持清除。季节、场合及标签为多选，再次点击取消；自定义标签弹层仅更新待保存表单，空白文本不能添加，重复标签不重复加入。图中选项为示例，不把列表数量当成已确认枚举。

底部“添加到衣柜”独立于滚动区域，滚动区可到达最后一个字段及说明；底部安全区不占按钮命中区域。键盘出现时收起固定操作区，焦点字段保持可见，收键盘后恢复。静态设计仅表达分区，真实键盘/滚动行为待端上验证。

编辑复用同一表单，带入已保存值，标题为“编辑衣物”，动作“保存修改”，更新当前对象；同样满足照片或名称至少一项。新衣物默认可穿，状态在详情管理，不要求首次逐项填写档案。

### 微信登录与个人

登录页仅提供“微信登录”，无密码、注册表单或强制手机号。点击后显示登录中；成功进入对应微信身份的衣柜，失败可重试，返回不展示个人数据。登录身份与头像昵称分开处理；不绘制旧式“授权获取头像昵称”弹窗。登录凭证能力依据 [微信官方 API 定义](https://github.com/wechat-miniprogram/api-typings/blob/master/types/wx/lib.wx.api.d.ts)，资料填写能力依据 [官方头像昵称组件说明](https://github.com/wechat-miniprogram/mp-user-avatar)；设计未证明服务端会话已接入。

个人页分账户资料、穿搭设置和账户操作。默认显示占位头像和“衣柜用户”，点击账户或个人资料进入 `LgGyr`；头像及昵称选填，使用真实平台资料填写能力，不把资料授权作为登录前提。保存失败保留本次输入，关闭不保存保留原资料。

偏好和城市分别进入已有页面/弹层。日期时区选择后保存，成功提示，失败保留原有效时区并可重试，不设置整页“保存设置”。退出使用共用确认结构，文案明确仅退出当前登录、不删除衣物和历史；确认退出后清除当前登录状态及个人数据展示，不能直接显示成注销账号。

### 其他业务路径

- 衣柜及详情支持可穿、暂不可穿、已归档。归档复用确认结构，使用普通主操作，文案明确不参与推荐且保留历史；恢复沿用状态选择。没有永久删除衣物入口。
- 首页 `VAtRc` 默认展示完整推荐依据，天气、偏好、历史缺失如实说明，不设置展开/收起。场景只影响当前推荐；换一套重新推荐整组，替换单品仅更换所选库存，不写入历史。定位授权由微信宿主处理，拒绝或失败保留手动选城，不阻塞衣柜及推荐。
- 推荐确认、补录及修正共用记录表单：分别带入推荐、自选衣物和原记录；保存前须确认实际日期和衣物。未来日期拒绝，同次提交防重，失败保留输入。修正动作“保存修改”。
- 实际穿着多选 `mKPcR` 点击“完成选择”才更新待保存表单，取消保持原值；它与 `AvD3c` 单品即时替换的行为不同。两者均不在确认记录前写入历史。
- 历史菜单引用公共 DropdownMenu `z:AwJuH` 的普通项/危险项结构，业务动作“修改记录、删除记录”；删除复用 `m0rZ7`，仅删除该记录与计数，不删衣物。
- 空衣柜、筛选为空、无记录、无推荐候选共用 `SKORD`，按原因分别提供添加衣物、清除筛选、补录、管理衣柜或调整偏好。无历史不写“从未穿过”；统计仍可展示库存，空趋势显示暂无已记录穿着。

## 组件与实现边界

消费稿继续使用真实库实例：Button `z:j8DiT/z:EthvI`、Input `z:mTBzU`、Label `z:QS5ir`、Select `z:MCyOS`、Textarea `z:v1JdnQ`、Dialog `z:ocBvt`。分类列表、颜色选择、Chip 多选及个人资料为业务组合，不提升公共库，不宣称公共 Select 已具备多选能力。

颜色、字号、行高主要绑定 `$z:*`；图片圆角/边界及 `wardrobe-mobile-*` 是消费稿内的业务几何。当前解析值及用途见 UI 规范。width/height 上未能持续保留的自定义变量引用以已解析值落图，变化后需重新解析；不把变量名当成已有 CSS/rpx 接线。

实现使用 `miniprogram/` 的 Taro 组件和 [本端组件清单](../../docs/engineering/miniprogram/components/component-inventory.md)，沿用 [开发规范](../../docs/engineering/miniprogram/standards/development.md) 的页面注册、请求、会话、生命周期与样式边界。现有 PageShell、Button、Field、Notice、StatePanel 可按真实 API 复用；公共库的 React export/props 仅证明 Web 能力，不作为小程序 import。

现有平台适配已提供获取微信临时 code、媒体选择和通用上传函数，但登录页面仍消费用户名密码接口，未接通微信 code 交换后端；选图/上传适配也不等于已有衣物媒体存储。当前 chooseImage 合并拍照和相册来源，业务的两个明确入口还需支持分别指定来源。定位、头像昵称填写及业务 API 仍待接入。

当前模板采用原生导航和“首页、组件、设置”示例 Tab；业务需依照本稿替换为“衣柜、穿搭、记录”，落实自定义导航、胶囊预留、固定操作、弹层与键盘规则。模板的 375px 基准不改变本稿 390px 的比较条件；触控命中区按本端至少 48px，图标和按钮视觉可沿用画布尺寸，窄屏采用流式布局而非整体缩放。具体业务覆盖见 [业务移动 UI](wardrobe-ui-spec.md)。图层、Reusable Frame 与公共组件数量不决定代码拆分。

## 检查与接受

- 结构 `passed`：实际回读全部主页面导航的几何与胶囊预留；添加表单、个人内容与局部弹层已核对流式布局、完整内容及源实例引用。活动页面恢复为 390 × 844，单一内容源不因展开态复制字段。
- 视觉 `passed`（限定组合）：添加页及照片/展开示例、个人、微信登录和分类/颜色/标签/资料弹层完成 390px Light/Dark 查看；添加页补查 360/375/430px，个人、更多属性和颜色弹层补查 360px。已查看完整展开内容，固定操作区与内容分开；没有将所有页面、主题和宽度的交叉组合记为通过。
- 保存回读 `passed`：通过连接当前 desktop 的 `pen interactive` 保存到指定文件，回读磁盘版，确认推荐图的替换提示已启用、最近穿着缩略图已绑定主题自适应细描边。保存版 SHA-256 为 `e425e1930f9706d8a06a1632adb501d9c648b144f452a471bcd08e566009c183`；本次未修改公共库。
- 运行验证 `not_run`：没有小程序工程运行、真机键盘/滚动/安全区、微信登录、定位、媒体权限、请求及数据保存的验证；没有修改业务代码、启动服务或发布。

better-ui 最终稿整理保留现有 Signal Teal、公共库引用和唯一业务内容源；推荐图恢复可替换提示，最近穿着缩略图补齐纯黑/纯白 10% 细描边。推荐、衣柜、详情、添加/展开表单、历史及场景/替换/分类/颜色/标签弹层已查看 Light/Dark；推荐、衣柜、添加页补查 360px，主稿恢复为 390px Light。静态动效、按压缩放、真实焦点/键盘和运行交互均未验证，既有预览未重新导出，不应替代当前可编辑稿。

整体样式方向已确认；当前按用户指令整理最终稿，静态检查不代替用户或产品验收。
