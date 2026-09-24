# 修复回写矩阵

| 证据支持的根因 | 可修改内容 | 不应修改 |
| --- | --- | --- |
| 代码不符合正确要求 | 对应代码、回归测试、证据 | 正确PRD/Spec/技术方案 |
| task漏实现 | 对应任务及代码，重新验证 | 无关需求 |
| 实现设计错误但目标未变 | 受控修订design/tasks与代码 | 不受影响的capability specs |
| Spec遗漏/矛盾 | 对应requirement/scenario及真正受影响下游 | 为通关整份重写 |
| 新产品/视觉目标 | PRD/基线修订，真实人工裁决 | 伪装成代码bug |
| 已归档行为需改变 | 新active change | 任何旧archive文件 |

只有本身错误的artifact回写。下游仍正确就停止级联。每次修复输出允许路径，核对实际diff。
纯代码错误写 No artifact backwrite required，不为了留记录修改规范正文。
