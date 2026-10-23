# Tasks

## 1. Backend实现与稳定契约

- [x] 1.1 Backend主执行者独占backend/（除1.2两文件），先冻结推荐Create/View/Selection/Candidates及可选穿着来源的实际DTO/错误/分页契约，追加head8edcf8789aeb后的迁移与必要真实调用者；检查旧记录/幂等保留和单一迁移head，将稳定提供方交协调者导出，不写生成schema或Manager。
- [x] 1.2 HTTP执行者仅写backend/app/services/ai_runtime_client.py和backend/tests/test_ai_runtime_client.py，按设计中稳定AiRuntimeClient(create_run/get_run/cancel_run/cancel_by_key)边界消费已验收AI API，构造不I/O/缺配置零发送、有界单次HTTP/无redirect、Bearer/稳定key/结构/身份/冻结input核验及安全retryable错误；只用HTTP替身验证，不访问AI库/真实模型，不改主执行者代码。
- [x] 1.3 Backend主执行者实现全库存三值过滤、确定性软排序/16件明示容量、近30日候选历史和受控事实/理由规则；用规则及真实PG测试验证空偏好/历史、少量/未知属性、后页合规/硬避免/comfort不保证、partial天气/无候选零模型和模型伪造事实失败。
- [x] 1.4 Backend主执行者实现同事务请求/Outbox、显式dispatcher/lease、同key远端映射恢复、事务外HTTP、可靠cancel、发布/读取stale重验及替换候选/完整组合；真实PG并发/故障注入断言映射丢失、重投递不新Run、过期lease/截止期/迟到结果不复活、取消双方胜出、全部HTTP时无业务事务。
- [x] 1.5 Backend主执行者将可选recommendation_request_id接到共用实际穿着保存事务，按账号锁重验来源/组合并先重放原幂等收据；必要相邻规则/PG/HTTP测试确认预填后stale拒绝、同key成功重试、历史/统计刷新及手动归档/过去日期/原快照修改删除不受影响，返回精确命令/原样响应，不改小程序。

## 2. 小程序设计消费与业务实现

- [x] 2.1 客户端执行者按design-to-code绑定本Change本组pending任务，真实读取只读wardrobe.pen当前SHA、P9tls/ZHXw9/Q3U4y/AvD3c/SKORD及所用库组件/主题并prepare，核对WeatherPanel、wear表单、Page/Token/导航实际API；保存消费上下文和源前后hash。仅字体strict binding按本Plan例外pending，不用旧preview或虚构pin；本项就绪后且1.1契约导出才进入2.2。
- [x] 2.2 客户端执行者独占miniprogram/（生成schema由协调者统一命令维护），基于真实提供方decoder实现生成/轮询/离页恢复/主动取消、场景、替换分页/完整组合校验及带来源实际穿着预填保存；会话代次/序号隔离、失败保留key/草稿、校验中隐藏旧理由并禁确认。复用WeatherPanel/PrivatePhoto/Page/现有状态，接通三主入口和个人设置并更新受影响旧Tab调用，不改设计源或新增示例业务。
- [x] 2.3 客户端执行者执行相关状态/decoder/表单/会话与相邻导航测试、typecheck、受影响ESLint/Prettier/diff检查，消费协调者提供的真实HTTP原样收据复验decoder与来源保存；静态核对双主题Token/固定区域/胶囊/键盘/48px触控，保存实际结果且不运行build/devserver/browser，不冒称宿主/视觉验收。

## 3. 跨端与阶段收尾

- [x] 3.1 协调者从稳定Backend实际导出唯一OpenAPI并生成小程序schema，核对AI消费者/真实HTTP收据及根配置/必要运行文档；使用本任务两个独立数据库/角色及Redis，通过真实Backend认证/Outbox/dispatcher/AI API/单Worker/Saver验证从创建、幂等/取消/调整到显式保存、历史/统计与会话隔离的完整M3链，仅模型/微信/天气外部边界可替身，未通过不标阶段完成。
- [x] 3.2 协调者安排独立只读Reviewer审稳定Backend、客户端及新增跨端差量，修复后定向复验复查，核对全Plan需求覆盖与阶段集成再回写本Change及M3 code-verified；保存人工/真实模型/微信/媒体/定位/字体视觉待验、入口与局限，不提交/归档/发布，不重复未变检查或伪造人工接受。
