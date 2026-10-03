# 导出与绘图证据回归 · 2026-10-03

16 条旧最终候选保持源码不变，视频导出从 **9/16 → 16/16**，新增可查看视频 7 条。四并行整批重渲染 **19.257 秒**，模型调用 **0 次**。技术检查通过仍为 **4/16**。这是工程可靠性修复，没有证明动画质量或弱模型能力提升。

| 指标 | 原实验 | 新工具重放 |
|---|---:|---:|
| 最终候选数 | 16 | 16 |
| 视频导出 | 9 | 16 |
| 新工具完整视频解码 | — | 16 |
| 技术检查通过 | 4 | 4 |
| 本次新增模型调用 | — | 0 |

全部视频为 18 秒、854×480、15 fps、270 帧，重放共解码 4320 帧。19.257 秒只包含这批本地渲染与验证，不含此前生成、独立裁判或安装时间，不能作为模型生成提速数据。原始与新状态见 [results.json](results.json)、[summary.json](summary.json)。

## 修复与检查范围

原来的渲染器把缺少 geometry.output 等检查字段当成取帧异常，导致实际绘图已经完成的候选无法导出。现在先保留画面，再把缺失证据或无效像素采样坐标记录为检查发现。实际 JavaScript 绘图异常和画布/元数据不匹配仍会失败。`--render-invalid` 只允许保存诊断视频；这些失败候选仍是 checks_failed、exit 1。

六条弱模型残差候选依旧缺少规范向量证据；检查器报告 missing_vectors/wrong_merge，不能据此断言它们画出的箭头一定错误。Softmax-2-A 还包含缺失最终分区证据和画面重叠。新工具保留这些失败，而没有替作者补写证据或修改源码。

新增指数条形检查比较中间指数阶段的实际登记宽度比例。Softmax-2-C 使用 `34 + 34 * mass`，加法常数使比例失真：第一条占总宽 17.54%，应为 8.54%；现在产生 wrong_mass_geometry。其数值标签和最终概率正确也不能掩盖这处问题。

覆盖有明确限制：旧候选只有 exact `mass-0..2` shape IDs 才可用于宽度比例，或新接口显式给出 geometry.massBars。8 条旧 Softmax 中仅 Softmax-2-C 有稳定不透明帧实际检查到比例（4 个采样）；5 条无可识别证据，2 条登记透明度未达到检查阈值、记为 transient，其余记录逐项见下表。未识别/过渡均不代表比例通过。旧强模型两条 Softmax 的技术通过也不构成新增比例检查已覆盖它们。显式 massBars 才增加中心像素探针；旧 bounds 兼容只查宽度。

新 `runtime/math-frame.mjs` 把条形、概率分区、带符号箭头、测量文本的绘制与证据登记放在同一调用内；作者仍决定语义角色、构图与阶段。数值参考由独立检查器从 brief 重算。绕过接口的原始 Canvas 绘图、稀疏像素探针之外的区域、解释和艺术质量都需要另外审查。详见 [接口文档](../../../docs/math-evidence.md)。

## 原样重放全部候选

每条保留原 brief、全部模型版本、源哈希、新技术检查、6 张抽帧、全视频与未赋予艺术通过的审看状态。[candidate-index.json](candidate-index.json)列出输入与版本路径；[plan.json](plan.json)记录重放范围，tooling/ 与 hashes 保存当时工具版本。媒体留在 ignored work/。

