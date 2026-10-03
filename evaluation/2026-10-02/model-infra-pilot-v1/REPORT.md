# 弱模型 + infra 对照试验 v1

**本轮没有证明能力提升。** 两个可比较的 Softmax 配对，普通重试 B 在两种附件顺序下都胜过 infra 反馈 C；两个残差配对未能导出弱模型视频，无法比较画面质量。
实验于 2026-10-02 启动，2026-10-03 汇总；沿用已冻结的 v1 目录。
这是探索性试验：2 个已有契约任务 × 2 次独立初稿，不支持显著性或总体能力提升结论。

主要比较 **C（确定性检查反馈）与 B（普通自查修订）**。A 是弱模型初稿，D 是强模型一次生成参考。

| C 对 B：交换附件顺序后保持的结果 | 数量 / 4 |
|---|---:|
| C 更好 | 0 |
| B 更好 | 2 |
| 平局 | 0 |
| 两次均无法判断 | 0 |
| 顺序不一致或审查失败 | 0 |
| 至少一组没有可用视频，画面不可比 | 2 |

## 每条结果与实际成本

| 任务 | 重复 | 组 | 导出视频 | 技术检查 | 画面证据项 / 4（两次盲评） |
|---|---:|---|---|---|---|
| residual | 1 | A | 失败 | 未通过 | 0 / 未知 |
| residual | 1 | B | 失败 | 未通过 | 0 / 未知 |
| residual | 1 | C | 失败 | 未通过 | 0 / 未知 |
| residual | 1 | D | 是 | 通过 | 4 / 未知 |
| residual | 2 | A | 失败 | 未通过 | 未知 / 未知 |
| residual | 2 | B | 失败 | 未通过 | 未知 / 未知 |
| residual | 2 | C | 失败 | 未通过 | 未知 / 未知 |
| residual | 2 | D | 是 | 通过 | 未知 / 未知 |
| softmax | 1 | A | 是 | 未通过 | 3 / 3 |
| softmax | 1 | B | 是 | 未通过 | 4 / 4 |
| softmax | 1 | C | 是 | 未通过 | 4 / 4 |
| softmax | 1 | D | 是 | 通过 | 4 / 4 |
| softmax | 2 | A | 失败 | 未通过 | 0 / 0 |
| softmax | 2 | B | 是 | 未通过 | 4 / 4 |
| softmax | 2 | C | 是 | 未通过 | 3 / 4 |
| softmax | 2 | D | 是 | 通过 | 4 / 4 |

“证据项”来自统一的四项具体要求，是裁判的画面判断，不是看懂率或艺术总分。无画面的 0 项表示没有证据可评，不是画面差。完整判断、时刻证据和顺序敏感性见 [summary.json](summary.json) 与 [judgements.json](judgements.json)。

| 组 | 有效调用预算 | 生成用时合计（秒） | 渲染用时合计（秒） | 输出 tokens |
|---|---|---:|---:|---:|
| A | 4 次，4 个候选 | 251.2 | 6.1 | 8551 |
| B | 12 次，4 个候选 | 676.2 | 24.3 | 25541 |
| C | 12 次，4 个候选 | 661.6 | 22.8 | 25052 |
| D | 4 次，4 个候选 | 529.2 | 10.7 | 11408 |

时长是重叠调用的合计，不是用户等待时间；批次等待见 [generation-timing.json](generation-timing.json)。B/C 共用 A 的初稿，上表分别计入初稿成本，实际调用总量见 [unique-generation-calls.json](unique-generation-calls.json)。不是严格相等 token 实验。

## 设计与冻结

Luna 生成 A/B/C，Astra 生成 D 并做最终盲评，两者 reasoning=low。每次官方 CLI 独立临时上下文、禁止工具；没有 subagent 或凭据转换。
A/B/C 共享完全相同初稿。B/C 都收到相同要求、前版源、同样抽帧与执行错误，每次返回完整替换源；只有 C 收到确定性数字、声明几何、抽样像素、布局与阶段顺序的检查反馈。此轮测试该窄反馈机制，不等于验证整个平台或运行时资产复用。
B/C 固定修两轮，不以通过为由提前停止；最后一版作为最终结果，即使它比前版差。没有 best-of、回退、人工挑选、候选代码手改或超预算恢复。源码长度是提示中的软限制，实际是否遵守在每版记录中保留。
强裁判的4个负对照全部匹配预设标签，见 [calibration.json](calibration.json)。仅一遍、同一批旧样例，是换模型后的基础筛查，不能外推到新视频的总体可靠性。
所有生成完成后，裁判每次看同任务的四张匿名联系表。方法、模型、源码、修订次数、技术检查结论不提供给裁判。每组正序与逆序各一次，评四项证据并比较全部六对；结果冲突标为 unresolved，不挑有利的顺序。D 的作品也由 Astra 评价，因此同模型偏好仍可能影响强弱比较；主要 C/B 都由 Luna 生成。
brief、通用协议、生成/审查脚本与 schema 在真实调用前冻结，见 [experiment.json](experiment.json)、[frozen.json](frozen.json)、[tooling](tooling)。任务数值与既有成片不同，但仍属于已开发过的契约家族，不是广泛的未见概念集。

