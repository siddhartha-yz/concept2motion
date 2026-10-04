# 借鉴的项目，究竟复现到哪一步

核对日期：2026-10-04。**我们做过部分复现，但没有完整复现过任何一篇论文的核心实验成绩。**“读过代码”“成功渲染”“调用过模型”“质量提升”分别记，不合并成一个完成率。原作者仓库里的结果文件也不是我们的复现结果。

## 已经实际执行过的六个项目

| 项目与固定提交 | 我们实际做了什么 | 还缺什么 | 本地证据 |
|---|---|---|---|
| [Paper2Manim](https://github.com/jwj1342/Paper2Manim/tree/d7e5a310c11a4071ff5e2f7bd0042ac36ce43359) `d7e5a31` | 安装；350 个测试通过、33 个跳过；原沙箱真实渲染一个手写 Softmax 场景，171 帧完整解码；真实错误注入 | 原作者生成、VLM 修改和记忆流程没跑；无原论文质量/成本对照 | [首次复现](../evaluation/2026-10-01/REPORT.md) |
| [OpenMotion](https://github.com/Yuan-ManX/open-motion/tree/1c93d99b064e8674f244a8f24227358ec6f61618) `1c93d99` | 安装；9 项原组件检查；浏览器实际画面与原录帧器运行 | 完整应用启动失败；19 个 TypeScript 错误；12 秒录帧导出为 17.6 秒；无 AI 生成 | [首次复现](../evaluation/2026-10-01/REPORT.md) |
| [ShowLab Code2Video / TeachQuiz / AES](https://github.com/showlab/Code2Video/tree/1142d8e14cdc2806df85aedb0fbb5dca474caa0f) `1142d8e` | 安装和原流程模拟；替换为官方 Codex 生成 6 节、真实渲染；原评分代码 14 项模拟控制；本轮 AES 4/12 有实际裁判结果 | 更换了生成/裁判模型，曾串行渲染和显式救回视频路径；TeachQuiz 实际答题、完整 AES 视频输入及人类学习研究未完成 | [生成改编](../evaluation/2026-10-02/code2video-pilot/REPORT.md)、[评分反例](../evaluation/2026-10-04/metric-replay-v1/REPORT.md)、[本轮](../evaluation/2026-10-04/reproduction-status-v1/REPORT.md) |
| [abstract-algebra-promo](https://github.com/AnctyEnly453/abstract-algebra-promo/tree/5d01a758af8b4b3b7bb5a2a5b7f0efb4cf1667eb) `5d01a75` | 检查原源码、11 个时点及两段连续动画；通过原 `__frame(t,fps)` 实际重渲染 | 仅片段、降低帧率、静音且字体有回退；没有完整作品/观众理解复现 | [参考机制](../evaluation/2026-10-01/reference-mechanisms/REPORT.md)、[表达记录](communication.md) |
| [TheoremExplainAgent / TheoremExplainBench](https://github.com/TIGER-AI-Lab/TheoremExplainAgent/tree/e9ece5db7756b6ded8a812eceeb936cfd02aae21) `e9ece5d` | 本轮执行原公式、抽帧及降帧函数；核对 240 项资产；原单帧提示词换 Codex 裁判，4/12 有结果 | 未完整安装/执行生成器；未用原模型；文本、视频、完整关键帧及五项总分支路未完成；无人机相关性复验 | [本轮执行与失败](../evaluation/2026-10-04/reproduction-status-v1/REPORT.md) |
| [PhyEduVideo](https://github.com/meghamariamkm/PhyEduVideo/tree/5a36a13818552095c9ed12c6562f236d5b5011bd) `5a36a13` | 本轮执行原均匀抽帧、取中帧函数；核对 60 个概念及 205 个教学点的题集 | 未完整安装；CLIP/VQAScore/InternVideo/InternVL 权重及配置未准备；没有任何神经评分、物理生成或论文人类验证复现 | [本轮执行](../evaluation/2026-10-04/reproduction-status-v1/REPORT.md) |

TEA 和 PhyEduVideo 的原函数从固定源码中抽取后执行，绕开会加载权重、访问服务的顶层代码。源码本身没有改写。这是**原函数的局部执行**，不能叫整套程序已经跑通。

## 其余参考：当前仍未执行实验

以下来自既有一手材料核查，不表示本轮重新检查了它们是否有新发布。完整固定提交与来源在[机器清单](../evaluation/2026-10-04/reproduction-status-v1/reference-inventory.json)。

| 参考 | 已做的程度 | 下一步/限制 |
|---|---|---|
| [Manimator](https://github.com/HyperCluster-Tech/manimator) | 固定源码与论文核查 | 安装、原生成与评价未跑；若换 Codex，要另记改编 |
| [Math-To-Manim](https://github.com/HarleyCoops/Math-To-Manim) | 固定源码核查 | 安装、规划和修改循环未跑；不假定论文成绩 |
| [Teaching Monster](https://github.com/Teaching-Monster/TeachingMonster-released) | 固定源码与论文核查 | 公开评价资产、许可仍有缺口；GPU TTS、原 provider 和人评未复现 |
| [VisualEDU](https://github.com/UchihaIchigo/VisualEDU) | 固定源码、论文核查 | 安装、生成和学习评价未跑 |
| [ALGOGEN](https://github.com/algenlab/algogen_anonymous) | 固定源码、论文核查 | 安装、算法生成及原评价未跑 |
| [ManiBench（nabin2004）](https://github.com/nabin2004/ManiBench) | 固定源码核查 | 未跑本仓库的模型基准；上游保存的成绩不归我们 |
| [manim-bench（NtrpyDev）](https://github.com/NtrpyDev/manim-bench) | 固定源码核查 | 未跑模型题集；与其他同名基准分开 |
| [ManimTrainer / ManimAgent](https://github.com/SuienS/manim-trainer) | 固定源码、题集规模核查 | 本地 HF/CUDA 推理与训练未跑；417 项中 317/100 为作者划分，不是本项目结果 |
| [InternSVG / SArena](https://github.com/hmwang2002/InternSVG) | 固定源码、论文核查 | 权重、生成及原评分未跑；SVG 静态任务与动画有边界 |
| [EditBoard](https://github.com/Samchen2003/EditBoard) | 固定源码、论文核查 | 未跑图像编辑评价；不能替代数学机制评价 |
| [VideoScore v1/v1.1](https://github.com/TIGER-AI-Lab/VideoScore) | 固定源码、论文核查 | 权重推理未跑；v2 未核查，不能合并 |
| [VBench-2.0](https://github.com/Vchitect/VBench) | 固定源码、论文核查 | CUDA/权重及各项评价未跑 |
| [HKUDS VideoAgent / VideoEdit](https://github.com/HKUDS/VideoAgent) | 固定源码、论文核查 | 评价标签/资产完整性未确认；provider 和媒体工具未执行 |
| [HeyGen Code2Video](https://www.kaggle.com/datasets/heygen/code2video-public) | 公开 v5 的 50 任务/409 文件及服务器预览核查 | 未下载/运行；原评分需要 HeyGen 服务与 GCS 配置，未授权购买；与 ShowLab 分开 |
| [Animation2Code](https://arxiv.org/abs/2606.28593) | 论文与项目页核查 | 既有核查时未定位可运行的完整发布；本轮未更新发布状态 |
| [LessonBench-V1](https://www.kaggle.com/datasets/ravidussilva/lessonbench-v1) | 原论文与数据集存在性核查 | 647 篇/240 主题为作者资产描述；未下载、生成或评价 |
| [EditBench](https://imagen.research.google/editor/) | 原论文/官方页面核查 | 图像修补基准；未跑，不当作动画质量基准 |
| [EduVideoBench](https://arxiv.org/abs/2605.26918v1) | 论文评价公式核查 | 未定位并执行完整公开评价器 |
| [RLM](https://github.com/alexzhang13/rlm) / [Harness 文章](https://alexzhang13.github.io/blog/2026/harness/) | 方向参考 | 未固定代码、运行或训练；此轮不扩建递归代理平台 |
| [realtime-manim-rs](https://github.com/adamholter/realtime-manim-rs) | README 核查 | 未固定源码/安装/测速 |
| [generative-manim](https://github.com/marcelo-earth/generative-manim) | 基准 README 核查 | 未固定源码/跑题集；工程通过率不等于讲懂 |
| VidCode | 部分一手来源核查受阻 | 没有已核实的完整官方代码/数据入口，不能声称可复现 |
| VideoEditBench（精确名字） | 名称与入口未核实 | 不与 VideoEdit 或 EditBoard 混同 |
| SVGEditBench V2 | 未核读实际官方评价器 | 不列为已经可运行的基准 |

## 接下来怎么把复现做完整

每个项目都按同一顺序补证据：固定提交和输入 → 安装/入口 → 原流程模拟 → 实际渲染 → 实际模型与原评价 → 对照及论文要求的人评。若改了模型、输入形式或调度，单独登记改编，保留失败。没有原权重、原服务或人评时，完整论文复现继续标为未完成。

当前先补评价方案的控制覆盖，再跑评价驱动修改和未见任务。本轮裁判只覆盖四个残差控制，Softmax 和其余事实没有结果，不能进入“评分已经可靠”的阶段。新调用须有新的实验额度及可用账号额度，并使用连续失败停止的保护。

随后优先补 Code2Video 的真实 TeachQuiz 三阶段和 TEA 完整评价支路；PhyEduVideo 先列出固定权重、缺失配置和本机驱动条件，再决定本地能跑的项。其他代码生成基线按清单逐项执行；需要额外服务、不可得资产或模型权重的项目明确留在待办，不靠一个改编小样本宣布全部复现。

## 固定源码怎么取回

本轮 TEA/PhyEduVideo 的文本文件可按归档的 Git blob 和 SHA256 重建到忽略目录，不会下载权重或视频：

```bash
python3 tools/fetch_reference_sources.py
python3 tools/fetch_reference_sources.py --verify-only
```

新取回工具已在现有 42 个文件上验证；从空目录重新下载尚未使用这份公开工具执行，本轮实际获取记录来自其前身脚本。实验 v1 的设计、响应与失败是历史证据，不覆盖。重跑实验须新建版本和冻结记录，不能直接修改 v1 或沿用其已用完的预算。
