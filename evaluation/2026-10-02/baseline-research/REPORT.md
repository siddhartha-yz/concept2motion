# concept2motion baseline 调研

核查日期：2026-10-02。结论是有现成的生成方法、任务集和评测组件，应该先复用；本轮检索中没有确认一个同时覆盖概念理解、视觉完成度、局部修订质量与迭代成本的完整 benchmark。

本轮仅做 primary paper、公开数据说明和固定版本源码审查。没有新安装检查、mock 测试、实际渲染、真实模型生成、艺术审看或 benchmark 跑分。公开结果属于作者报告，不能写成本项目复现结果。第三方源码保存在 ignored `work/`，未改上游，未下载远程视频来代替观看。

## 优先复现的对象

| 对象 | 可借用的现成资产 | 实际公开程度与限制 | 本项目角色 |
| --- | --- | --- | --- |
| [ShowLab Code2Video](https://github.com/showlab/Code2Video) / [MMMC](https://huggingface.co/datasets/YanzheChen/MMMC) | 知识点→Manim 的 Planner/Coder/Critic；局部修复、视觉锚点；TeachQuiz、AES、时间/token 评测 | 已核实117主题与评测源码；不是全部论文实验的一键 runner，路径和题数存在发布差异 | **教育概念生成的首选外部方法 baseline** |
| [TheoremExplainAgent](https://github.com/TIGER-AI-Lab/TheoremExplainAgent) | 240个定理任务；重试、RAG、视觉修复开关与评测代码 | 任务JSON实际读取确认；第三方模型、TTS、Manim依赖；不应将视频生成成功率解释为学生理解率 | 第二个教育解释 baseline，检验规划与视觉反馈 |
| [HeyGen Code2Video public](https://www.kaggle.com/datasets/heygen/code2video-public) | 50个公开短动画任务、人工参考视频；Harbor single-shot、verifier、Elo脚本的发布说明 | 本轮核实数据卡与文件浏览器，v5；完整报告168题。实际server源码已读：需HeyGen API与GCS；运行、API资格和价格未验证 | **视觉完成度与节奏的补充任务集**，不是教学理解评分 |
| [ManimTrainer / ManimAgent](https://github.com/SuienS/manim-trainer) | base / RITL / RITL-DOC 现成消融；描述/源码数据；参考视频比较器 | 推理反馈实际只有渲染错误与API文档；成功即停，不读取视频。当前代码偏本地HF/CUDA | **快速、窄范围的反馈循环对照协议** |
| [InternSVG / SArena](https://github.com/hmwang2002/InternSVG) | SVG动画生成、编辑任务，显式时间渲染与评测 | 编辑任务不等于连续自迭代轨迹；须单列动画与静态SVG子集 | 局部编辑与运动保持的补充，而非完整概念解释 |

ShowLab 与 HeyGen 是两个不同的 Code2Video 项目：前者关注教学知识点，后者关注商业 motion design。不能合并它们的数据、排行榜或效果声明。

## 论文能支持什么

[Code2Video 论文](https://arxiv.org/abs/2510.01174)最直接对应“观众能否获得知识”。其 TeachQuiz 用模型在不同视频条件下答题，论文另有多人答题实验。但源码中的 unlearning 是提示词要求忽略先验知识，并未改变模型权重；模型仍可能靠自身知识答对。因此可以复用任务与问题，自动答题分数只能作为代理指标。AES 是模型评分，也不能单独证明解释清楚。

论文人评是5组、每组8人，共40人，观看20个主题并答题；可作为离开单人审看的研究先例。各组视频长度不同，且论文所报美学与答题相关性不能直接解释为每条视频评分的可信度。公开题目文件实际为每主题5题，共585题，与论文自动评测每主题10题的描述有差异。既有独立脚本与完整论文对照复现应分开。

[TEA 的 ACL 最终版](https://aclanthology.org/2025.acl-long.332/)提供教学视频生成与修复的现成对照。论文的人机评分相关性在部分维度较弱；高视频生成成功率证明流程能产出完整文件。它没有据此证明观众学会了定理。

[ManimTrainer 论文](https://arxiv.org/abs/2604.18364v2)研究训练与推理消融，使用 Manim 文档的短代码示例。视觉指标比较参考视频的 SSIM/CLIP，代码指标比较参考源码。它适合衡量基本API能力与报错修复，不宜推断长篇叙事或概念传达。

[Animation2Code](https://arxiv.org/abs/2606.28593)将外观相似度与运动相似度分开，项目报告用多人偏好验证指标。它的任务是参考视频重建，不是无参考概念解释。检查时[项目页](https://anya-ji.github.io/animation2code-website/)仍显示代码和数据待发布，因此目前列为方法参考与待发布项。

[HeyGen 技术报告](https://www.heygen.com/research/introducing-code2video-benchmark)把偏好分成 engagement、prompt intent、composition、temporal、craft，报告训练过的 Judge 与人类偏好一致性。公开数据卡却将评测称为 pairwise VLM judging。已读的公开 `server/server.py` 是请求 HeyGen comparison API 的批处理代理，需 `HEYGEN_API_KEY` 与 GCS 配置；不是本地裁判权重。API资格、费用和复现报告数字的条件尚未验证，也不能直接用Codex订阅替代该裁判。其题材是产品宣传，不回答数学理解问题。

[Teaching Monster Challenge](https://arxiv.org/abs/2608.08852)更直接涉及教学评测：研究报告59名参与者的246个配对比较与10名专家的最终排序，另有组织者baseline。论文明确区分教学质量代理与学生学习增益。已审查的公开baseline有幻灯片生成与图像review/refine，但review异常可能被默认满分放行；完整任务包、人工判断数据及当前代码许可尚未确认。因此值得借鉴外部人评设计，不能宣称完整评测已可复现。

## 不优先投入复现的项目

- [VisualEDU](https://aclanthology.org/2025.findings-emnlp.889/)有教学动画和反馈研究价值，但检查的公开源码存在裸赋值语法错误、缺失模块和 Windows 绝对路径。完整数据是大体积 LFS 资产，本轮未下载。修复公开包需要单列工作量，不能声称开箱运行。
- ALGOGEN 的可验证执行轨迹很适合“数学机制是否正确”的检查；已找到部分公开实现，但论文完整任务集和比较方法的可复现程度仍有缺口。机制正确与解释易懂应分别衡量。
- [Manimator](https://github.com/HyperCluster-Tech/manimator) 有多份同名仓库，必须按论文作者链接确定对应实现。对应论文的实现是场景描述→Manim代码的两阶段提示词，适合作为简单生成控制组；公开评测资产不完整，未见视觉修订或代码失败自修循环。
- [Math-To-Manim](https://github.com/HarleyCoops/Math-To-Manim) 当前有官方Codex SDK/ChatGPT登录桥接及证据留存，是本项目订阅工作流的具体工程参考。但完整管线还强制初始化独立Jev reviewer密钥；它不是完全零额外API的现成系统，也未确认比较实验能证明艺术或理解质量提升。
- Paper2Manim 已有本仓库前期审查与实验记录；目前不宜作为唯一参照系。其流程复杂度或运行成功本身不能证明比直接生成更好。
- VBench、VBench-2、VideoScore 等自然视频质量指标可以辅助检查运动或画面，不能直接做“概念讲清楚了”的总分。
- [EditBoard](https://arxiv.org/html/2409.09668v1)有自然视频编辑的人类偏好验证，值得借用“指定修改是否完成”和“其他内容是否保留”分开的原则；其模型、数据和评分不是数学代码动画的直接 baseline。
- VidCode 搜索发现了相关450任务论文，但直接全文访问受到验证页阻挡，未确认官方数据/代码发布；不列为已可运行项。
- [realtime-manim-rs](https://github.com/adamholter/realtime-manim-rs)是可能有价值的运行时替代；本轮仅看说明，性能与兼容性声明未经本机验证。它不是生成质量 baseline。
- [generative-manim benchmark](https://github.com/marcelo-earth/generative-manim/blob/main/training/benchmarks/README.md)有冻结任务和执行检查，但当前评分以渲染、源码pattern和动画调用数为主，更适合工程可靠性。
- [LessonBench-V1](https://arxiv.org/abs/2607.13041)可提供教学目标与讲解任务素材；本轮仅核实 primary 摘要及数据页，不应当作动画理解 ground truth。

## 需要避免的名称混淆

至少三个不同项目使用近似名称，不能共用结果：

1. `SuienR/ManimBench-v1`：417条Manim文档描述/源码，317训练、100测试；ManimTrainer使用。
2. `NtrpyDev/manim-bench`：独立评测引擎，AST要求、视频sanity、layout probes。
3. `nabin2004/ManiBench`：小规模研究pilot，源码substring/API正则对齐与覆盖指标。

后两者的核查记录见旁边的 `research-benchmarks.json`。名称相近不代表同一论文数据集。

## 对下一轮实验的建议

先完成 Code2Video 的小规模独立复现与发布缺口清单，再决定是否采用其方法。已有的题目、问题和参考视频可以复用，不急着另造一套题。

将比较拆成两层，结果分别报告：

1. **外部方法参照**：原版 Code2Video / TEA 在其支持的模型和运行条件下。改变模型、调用方式、题目时明确标为协议移植；不能冒称复现论文数字。
2. **infra价值的公平比较**：同一模型、brief、预算、渲染和观察权限下，普通生成+反馈循环与本项目infra对照。ManimAgent现成的direct、错误反馈、文档反馈消融适合借用；额外的视觉反馈应单列。直接生成也应拥有公平的修改机会。

目前已有任务集分别回答“讲什么”“像不像”“是否能改”，仍需补上少量独立观众的理解校准，以及固定预算下质量随每轮修订的变化、修订耗时、未修改部分的保持程度。这部分是本项目需验证的研究缺口，不能用更多模型裁判或源码通过率替代。

本轮建议的顺序是 **Code2Video/MMMC → HeyGen公开任务的可运行性核验 → SArena编辑子集**。训练权重、替换运行时和大型agent平台都应等到上述对照显示具体瓶颈后再决定。

## 审查证据索引

- `../research-reference.json`：教育视频方法、论文与固定版本源码审查。
- `../research-benchmarks.json`：VisualEDU、ALGOGEN与近似名称的评测项目。
- `../research-evaluation.json`：动画/编辑任务、自然视频评测与人类校准证据。
- `../research-motion-code.json`：主线程核查的近期motion/code研究；ManimTrainer固定版本 `44eeb77438313411ab5b3cf5a4756102ead6d89a`。

本报告的排序与下一步建议属于本项目判断；论文结果及公开包观察分别注明来源与核查范围。