## 验证层次与局限

- 安装：复用本地 Playwright/Chromium/FFmpeg，没有本轮安装；依赖版本每次渲染 manifest 记录。
- mock/代码验证：58 项 Python 测试通过，三个 Node 测试文件通过；覆盖 B 无法获得 C 检查结果、裁判缺项不可接受，以及缺视频不能计为画面平局或败北。
- 真实生成：独立 CLI 调用，所有模型失败、超时和源码版本保留。实际完成与调用统计见逐项记录；不能把调用退出码当作艺术质量。
- 实际渲染：固定 t=frame/fps，18 秒、854×480、15fps；诊断模式允许导出有检查错误的片，但 exit=1/checks_failed 保持不变。本地故意错误片验证见 [renderer-regression.json](renderer-regression.json)。
- 数学检查：[math-reference.json](math-reference.json) 独立计算预期值。每个 render 的 checks/frame-evidence/manifest 保存重算、几何与像素检查；候选提供的证据 registry 不是全像素或语义正确性证明。
- 艺术审看：强模型只审查六个时刻的静帧，不评价完整连续运动、教学效果或人类理解。当前代理的视觉抽检也不作为独立盲评。
- 没有显著性结论；四次配对高度受两个任务影响，不把反复审查当作更多独立任务。模型标识固定，但服务端权重版本无法固定。
- infra 的实现与准备成本未单独计时，不能由边际生成耗时推断总投入回报。

## 失败原因与下一轮假设

最终裁判 8 次尝试中完成 5 次，其余 3 次因已登录 Codex 账号的 usage limit 返回失败。未追加调用，记为 unknown，见 [review-failures.json](review-failures.json)。四次 Softmax 审查均完成，所以该任务两个配对的顺序一致性有实际证据；残差片既无弱模型导出视频，也有审查缺失，不用于画面胜负。

有两个值得修正的具体机制：

1. 残差弱模型反复输出 `geometry: {unitScale, vectors}`，协议要求的是分别命名的 `identity/correction/output` 数组。取样器读取缺失数组时抛错，在保存抽帧和视频前停止。这是证据协议/采集失败，不能据此推断其浏览器内的绘画内容一定差。C 在这里拿不到后续几何检查的具体发现，只有与 B 相同的执行异常。
2. Softmax 第二个 C 候选指数条宽用了 `34 + 34*mass`，不是共同尺度的 `scale*mass`。实际宽约 49.3、84.7、146.9，比例与指数质量 0.449、1.492、3.320 不一致。现有检查只约束最终概率分割，未覆盖指数条的中间比例；强裁判两个顺序都指出该差异。C 同时仍有 11s 公式被条形/连线穿过的问题。第一个配对 B 则更明确显示零刻度和逐类指数标签。

裁判对第二个 C 的四项证据计数在两个顺序间从 3 变成 4，虽然 B/C 的胜者一致。这说明“证据完成项”也有判定波动，不能仅靠该数字接受动画。

下一轮优先让运行时从声明的绘图原语自动产生证据，并让导出和检查分别失败；避免小模型重复手写冗长 registry。另把共同尺度作为中间图形的契约。在新版本中重新冻结两臂和测量规则，再复测相同预算的 B/C；此次样例不能被偷偷修好后算入 v1。不能由两对负结果断言所有 infra 无效，也不能将强参考组优胜当作裁判绝对正确。

[全部24版候选记录](all-candidates.json)保存输入指针、源哈希、调用统计、数学检查范围、渲染/抽帧和修订史；[源快照](candidate-sources/)保存所有生成源码。独立视觉审查只覆盖最终版本，中间版本保留技术审查，未赋予艺术通过。原始日志与视频仍在 ignored work/。实际调用与 token 用量见 [actual-cost.json](actual-cost.json)，包括失败，不将并行耗时之和写成等待时间。

