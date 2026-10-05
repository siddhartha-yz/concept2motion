# 借鉴的项目，究竟复现到哪一步

核对日期：2026-10-06。**我们做过部分复现，但没有完整复现过任何一篇论文的核心实验成绩。**“读过代码”“成功渲染”“调用过模型”“质量提升”分别记，不合并成一个完成率。原作者仓库里的结果文件也不是我们的复现结果。

## 已经实际执行过的项目（包括失败）

| 项目与固定提交 | 我们实际做了什么 | 还缺什么 | 本地证据 |
|---|---|---|---|
| [Paper2Manim](https://github.com/jwj1342/Paper2Manim/tree/d7e5a310c11a4071ff5e2f7bd0042ac36ce43359) `d7e5a31` | 安装；350 个测试通过、33 个跳过；原沙箱真实渲染一个手写 Softmax 场景，171 帧完整解码；真实错误注入 | 原作者生成、VLM 修改和记忆流程没跑；无原论文质量/成本对照 | [首次复现](../evaluation/2026-10-01/REPORT.md) |
| [OpenMotion](https://github.com/Yuan-ManX/open-motion/tree/1c93d99b064e8674f244a8f24227358ec6f61618) `1c93d99` | 安装；9 项原组件检查；浏览器实际画面与原录帧器运行 | 完整应用启动失败；19 个 TypeScript 错误；12 秒录帧导出为 17.6 秒；无 AI 生成 | [首次复现](../evaluation/2026-10-01/REPORT.md) |
| [ShowLab Code2Video / TeachQuiz / AES](https://github.com/showlab/Code2Video/tree/1142d8e14cdc2806df85aedb0fbb5dca474caa0f) `1142d8e` | 安装和原流程模拟；替换为官方 Codex 生成 6 节、真实渲染；原评分代码 14 项模拟控制；跨两批 AES 11/12 有实际裁判结果 | 更换了生成/裁判模型，曾串行渲染和显式救回视频路径；TeachQuiz 改编三阶段已补齐15个响应（共18尝试），画面后一题格式无效，严格增益不可报告；完整AES视频与人类学习未完成 | [生成改编](../evaluation/2026-10-02/code2video-pilot/REPORT.md)、[评分反例](../evaluation/2026-10-04/metric-replay-v1/REPORT.md)、[本轮](../evaluation/2026-10-04/reproduction-status-v1/REPORT.md)、[真实TeachQuiz](../evaluation/2026-10-06/teachquiz-completion-v1/REPORT.md) |
| [abstract-algebra-promo](https://github.com/AnctyEnly453/abstract-algebra-promo/tree/5d01a758af8b4b3b7bb5a2a5b7f0efb4cf1667eb) `5d01a75` | 检查原源码、11 个时点及两段连续动画；通过原 `__frame(t,fps)` 实际重渲染 | 仅片段、降低帧率、静音且字体有回退；没有完整作品/观众理解复现 | [参考机制](../evaluation/2026-10-01/reference-mechanisms/REPORT.md)、[表达记录](communication.md) |
| [TheoremExplainAgent / TheoremExplainBench](https://github.com/TIGER-AI-Lab/TheoremExplainAgent/tree/e9ece5db7756b6ded8a812eceeb936cfd02aae21) `e9ece5d` | 本轮执行原公式、抽帧及降帧函数；核对 240 项资产；原单帧提示词换 Codex 裁判，跨两批 12/12 有结果 | 未完整安装/执行生成器；未用原模型；文本、视频、完整关键帧及五项总分支路未完成；无人机相关性复验 | [本轮执行与失败](../evaluation/2026-10-04/reproduction-status-v1/REPORT.md) |
| [PhyEduVideo](https://github.com/meghamariamkm/PhyEduVideo/tree/5a36a13818552095c9ed12c6562f236d5b5011bd) `5a36a13` | 原均匀抽帧、取中帧函数；固定CLIP权重后真实执行32帧图文logits函数；核对60概念/205教学点题集 | 其余VQAScore/InternVideo/InternVL、物理生成和论文人类验证仍未完成 | [本轮执行](../evaluation/2026-10-04/reproduction-status-v1/REPORT.md) |
| Math-To-Manim | 隔离安装；268 个原离线/渲染测试通过；通过原 local_render 入口重渲染未改动 Morse 环面示例，97.933 秒、1469 帧、15 fps 全解码；独立差分检查四个临界点 | 初次缺 TeX 失败保留；原作者生成和 Jev 审查未跑；低分辨率、无完整盲评学习研究 | [新证据](../evaluation/2026-10-04/full-reproduction-v1/math-to-manim-render-evidence-v2.json) |
| manim-bench（NtrpyDev） | 隔离安装、105 个原测试；官方 Codex 生成一道原坐标题，60 fps、798 帧；图片意见驱动一次局部补丁 | 原默认本地进程限制失败；提高限制后渲染；模型补丁语法失败回退，维护者修复后才保留；非官方本地后端，没有全题集或盲评收益 | [修改证据](../evaluation/2026-10-04/full-reproduction-v1/native-coordinate/maintainer-repaired-result-v1.json) |
| ManiBench（nabin2004） | 原函数真实渲染固定烟雾场景；执行故障代码的静态/真实对照 | 返回视频在函数退出后已删除；skip_render 给故障代码标 render_success=True；没有其全题集或真实作者对照 | [原控制](../evaluation/2026-10-04/full-reproduction-v1/manibench-native-controls-v1.json) |
| RLM | 独立安装固定代码；271 个原本地/模拟测试通过、63 跳过 | 原模型递归调用、外部环境和论文成绩未复现；没有部署递归代理平台 | [原测试摘要](../evaluation/2026-10-04/full-reproduction-v1/native-tests-summary.json) |
| realtime-manim-rs | 固定完整源码，npm 安装；35 包测试、一项原 web 测试文件、类型和打包消费检查通过 | Python 桥接缺少 Camera 方法；Rust CDN 失败；两次 WebGPU 适配器为空，无画面产出，未完整跑通 | [失败记录](../evaluation/2026-10-04/full-reproduction-v1/realtime-browser-smoke-v2.json) |
| VBench | 原静态场景闪烁函数执行三个实际编码/解码控制 | 空白静态视频得 1；单帧返回非有限值；仅局部指标，未完整安装/执行 VBench-2.0 或权重评分 | [控制结果](../evaluation/2026-10-04/full-reproduction-v1/vbench-flicker-native-controls.json) |
| [ALGOGEN](https://github.com/algenlab/algogen_anonymous/tree/1bb093c76499135ecf54fc8030219a4e7ee4424c) | [原requirements安装、原基础渲染CLI及筛法终态核对实际执行](../evaluation/2026-10-06/algogen-native-render-v1/REPORT.md) | 原发布轨迹，不是本次模型生成；LLM增强样式和原AES评价未跑 | [结果](../evaluation/2026-10-06/algogen-native-render-v1/REPORT.md) |
| [SVGEditBench V2](https://github.com/mti-lab/SVGEditBenchV2/tree/7e7879a700e839bd382462a6aa5642ae53b4b6e6) | [全部1683题原恢复、两组原MSE、三题原轮廓与四项控制实际执行](../evaluation/2026-10-05/svg-editbench-v2-native-v1/REPORT.md) | 模型生成、CLIP/DINO及完整四指标未执行；空白失败、颜色盲区和中心旋转错误保留 | [结果](../evaluation/2026-10-05/svg-editbench-v2-native-v1/REPORT.md) |
| [Manimator](https://github.com/HyperCluster-Tech/manimator/tree/928b8b2331791bd46f1ad14676893be7528309d8) | 原requirements安装；官方Codex替换传输执行原分镜/代码两阶段，原Manim0.18.1渲染498帧；202进度值独立几何核对、六帧模型定位；另接一次局部模型补丁，新版444帧/29.6秒 | 首版33.2秒超限保留；检查器误报修正后同候选才重渲染；图例歧义/小字仍在；有人选择票据/保护与保留，不是原模型、完整应用/原反馈流程或论文成绩复现 | [首版](../evaluation/2026-10-06/manimator-port-v1/REPORT.md)、[局部修改](../evaluation/2026-10-06/manimator-revision-v2/REPORT.md) |

TEA 和 PhyEduVideo 的原函数从固定源码中抽取后执行，绕开会加载权重、访问服务的顶层代码。源码本身没有改写。这是**原函数的局部执行**，不能叫整套程序已经跑通。

## 其余参考：仍缺实际完整流程

以下来自既有一手材料核查，不表示本轮重新检查了它们是否有新发布。完整固定提交与来源在[机器清单](../evaluation/2026-10-04/reproduction-status-v1/reference-inventory.json)。

| 参考 | 已做的程度 | 下一步/限制 |
|---|---|---|
| [Teaching Monster](https://github.com/Teaching-Monster/TeachingMonster-released) | 固定源码与论文核查 | 公开评价资产、许可仍有缺口；GPU TTS、原 provider 和人评未复现 |
| [VisualEDU](https://github.com/UchihaIchigo/VisualEDU) | 固定源码、论文核查 | 安装、生成和学习评价未跑 |
| [ManimTrainer / ManimAgent](https://github.com/SuienS/manim-trainer) | 固定源码、题集规模核查 | 本地 HF/CUDA 推理与训练未跑；417 项中 317/100 为作者划分，不是本项目结果 |
| [InternSVG / SArena](https://github.com/hmwang2002/InternSVG) | 固定源码、论文核查 | 权重、生成及原评分未跑；SVG 静态任务与动画有边界 |
| [EditBoard](https://github.com/Samchen2003/EditBoard) | 固定源码、论文核查 | 未跑图像编辑评价；不能替代数学机制评价 |
| [VideoScore v1/v1.1](https://github.com/TIGER-AI-Lab/VideoScore) | 固定源码、论文核查 | 权重推理未跑；v2 未核查，不能合并 |
| [HKUDS VideoAgent / VideoEdit](https://github.com/HKUDS/VideoAgent) | 固定源码、论文核查 | 评价标签/资产完整性未确认；provider 和媒体工具未执行 |
| [HeyGen Code2Video](https://www.kaggle.com/datasets/heygen/code2video-public) | 公开 v5 的 50 任务/409 文件及服务器预览核查 | 未下载/运行；原评分需要 HeyGen 服务与 GCS 配置，未授权购买；与 ShowLab 分开 |
| [Animation2Code](https://arxiv.org/abs/2606.28593) | 论文与项目页核查；2026-10-05再核对官方页 | 官方页仍标Code soon / Dataset soon；未取得核心代码/数据，演示站不代替原评价器 |
| [LessonBench-V1](https://www.kaggle.com/datasets/ravidussilva/lessonbench-v1) | 原论文与数据集存在性核查 | 647 篇/240 主题为作者资产描述；未下载、生成或评价 |
| [EditBench](https://imagen.research.google/editor/) | 原论文/官方页面核查 | 图像修补基准；未跑，不当作动画质量基准 |
| [EduVideoBench](https://arxiv.org/abs/2605.26918v1) | 论文评价公式核查；2026-10-05找到论文直接给出的匿名代码链接，但访问返回401 | 尚未获取并执行完整评价器，不把链接不可访问写成代码不存在 |
| [generative-manim](https://github.com/marcelo-earth/generative-manim) | 基准 README 核查 | 未固定源码/跑题集；工程通过率不等于讲懂 |
| [VidCode](https://openreview.net/pdf/af519bec3825aee9059f5580f85e682316617428.pdf) | 找到对应的匿名论文，直接全文访问403/浏览器验证 | 完整官方代码/数据入口仍未核实，不能用同名产品代替 |
| [VideoEditBench（精确名字）](https://subjectivitylabs.com/) | 找到同名v0.1演示站 | 页面未提供可执行代码/数据，和原研究参考的归属仍待确认；不与VideoEdit或EditBoard混同 |

## 接下来怎么把复现做完整

每个项目都按同一顺序补证据：固定提交和输入 → 安装/入口 → 原流程模拟 → 实际渲染 → 实际模型与原评价 → 对照及论文要求的人评。若改了模型、输入形式或调度，单独登记改编，保留失败。没有原权重、原服务或人评时，完整论文复现继续标为未完成。

当前先补评价方案的控制覆盖，再跑评价驱动修改和未见任务。两批同一固定控制的事实判断已各覆盖 12/12，标签各匹配 12/12。独立控制只有 12 个、两个概念，不是 24 个独立样本；尚不能宣布一般评分可靠。坐标题的原模型补丁语法失败，人工修复版的局部位置改善也不是自动循环或艺术收益的证明。新调用须有新的实验额度及可用账号额度，并使用连续失败停止的保护。

TeachQuiz改编三阶段已实际补齐入口，但不能证明知识遗忘或视频学习；接下来仍需TEA完整评价支路和原模型/视频输入的复现边界；PhyEduVideo 已固定并运行 CLIP 局部函数，其余原权重、配置和完整评分还需补齐。其他代码生成基线按清单逐项执行；需要额外服务、不可得资产或模型权重的项目明确留在待办，不靠一个改编小样本宣布全部复现。

## 固定源码怎么取回

本轮 TEA/PhyEduVideo 的文本文件可按归档的 Git blob 和 SHA256 重建到忽略目录，不会下载权重或视频：

```bash
python3 tools/fetch_reference_sources.py
python3 tools/fetch_reference_sources.py --verify-only
```

新取回工具已在现有 42 个文件上验证；从空目录重新下载尚未使用这份公开工具执行，本轮实际获取记录来自其前身脚本。实验 v1 的设计、响应与失败是历史证据，不覆盖。重跑实验须新建版本和冻结记录，不能直接修改 v1 或沿用其已用完的预算。

2026-10-05 新结果与失败见[持续复现证据](../evaluation/2026-10-04/full-reproduction-v1/REPORT.md)。新增授权 96 次，已用 35 次（34 有结果、1 额度失败），保守余额 61；旧 48 次不改写。全范围仍包含原 30 项，没有任何完整论文成绩复现。截图关联 [Karpathy 消息核查](research-notes/2026-10-05-karpathy-output-understanding.md)单独记录，不扩张原分母。

2026-10-06补充：新96次授权累计53次（49有结果、4无结果），余43；[TeachQuiz组合结果](../evaluation/2026-10-06/teachquiz-completion-v1/REPORT.md)保留两个批次和一项格式无效。SVG原数据恢复与ALGOGEN原渲染已单独提交；无完整论文成绩或未见任务收益结论。

同日Manimator新增3次后，累计56次（52完成、4无结果），余40。上表已有15项部分实际执行，另15项仍缺完整流程；这是执行索引，不是15/30质量通过率，也没有完整论文成绩复现。

同日局部修改及复核新增2次后，累计58次（54完成、4无结果），余38。保留时长与TARGET文字修正，同时保留检查器误报和新发现的原图例歧义；未见任务和稳定表达收益仍未验证。
