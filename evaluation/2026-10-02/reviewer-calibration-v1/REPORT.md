# 自动视觉评价器：负对照筛查 v1

本轮 4 个可控样例、每个 2 次审查全部得到预先冻结的标签：三个判定维度各 8/8 匹配、0 未知；三个负对照共 6 次审查没有被完整接受。它只能支持“该评价器能识别本轮显著的图形缺失、几何矛盾和声明顺序违背”。**baseline 仍未确认，观众理解和艺术质量仍未得到验证。**

## 测试对象与冻结规则

使用手写 Manim 图形测试片，而非模型生成的优质动画。相同矩阵 A=[[2,1],[0,1]]、输入 v=(1,2)，真实结果 Av=(4,2)。每片 12 秒，6 页、每页 2 秒，以硬切换呈现。本轮不检验平滑运动或叙事节奏。

| ID | 可控干预 | 几何证据 | 几何与文字一致性 | 声明顺序 |
|---|---|---|---|---|
| K7 | 正确构造参考 | demonstrated | consistent | coherent |
| M2 | 去掉全部图形，保留正确文字 | assertion_only | unverifiable | unverifiable |
| P9 | 绿色结果落在 (3,2)，标签仍写 (4,2) | demonstrated | inconsistent | coherent |
| R4 | 顺序变为检查、基向量像、结果、输入、组合、原基向量 | demonstrated | consistent | out_of_order |

P9 的 demonstrated 仅表示存在可观察的构造证据；正确性单独由 consistency 检验。M2 的文字序列仍存在，但 rubric 限定检查几何序列，所以 order 预设为 unverifiable。R4 违反画面明确声明的先后顺序；不能据此断言倒叙教学本身无效。

[预设标签](oracle.json)、[审查提示词](prompt.txt)、[响应结构](schema.json)、[源快照](sources/review_controls_scene.py) 与联系表 SHA256 均在审查前冻结；[运行配置](run-config.json) 保存摘要。输出后未改提示词、样例或标签，未重试以寻求通过。

每次官方 Codex CLI 调用只附一张联系表，独立临时上下文、只读沙箱。模型 gpt-6.1-sol，reasoning=low，最多 4 个并行进程、每次上限 300 秒。没有使用 subagent。审查器看到通用 rubric、画面文字和不表达样例类别的 ID，不看到源码、预设标签、其他样例、生成者评价。此次是对控制类别和答案表的盲审，**不是对数学主题或文字公式的盲审**。

每片抽帧时刻为 0.75、2.75、4.75、6.75、8.75、10.75 秒；15fps 实际解码帧对应时间另记于 [stimuli.json](stimuli.json)。单张联系表 1708×1524。要求引用所附时刻的具体画面，禁止调用工具；8 次实际调用均无工具记录。失败、超时、工具污染、非法结构或无有效帧证据均记为 unknown，不视为通过。

## 实际结果

| ID | 重复 | 几何证据 | 几何与文字一致性 | 声明顺序 |
|---|---|---|---|---|
| K7 | 1 | demonstrated | consistent | coherent |
| K7 | 2 | demonstrated | consistent | coherent |
| M2 | 1 | assertion_only | unverifiable | unverifiable |
| M2 | 2 | assertion_only | unverifiable | unverifiable |
| P9 | 1 | demonstrated | inconsistent | coherent |
| P9 | 2 | demonstrated | inconsistent | coherent |
| R4 | 1 | demonstrated | consistent | out_of_order |
| R4 | 2 | demonstrated | consistent | out_of_order |

[逐项汇总](summary.json) 与 [全部审查记录](outcomes.json) 保留原始结构化回答与安全的调用统计。两个重复的所有判定均一致，不能由两个重复估计稳健方差。

具体证据：

- K7 两次均指出 6.75s 分量链沿 (2,0)、(3,1) 到达 (4,2)，10.75s 与绿色结果端点重合。
- M2 两次均指出 6.75s 声称组合蓝色和橙色分量，却没有对应箭头；8.75s 没有可核对的几何端点。
- P9 两次均读出 8.75s 绿色端点 (3,2) 与标签 (4,2) 矛盾；10.75s 分量终点 (4,2) 与绿色终点分离。这是几何核对的证据，而非仅识别正确公式。
- R4 两次均指出 0.75s 已有组合和结果，6.75s 才出现输入；与标题声明次序不符。

## 验证层次、耗时与局限