| 候选 | 旧导出 | 新技术状态 | 指数条形 checked / unavailable / transient | 视频 / 抽帧 |
|---|---|---|---|---|
| residual-1-A | 失败 | 失败保留 | — | [视频](/home/yang-zhi/文档/ChatGPT/concept2motion/work/render-evidence-v2/residual-1-A/video.mp4) · [抽帧](/home/yang-zhi/文档/ChatGPT/concept2motion/work/render-evidence-v2/residual-1-A/contact.jpg) |
| residual-1-B | 失败 | 失败保留 | — | [视频](/home/yang-zhi/文档/ChatGPT/concept2motion/work/render-evidence-v2/residual-1-B/video.mp4) · [抽帧](/home/yang-zhi/文档/ChatGPT/concept2motion/work/render-evidence-v2/residual-1-B/contact.jpg) |
| residual-1-C | 失败 | 失败保留 | — | [视频](/home/yang-zhi/文档/ChatGPT/concept2motion/work/render-evidence-v2/residual-1-C/video.mp4) · [抽帧](/home/yang-zhi/文档/ChatGPT/concept2motion/work/render-evidence-v2/residual-1-C/contact.jpg) |
| residual-1-D | 有 | 通过 | — | [视频](/home/yang-zhi/文档/ChatGPT/concept2motion/work/render-evidence-v2/residual-1-D/video.mp4) · [抽帧](/home/yang-zhi/文档/ChatGPT/concept2motion/work/render-evidence-v2/residual-1-D/contact.jpg) |
| residual-2-A | 失败 | 失败保留 | — | [视频](/home/yang-zhi/文档/ChatGPT/concept2motion/work/render-evidence-v2/residual-2-A/video.mp4) · [抽帧](/home/yang-zhi/文档/ChatGPT/concept2motion/work/render-evidence-v2/residual-2-A/contact.jpg) |
| residual-2-B | 失败 | 失败保留 | — | [视频](/home/yang-zhi/文档/ChatGPT/concept2motion/work/render-evidence-v2/residual-2-B/video.mp4) · [抽帧](/home/yang-zhi/文档/ChatGPT/concept2motion/work/render-evidence-v2/residual-2-B/contact.jpg) |
| residual-2-C | 失败 | 失败保留 | — | [视频](/home/yang-zhi/文档/ChatGPT/concept2motion/work/render-evidence-v2/residual-2-C/video.mp4) · [抽帧](/home/yang-zhi/文档/ChatGPT/concept2motion/work/render-evidence-v2/residual-2-C/contact.jpg) |
| residual-2-D | 有 | 通过 | — | [视频](/home/yang-zhi/文档/ChatGPT/concept2motion/work/render-evidence-v2/residual-2-D/video.mp4) · [抽帧](/home/yang-zhi/文档/ChatGPT/concept2motion/work/render-evidence-v2/residual-2-D/contact.jpg) |
| softmax-1-A | 有 | 失败保留 | 0 / 9 / 0 | [视频](/home/yang-zhi/文档/ChatGPT/concept2motion/work/render-evidence-v2/softmax-1-A/video.mp4) · [抽帧](/home/yang-zhi/文档/ChatGPT/concept2motion/work/render-evidence-v2/softmax-1-A/contact.jpg) |
| softmax-1-B | 有 | 失败保留 | 0 / 0 / 9 | [视频](/home/yang-zhi/文档/ChatGPT/concept2motion/work/render-evidence-v2/softmax-1-B/video.mp4) · [抽帧](/home/yang-zhi/文档/ChatGPT/concept2motion/work/render-evidence-v2/softmax-1-B/contact.jpg) |
| softmax-1-C | 有 | 失败保留 | 0 / 9 / 0 | [视频](/home/yang-zhi/文档/ChatGPT/concept2motion/work/render-evidence-v2/softmax-1-C/video.mp4) · [抽帧](/home/yang-zhi/文档/ChatGPT/concept2motion/work/render-evidence-v2/softmax-1-C/contact.jpg) |
| softmax-1-D | 有 | 通过 | 0 / 9 / 0 | [视频](/home/yang-zhi/文档/ChatGPT/concept2motion/work/render-evidence-v2/softmax-1-D/video.mp4) · [抽帧](/home/yang-zhi/文档/ChatGPT/concept2motion/work/render-evidence-v2/softmax-1-D/contact.jpg) |
| softmax-2-A | 失败 | 失败保留 | 0 / 0 / 9 | [视频](/home/yang-zhi/文档/ChatGPT/concept2motion/work/render-evidence-v2/softmax-2-A/video.mp4) · [抽帧](/home/yang-zhi/文档/ChatGPT/concept2motion/work/render-evidence-v2/softmax-2-A/contact.jpg) |
| softmax-2-B | 有 | 失败保留 | 0 / 9 / 0 | [视频](/home/yang-zhi/文档/ChatGPT/concept2motion/work/render-evidence-v2/softmax-2-B/video.mp4) · [抽帧](/home/yang-zhi/文档/ChatGPT/concept2motion/work/render-evidence-v2/softmax-2-B/contact.jpg) |
| softmax-2-C | 有 | 失败保留 | 4 / 0 / 5 | [视频](/home/yang-zhi/文档/ChatGPT/concept2motion/work/render-evidence-v2/softmax-2-C/video.mp4) · [抽帧](/home/yang-zhi/文档/ChatGPT/concept2motion/work/render-evidence-v2/softmax-2-C/contact.jpg) |
| softmax-2-D | 有 | 通过 | 0 / 9 / 0 | [视频](/home/yang-zhi/文档/ChatGPT/concept2motion/work/render-evidence-v2/softmax-2-D/video.mp4) · [抽帧](/home/yang-zhi/文档/ChatGPT/concept2motion/work/render-evidence-v2/softmax-2-D/contact.jpg) |

