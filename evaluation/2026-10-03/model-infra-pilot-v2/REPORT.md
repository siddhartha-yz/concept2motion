# 同绘图接口的弱模型对照 · v2

本轮冻结相同绘图接口、任务与调用预算，主要比较普通修订 B 和确定性反馈修订 C。没有人工改候选或挑最佳版本。

当前阶段：`final_review`；实际模型请求 36 次，完成 32 次，未知/失败 4 次。
生成完成；最终独立审查 4/8 次完成。输入 tokens 701631，输出 tokens 53390。

停止原因：A final review failed; no later review batch submitted. Missing reviews remain unresolved.

| C 对 B，交换附件顺序后 | 数量 / 4 |
|---|---:|
| C 更好 | 0 |
| B 更好 | 0 |
| 平局 | 0 |
| 两次均无法判断 | 0 |
| 审查失败或顺序不一致 | 2 |
| 缺少视频，不可比较 | 2 |

| 任务 | 重复 | 组 | 固定最终版本 | 导出 | 技术检查 | 画面证据项 / 4（正反顺序） |
|---|---:|---|---:|---|---|---|
| residual | 1 | A | 1 | 失败 | 未通过 | 未知 / 未知 |
| residual | 1 | B | 3 | 有 | 未通过 | 未知 / 未知 |
| residual | 1 | C | 3 | 有 | 未通过 | 未知 / 未知 |
| residual | 1 | D | 1 | 有 | 未通过 | 未知 / 未知 |
| residual | 2 | A | 1 | 有 | 未通过 | 未知 / 未知 |
| residual | 2 | B | 3 | 有 | 未通过 | 未知 / 未知 |
| residual | 2 | C | 3 | 有 | 未通过 | 未知 / 未知 |
| residual | 2 | D | 1 | 有 | 未通过 | 未知 / 未知 |
| softmax | 1 | A | 1 | 失败 | 未通过 | 0 / 0 |
| softmax | 1 | B | 3 | 失败 | 未通过 | 0 / 0 |
| softmax | 1 | C | 3 | 有 | 未通过 | 4 / 4 |
| softmax | 1 | D | 1 | 有 | 通过 | 4 / 4 |
| softmax | 2 | A | 1 | 失败 | 未通过 | 0 / 0 |
| softmax | 2 | B | 3 | 失败 | 未通过 | 0 / 0 |
| softmax | 2 | C | 3 | 失败 | 未通过 | 0 / 0 |
| softmax | 2 | D | 1 | 有 | 通过 | 4 / 4 |

画面证据项是四项固定机制要求的模型判断，不是理解率或艺术评分。只有生成完成，版本列才是完整计划的最终版本；中断时保留最后已执行尝试。

A/B/C 由 Luna 生成，D 由 Astra 一次生成；A 的初稿与 B/C 完全共享。B/C 固定各修两轮，前版源码、可用抽帧和执行错误条件相同，仅 C 获得检查发现。A/B/C/D 都可使用同一个冻结的 math-frame.mjs。B/C 调用数/effort/软长度预算相同，实际 tokens 不保证相等。

Astra 裁判只看匿名 WXYZ 联系表、任务问题与固定四项要求；方法、源码、模型身份、技术结论不提供。每个面板交换附件顺序复评，冲突/缺失记未决；无视频记不可比较。裁判结果从未反馈给作者。D 与裁判同模型可能产生偏好，主要比较 C/B。

[冻结设计](experiment.json) · [冻结哈希](frozen.json) · [裁判筛查](calibration.json) · [实际调用](actual-calls.json) · [全部结果与证据](summary.json)

验证分类：本轮复用安装环境；单元/模拟检查单列于运行文档。实际模型生成与渲染状态逐版记录，所有源码保存在 candidate-sources/；视频、抽帧与原始 provider 日志位于 ignored work/。模型审看是六个时刻的静帧，不是完整动画、人类教学研究或用户艺术接受。

本轮没有隔离“绘图接口本身”的收益；与 v1 跨轮比较不能证明该接口的因果效果。仅两个已开发契约任务、四份弱初稿，不作统计显著性或泛化能力提升结论。服务端权重版本无法固定。实验设计成本未单独测量，不能推断总投入回报。

### softmax · 重复 1

- A：无视频 · [抽帧](/home/yang-zhi/文档/ChatGPT/concept2motion/work/model-infra-pilot-v2/panels/softmax-1/W.png)
- B：无视频 · [抽帧](/home/yang-zhi/文档/ChatGPT/concept2motion/work/model-infra-pilot-v2/panels/softmax-1/X.png)
- C：[视频](/home/yang-zhi/文档/ChatGPT/concept2motion/work/model-infra-pilot-v2/candidates/softmax-1-C/v3/render/video.mp4) · [抽帧](/home/yang-zhi/文档/ChatGPT/concept2motion/work/model-infra-pilot-v2/panels/softmax-1/Y.png)
- D：[视频](/home/yang-zhi/文档/ChatGPT/concept2motion/work/model-infra-pilot-v2/candidates/softmax-1-D/v1/render/video.mp4) · [抽帧](/home/yang-zhi/文档/ChatGPT/concept2motion/work/model-infra-pilot-v2/panels/softmax-1/Z.png)

### softmax · 重复 2