- 安装：复用此前隔离安装的 Manim 0.19.0 环境；本轮没有安装或重新检验上游依赖。
- mock：没有以 mock 模型充当真实审查。测试中的失败记账和非法时间证据用本地单元测试验证。
- 实际渲染：4 片共 48 秒、720 帧全部解码；24 张抽帧，实际渲染耗时 8.131 秒。
- 真模型生成：本轮 0 次，样例手写；上一轮 Code2Video 的真实生成是另一项实验。
- 真模型视觉审查：本轮 8 次，全部完成；安全统计见 [cost.json](cost.json)。
- 艺术审看：当前代理查看了四张联系表，非盲；部分共同字幕贴近或略越过左边缘，未授予美术合格结论。独立模型只检查限定几何维度，未评艺术完成度。
- 代码验证：55 项 Python 测试通过，包括新增的“非法/非有限时间不能充当帧证据”“失败不能算通过”“缺少案例不能算完整实验”回归。

模型调用时长合计 425.898 秒，是重叠调用的时长之和，**不是批次实际等待时间**；每次 45.935–58.908 秒。批次整体用时未单独计时。CLI 报告 input tokens 149696、output tokens 3885，含 CLI 上下文；不等同于论文 API 成本，也不换算订阅费用。

本轮错误显著、坐标明确，样本窄且与 rubric 同源。两个重复共享模型、提示词和同一图像，相关性高。固定调用队列，没有跨模型验证或人类理解数据。静态抽帧不能评价帧间连续性、运动机制、短暂错误、注意力或实际学习；结果不能外推到无坐标的复杂动画。文本与公式提供大量先验线索，主题复述不作为独立理解证据。

因此可以把该 rubric 用作**这些限定缺陷的初步诊断**；不能设为通用自动质量准入门槛。下一步应另建未用于调整 rubric 的困难样例：文字遮蔽、机制省略、较细微几何错误，以及固定输入上的直接提示词与借鉴流程重复生成。保留每次失败和修订预算，分别比较证据覆盖、数学错误、耗时及修改次数。若需要声称“人能看懂”，仍需外部盲审者或观看后答题数据，不能用同一模型自评分替代。

## 复核与产物

[每个样例的输入、源、数学检查、渲染、抽帧、审查和初始修订记录](candidates.json)；视频与模型原始日志在 ignored work/，不进入 Git。联系表只含本轮自行制作的数学图形。调用通过已登录官方 Codex 服务，未提取登录凭据。

从仓库根目录复核现有冻结产物：

```bash
python3 -c "import sys; sys.path.insert(0, 'tools'); import calibrate_review as r; r.check_frozen()"
python3 tools/calibrate_review.py summarize
python3 -m unittest discover -s tests -p 'test_*.py'
```

prepare/run 阶段拒绝覆盖已有实验。新实验必须使用新版本目录；不可直接删除旧调用再当作同一次试验重跑。渲染需调用 code2video_pilot.environment() 指定的本地依赖。已有8次审查不要再次调用。

- K7：[视频](/home/yang-zhi/文档/ChatGPT/concept2motion/work/reviewer-calibration-v1/media/videos/review_controls_scene/480p15/ProbeK7.mp4) · [联系表](/home/yang-zhi/文档/ChatGPT/concept2motion/work/reviewer-calibration-v1/stimuli/K7/contact.png)

- M2：[视频](/home/yang-zhi/文档/ChatGPT/concept2motion/work/reviewer-calibration-v1/media/videos/review_controls_scene/480p15/ProbeM2.mp4) · [联系表](/home/yang-zhi/文档/ChatGPT/concept2motion/work/reviewer-calibration-v1/stimuli/M2/contact.png)

- P9：[视频](/home/yang-zhi/文档/ChatGPT/concept2motion/work/reviewer-calibration-v1/media/videos/review_controls_scene/480p15/ProbeP9.mp4) · [联系表](/home/yang-zhi/文档/ChatGPT/concept2motion/work/reviewer-calibration-v1/stimuli/P9/contact.png)

- R4：[视频](/home/yang-zhi/文档/ChatGPT/concept2motion/work/reviewer-calibration-v1/media/videos/review_controls_scene/480p15/ProbeR4.mp4) · [联系表](/home/yang-zhi/文档/ChatGPT/concept2motion/work/reviewer-calibration-v1/stimuli/R4/contact.png)