## 新绘图接口：实际正负对照

四个手写回归源并非模型输出或已通过教学审查的样例。先保存 [预期](helper-plan.json)，再导出；两次运行均满足 4/4 预期，全部视频完整解码。第二次使用仓库内可重复执行的 harness，四并行用时 4.367 秒。数字只说明本地控制的工程行为，不等于四条高质量生成作品。

| 控制 | 预期与实际 |
|---|---|
| Softmax 正确比例 | render_passed |
| 残差带符号向量及逐分量和 | render_passed |
| 指数条形加固定宽度偏置 | checks_failed / wrong_mass_geometry |
| 登记正确后覆盖实际像素 | checks_failed / pixel_mismatch |

作者在这些控制中没有手写 bounds/geometry 字典，阶段、输入和语义角色仍显式给出。fixture-sources/ 保存输入与源码；[第一次结果](helper-results.json)、[可重复运行结果](helper-repeat.json)包含源哈希、检查、媒体路径及技术审查类型。第二次只是同源复跑，不增加独立样本。

```bash
python3 tools/replay_math_frame.py --out runs/math-frame-controls-01
```

渲染环境复用现有 Playwright/Chromium/FFmpeg，未新安装依赖。首次固定目录的 16 候选回放由 tooling/replay_evidence.py 执行；它拒绝覆盖，需为新回放更换输出版本路径。

## 验证类型与历史结论

- 安装检查：复用已配置工具，没有新安装实验。
- 单元/模拟工作流：Python 58 个测试通过；Node 的 4 个测试文件通过。新增 5 项证据单元测试包括缺失注册表、无效探针、错误比例、不可检查状态与负向向量；它们使用模拟 Canvas，不冒充真实渲染。
- 实际渲染：16 条旧模型候选各一次完整重渲染；另有 4 个手写控制各运行两次。
- 本次真实模型生成：0 次；新强模型独立审查：0 次。
- 画面检查：实现者非盲查看恢复的 residual-1-C 的 11/17 秒及 Softmax-2-A 的 14 秒画面，确认非空且仍有排版缺陷。仅抽帧检查，[观察记录](visual-observations.json)不赋予艺术通过，不推断观众理解率。

原 [v1 模型对照](../../2026-10-02/model-infra-pilot-v1/REPORT.md)结论保持：C 对 B 0 胜、2 负、2 不可比较。不能用这次补导出替换历史裁判所看的附件或把失败倒填成成功。报告生成器已改为验证冻结的历史工具，而不是要求旧工具与当前工具相同；重新生成历史报告仍输出上述结论。

接下来应建立新版本模型对照，将相同绘图接口提供给所有组，再隔离 C 的检查反馈收益；共同提示、输入、修订预算与评测顺序先冻结。若要测绘图接口本身的收益，须另设同预算对照。当前证据还不足以说 infra 让弱模型的动画变好。
