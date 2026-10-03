# ID 命名空间修复：明确依赖升级回归

16 个冻结最终候选只升级 math-frame.mjs；作者 HTML、scene.js 和 storyboard 不变。依赖字节发生变化并逐项记录，不称作原样源码实验或模型生成改善。

导出 **10/16 → 14/16**，恢复 4 条；丢失旧导出 0 条。模型调用0次，四并行共 19.914 秒，14 条完整解码。技术通过仍为2/16。

原始注册表共用文本和图形的裸ID，标签 class-0 与概率分区 class-0 冲突。现在注册表分 kind 命名空间，几何的 class-0..2 保持原有语义ID；同类对象重复仍明确失败，错误指出具体ID。非法 vector 参数也报告 role/index/caseId。

| 候选 | 旧导出 | 新导出 | 新技术状态 |
|---|---|---|---|
| residual-1-A | 失败 | 失败 | execution_failed |
| residual-1-B | 有 | 有 | checks_failed |
| residual-1-C | 有 | 有 | checks_failed |
| residual-1-D | 有 | 有 | checks_failed |
| residual-2-A | 有 | 有 | checks_failed |
| residual-2-B | 有 | 有 | checks_failed |
| residual-2-C | 有 | 有 | checks_failed |
| residual-2-D | 有 | 有 | checks_failed |
| softmax-1-A | 失败 | 有 | checks_failed |
| softmax-1-B | 失败 | 失败 | execution_failed |
| softmax-1-C | 有 | 有 | checks_failed |
| softmax-1-D | 有 | 有 | render_passed |
| softmax-2-A | 失败 | 有 | checks_failed |
| softmax-2-B | 失败 | 有 | checks_failed |
| softmax-2-C | 失败 | 有 | checks_failed |
| softmax-2-D | 有 | 有 | render_passed |

剩余两条失败：residual-1-A 使用不支持的角色 correction-merge-proxy；softmax-1-B 在一帧中重复绘制 mass-0。仍保留错误，未把未知向量角色猜成正确语义，也未静默接受同对象重复绘制。

本回归为本机实际渲染，安装环境复用；新增命名空间和参数错误单测使用模拟 Canvas。新帧没有模型独立艺术审看或用户接受。像素、数学和布局发现均保留。

[范围](plan.json) · [各条检查、源哈希、显式修订历史](results.json) · [汇总](summary.json) · [冻结工具哈希](tooling-hashes.json)

原v2生成与独立审查完全不回填；此处导出恢复证明接口兼容性修复的工程效果，不证明弱模型能力提升。