## 每条最终视频


### softmax · 重复 1

- A：[视频](/home/yang-zhi/文档/ChatGPT/concept2motion/work/model-infra-pilot-v1/candidates/softmax-1-A/v1/render/video.mp4) · [联系表](/home/yang-zhi/文档/ChatGPT/concept2motion/work/model-infra-pilot-v1/panels/softmax-1/W.png)
- B：[视频](/home/yang-zhi/文档/ChatGPT/concept2motion/work/model-infra-pilot-v1/candidates/softmax-1-B/v3/render/video.mp4) · [联系表](/home/yang-zhi/文档/ChatGPT/concept2motion/work/model-infra-pilot-v1/panels/softmax-1/Y.png)
- C：[视频](/home/yang-zhi/文档/ChatGPT/concept2motion/work/model-infra-pilot-v1/candidates/softmax-1-C/v3/render/video.mp4) · [联系表](/home/yang-zhi/文档/ChatGPT/concept2motion/work/model-infra-pilot-v1/panels/softmax-1/X.png)
- D：[视频](/home/yang-zhi/文档/ChatGPT/concept2motion/work/model-infra-pilot-v1/candidates/softmax-1-D/v1/render/video.mp4) · [联系表](/home/yang-zhi/文档/ChatGPT/concept2motion/work/model-infra-pilot-v1/panels/softmax-1/Z.png)

### softmax · 重复 2

- A：未导出视频 · [联系表](/home/yang-zhi/文档/ChatGPT/concept2motion/work/model-infra-pilot-v1/panels/softmax-2/X.png)
- B：[视频](/home/yang-zhi/文档/ChatGPT/concept2motion/work/model-infra-pilot-v1/candidates/softmax-2-B/v3/render/video.mp4) · [联系表](/home/yang-zhi/文档/ChatGPT/concept2motion/work/model-infra-pilot-v1/panels/softmax-2/Z.png)
- C：[视频](/home/yang-zhi/文档/ChatGPT/concept2motion/work/model-infra-pilot-v1/candidates/softmax-2-C/v3/render/video.mp4) · [联系表](/home/yang-zhi/文档/ChatGPT/concept2motion/work/model-infra-pilot-v1/panels/softmax-2/Y.png)
- D：[视频](/home/yang-zhi/文档/ChatGPT/concept2motion/work/model-infra-pilot-v1/candidates/softmax-2-D/v1/render/video.mp4) · [联系表](/home/yang-zhi/文档/ChatGPT/concept2motion/work/model-infra-pilot-v1/panels/softmax-2/W.png)

### residual · 重复 1

- A：未导出视频 · [联系表](/home/yang-zhi/文档/ChatGPT/concept2motion/work/model-infra-pilot-v1/panels/residual-1/X.png)
- B：未导出视频 · [联系表](/home/yang-zhi/文档/ChatGPT/concept2motion/work/model-infra-pilot-v1/panels/residual-1/Y.png)
- C：未导出视频 · [联系表](/home/yang-zhi/文档/ChatGPT/concept2motion/work/model-infra-pilot-v1/panels/residual-1/W.png)
- D：[视频](/home/yang-zhi/文档/ChatGPT/concept2motion/work/model-infra-pilot-v1/candidates/residual-1-D/v1/render/video.mp4) · [联系表](/home/yang-zhi/文档/ChatGPT/concept2motion/work/model-infra-pilot-v1/panels/residual-1/Z.png)

### residual · 重复 2

- A：未导出视频 · [联系表](/home/yang-zhi/文档/ChatGPT/concept2motion/work/model-infra-pilot-v1/panels/residual-2/X.png)
- B：未导出视频 · [联系表](/home/yang-zhi/文档/ChatGPT/concept2motion/work/model-infra-pilot-v1/panels/residual-2/Z.png)
- C：未导出视频 · [联系表](/home/yang-zhi/文档/ChatGPT/concept2motion/work/model-infra-pilot-v1/panels/residual-2/W.png)
- D：[视频](/home/yang-zhi/文档/ChatGPT/concept2motion/work/model-infra-pilot-v1/candidates/residual-2-D/v1/render/video.mp4) · [联系表](/home/yang-zhi/文档/ChatGPT/concept2motion/work/model-infra-pilot-v1/panels/residual-2/Y.png)