- A：无视频 · [抽帧](/home/yang-zhi/文档/ChatGPT/concept2motion/work/model-infra-pilot-v2/panels/softmax-2/X.png)
- B：无视频 · [抽帧](/home/yang-zhi/文档/ChatGPT/concept2motion/work/model-infra-pilot-v2/panels/softmax-2/Z.png)
- C：无视频 · [抽帧](/home/yang-zhi/文档/ChatGPT/concept2motion/work/model-infra-pilot-v2/panels/softmax-2/Y.png)
- D：[视频](/home/yang-zhi/文档/ChatGPT/concept2motion/work/model-infra-pilot-v2/candidates/softmax-2-D/v1/render/video.mp4) · [抽帧](/home/yang-zhi/文档/ChatGPT/concept2motion/work/model-infra-pilot-v2/panels/softmax-2/W.png)

### residual · 重复 1

- A：无视频 · [抽帧](/home/yang-zhi/文档/ChatGPT/concept2motion/work/model-infra-pilot-v2/panels/residual-1/X.png)
- B：[视频](/home/yang-zhi/文档/ChatGPT/concept2motion/work/model-infra-pilot-v2/candidates/residual-1-B/v3/render/video.mp4) · [抽帧](/home/yang-zhi/文档/ChatGPT/concept2motion/work/model-infra-pilot-v2/panels/residual-1/Y.png)
- C：[视频](/home/yang-zhi/文档/ChatGPT/concept2motion/work/model-infra-pilot-v2/candidates/residual-1-C/v3/render/video.mp4) · [抽帧](/home/yang-zhi/文档/ChatGPT/concept2motion/work/model-infra-pilot-v2/panels/residual-1/W.png)
- D：[视频](/home/yang-zhi/文档/ChatGPT/concept2motion/work/model-infra-pilot-v2/candidates/residual-1-D/v1/render/video.mp4) · [抽帧](/home/yang-zhi/文档/ChatGPT/concept2motion/work/model-infra-pilot-v2/panels/residual-1/Z.png)

### residual · 重复 2

- A：[视频](/home/yang-zhi/文档/ChatGPT/concept2motion/work/model-infra-pilot-v2/candidates/residual-2-A/v1/render/video.mp4) · [抽帧](/home/yang-zhi/文档/ChatGPT/concept2motion/work/model-infra-pilot-v2/panels/residual-2/X.png)
- B：[视频](/home/yang-zhi/文档/ChatGPT/concept2motion/work/model-infra-pilot-v2/candidates/residual-2-B/v3/render/video.mp4) · [抽帧](/home/yang-zhi/文档/ChatGPT/concept2motion/work/model-infra-pilot-v2/panels/residual-2/W.png)
- C：[视频](/home/yang-zhi/文档/ChatGPT/concept2motion/work/model-infra-pilot-v2/candidates/residual-2-C/v3/render/video.mp4) · [抽帧](/home/yang-zhi/文档/ChatGPT/concept2motion/work/model-infra-pilot-v2/panels/residual-2/Z.png)
- D：[视频](/home/yang-zhi/文档/ChatGPT/concept2motion/work/model-infra-pilot-v2/candidates/residual-2-D/v1/render/video.mp4) · [抽帧](/home/yang-zhi/文档/ChatGPT/concept2motion/work/model-infra-pilot-v2/panels/residual-2/Y.png)


## 本轮直接指标与诊断

| 组 | 导出 / 4 | 技术通过 / 4 | 作者请求（含共享初稿） | 输出 tokens |
|---|---:|---:|---:|---:|
| A 弱模型初稿 | 1/4 | 0/4 | 4 | 7431 |
| B 普通修订 | 2/4 | 0/4 | 12 | 21611 |
| C 检查反馈修订 | 3/4 | 0/4 | 12 | 20739 |
| D 强模型参考 | 4/4 | 2/4 | 4 | 9509 |

24 次实际唯一作者调用全部完成；生成与逐版渲染共 320.776 秒（约 5 分 21 秒），不含裁判筛查和最终审查。C 相比 B 多导出一条，但两组技术通过均为零。独立画面比较有 2 个缺视频配对、2 个裁判缺失配对，因此 **没有可确认的 C/B 画面质量胜负**。

最终裁判共尝试 8 次：Softmax 正反顺序 4 次完成，残差 4 次因 provider usage limit 未完成。见 [失败分类](review-failures.json)。原始失败保留在本轮记录，不静默重试；以后追加评价必须另记版本和成本。

源码检查确认三条 Softmax 最终失败都包含标签 ID `class-i` 与接口自动生成的分区 ID 冲突。错误信息没有指出具体 ID，弱模型两轮仍未修好。这既是作者失败，也是接口可用性缺陷；不能仅归因模型能力。

残差 C1 的几何发现集中在过渡期间：把逐渐显现的箭头按完整目标长度检查会产生冲突。但残差 C2 的合并错误一直持续到末尾，不能放宽过渡检查后将这类错误一并消除。旧判定保持，后续需显式区分目标数值、已绘制几何与显现进度，再检查最终可见性。

当前代理非盲查看了 residual-1-B/C 的17秒与 softmax-1-C 的14秒帧，确认新场景仍有遮挡/堆叠；不作为独立艺术通过。[诊断记录](runtime-observations.json) · [各组成本](costs-per-arm.json) · [独立数值参考](math-reference.json)。

Python 全部 60 项测试通过；其中模拟调用、恢复/隔离单测不算真实生成。渲染来源是24个真实模型版本，最终有10条视频；视频验证与所有错误由逐版manifest记录。模型评价只看静帧，与最终画面是否易懂、人类答题率或全运动艺术质量有不同范围。
