# Code2Video 独立核验与订阅适配实验

状态：**baseline 未确认；本次是诊断适配实验，不是论文结果复现。**

固定上游：[showlab/Code2Video @ 1142d8e](https://github.com/showlab/Code2Video/tree/1142d8e14cdc2806df85aedb0fbb5dca474caa0f)。26 个上游文本文件的 SHA256 见 `upstream-source-manifest.json`，运行前逐项校验；没有修改上游源码，也没有下载参考视频。源代码采用 MIT 许可。

## 分层证据

| 层次 | 本次证据 | 能说明什么 |
|---|---|---|
| 安装 | Python 3.12，公开 requirements 的全部固定依赖已安装；原入口 `--help` 通过 | 安装与入口可用 |
| 固定输入工作流 | 原 worker 重建 agent 时遗漏 section_codes；有效源码已存在，重生成次数设为 1 时直接失败 | 原代码有可复现的状态传递问题，不能外推默认 10 次一定全失败 |
| 实际 fixture 渲染 | 同一源码在父 agent 成功产出可解码的 Text+MathTex 视频，并查看抽帧 | Manim、TeX、字体及编码可用；没有模型生成与美术效果证据 |
| Critic 错误路径 | 替换原视频服务函数为固定异常，原方法返回 `has_issues=False` 和空改进列表 | “裁判未运行”必须单独记为未知，不能记为通过 |
| 真实模型生成 | 官方 Codex，gpt-6.1-sol，原大纲/分镜/代码提示词，6 节真实生成 | 是适配结果，不是同模型论文复现 |
| 实际候选渲染 | 经单独产物识别修补，6 节共 302.13 秒，全部 4532 帧可解码 | 原流程未完整成功；分辨率不一致，保留独立片段 |
| 数学检查 | 大纲与分镜中的 17 项代数检查通过，选择性核对源码 | 不证明全部画面坐标正确、表达有效或学生学会 |
| 艺术与表达审查 | 当前对话审看 36 张取样帧，有文字、标签重叠与边界裁切 | 审查者已知任务，不是独立盲评，也未看完所有动态转场 |
| 独立抽帧模型审查 | 经用户授权，单独调用仅看六张联系表；无工具调用，201.87 秒完成 | 能重建主题与部分具体关系，同时报告表达缺口；不是学习效果测量 |

固定测试的最终证据见 `native-defect-fixtures.json`。早期 smoke-01 因缺少 `preview.sty` 失败，补齐本地 TeX 依赖后重新测试；smoke-03 中初版注入位置不正确，发生模板服务连接失败。最终 smoke-04 改为替换实际调用的模块函数，确认固定异常路径，不发送视频服务请求。早期记录保留在 ignored work 中。

## 此次适配范围

输入采用上游第 9 项 `Linear transformations and matrices`。保留原大纲（约 5 分钟）、分镜、代码生成提示词与 TeachingScene 基类。使用上游支持的无素材、无 Critic 配置。完整保留 6 节任务，不截短或手工重写分镜。

差异包括：提供商 API 改为官方 Codex CLI 的已登录订阅；输出增加一层 content 字符串结构；原 max_tokens 只能记录，不能由 CLI 等价执行；模型、系统上下文与推理配置不同。代码生成采用上游的 6 线程；渲染串行调用同一父 agent 的原方法，避免 worker 丢失状态。限制 2 次重新生成与 3 次编译修复。以上都使本实验不能声称与论文同条件。

初版适配采用串行生成，在第三次调用中断后恢复上游 6 线程。大纲、分镜继续使用已有检查点；中断调用与耗时计入清单，不能挑出较快部分作为总体耗时。

原版 Gemini 视频 Critic、AES 和教学测评均未运行。一次适配样本也不能估计重复方差、跨任务表现，或证明 concept2motion 优于此方法。

## 实际诊断结果

原流程第二节连续三次 `manim -ql` 返回 0，并产生 2400×900 视频，然而 `debug_and_fix_code` 只寻找固定 `480p15` 路径，因此误判失败，把正常进度条作为错误交给 ScopeRefine。期间一次局部修复未通过类导入检查，触发完整修复。停止这条无效修复链前的记录在 `pre-rescue-results.json`；不能把之后的修补结果反写为原流程成功。

单独 rescue 阶段按源码与成功渲染记录匹配已有视频，并在非默认尺寸再次成功渲染时提供路径别名。首次 rescue 的适配器存在恢复问题：源码已被此前修复修改，随后一次中断渲染记录缺少 exit_code，引发恢复 KeyError。这是本实验封装自身的错误；已修复，全部中断和耗时保留。最终封装进一步要求源码和视频双重哈希相符才能复用；3 项回归测试覆盖中断记录、源码修改、视频覆盖和不可验证产物。全部 Python 测试 53 项通过。

第五节确有代码错误：Manim 0.19.0 的 `ParametricFunction` 没有 `add_tip`。ScopeRefine 自动修复去掉该调用，第二次渲染成功；数学表达和其余动画逻辑未变。此次没有追加美术修订。

最终各节时长为 30.00、45.53、60.13、61.27、60.20、45.00 秒，总计 302.13 秒。第二节为 2400×900，其余为 854×480，全部 15fps。没有把不同格式的流直接合并并宣称统一交付。

记录的运行阶段合计 **1612.54 秒（约 26.9 分钟）**，含中断、原流程错误修复和适配器错误恢复；不含环境安装和阶段间人工准备时间。16 次模型调用中 14 次完成、2 次中断。完成调用记录 input tokens 260444、output tokens 45414；包含 Codex 系统上下文与缓存，不能用作论文 API 成本比较。候选不够资格支持速度优势或质量优势的结论。

视觉取样的具体问题包括：第一节 P/T(P) 标签与讲解文字挤进图形；第四节结果标签与 “New example” 重叠；第五节投影讲解文字越过画面右边界；第六节机器人与结果标签重叠。取样审查的证据见 `contextual-review.json`，不提供自评总分。

独立审查准备发送的是六张联系表、共 36 张抽帧，目的地为已登录的官方 Codex 服务。最初自动审批以“缺少对本地私人产物发送到该目的地的明确授权”为由拒绝，首次尝试没有发送图片。用户随后明确授权“允许发送，继续独立审查”，才启动单独的官方 Codex 调用。审查已完成，耗时 201.87 秒，无工具调用。审查者未接收题目、源码、分镜或创作者评价，只收到六张联系表与冻结提示词；与生成器使用同一配置模型，不能称为不同模型或独立人群验证。结果在 `blind-review.json`，冻结提示词在 `blind-review-prompt.txt`，状态在 `independent-review-status.json`。

该审查重建了主题，并引用画面核对出 6 项具体关系；列出 9 项观察，包括图文冲突、两条运算顺序缺少清楚区分、投影不可逆性主要依赖书面断言等。所有观察的时间戳已与输入取样核验。静帧未覆盖完整运动，“未展示”只能解释为当前取样证据不足，不能直接等同于整个视频没有展示。不计算未经校准的总分。

候选输入、源码哈希、渲染结果、抽帧、当前审查和修订历史已归档。6 节最终源码与每次渲染输入快照另存于 `candidate-sources/`，输入在 brief.json、outline.json 和 storyboard.json；无需重新调用模型即可复查这些源码。初期部分渲染产物在同一路径被后续版本覆盖，未保留全部中间视频；输入源码快照与返回状态仍在。完整“每次修订的视频均可重放”尚未达到，不能称为完善的候选档案。

| 节 | 视频 | 取样联系表 |
|---|---|---|

| section_1 | [片段](</home/yang-zhi/文档/ChatGPT/concept2motion/work/code2video-reproduction/runs/pilot-01/CASES/9-Linear_transformations_and_matrices/media/videos/section_1/480p15/Section1Scene.mp4>) | [6 帧](</home/yang-zhi/文档/ChatGPT/concept2motion/work/code2video-reproduction/runs/pilot-01/samples/section_1-contact.png>) |
| section_2 | [片段](</home/yang-zhi/文档/ChatGPT/concept2motion/work/code2video-reproduction/runs/pilot-01/CASES/9-Linear_transformations_and_matrices/media/videos/section_2/900p15/Section2Scene.mp4>) | [6 帧](</home/yang-zhi/文档/ChatGPT/concept2motion/work/code2video-reproduction/runs/pilot-01/samples/section_2-contact.png>) |
| section_3 | [片段](</home/yang-zhi/文档/ChatGPT/concept2motion/work/code2video-reproduction/runs/pilot-01/CASES/9-Linear_transformations_and_matrices/media/videos/section_3/480p15/Section3Scene.mp4>) | [6 帧](</home/yang-zhi/文档/ChatGPT/concept2motion/work/code2video-reproduction/runs/pilot-01/samples/section_3-contact.png>) |
| section_4 | [片段](</home/yang-zhi/文档/ChatGPT/concept2motion/work/code2video-reproduction/runs/pilot-01/CASES/9-Linear_transformations_and_matrices/media/videos/section_4/480p15/Section4Scene.mp4>) | [6 帧](</home/yang-zhi/文档/ChatGPT/concept2motion/work/code2video-reproduction/runs/pilot-01/samples/section_4-contact.png>) |
| section_5 | [片段](</home/yang-zhi/文档/ChatGPT/concept2motion/work/code2video-reproduction/runs/pilot-01/CASES/9-Linear_transformations_and_matrices/media/videos/section_5/480p15/Section5Scene.mp4>) | [6 帧](</home/yang-zhi/文档/ChatGPT/concept2motion/work/code2video-reproduction/runs/pilot-01/samples/section_5-contact.png>) |
| section_6 | [片段](</home/yang-zhi/文档/ChatGPT/concept2motion/work/code2video-reproduction/runs/pilot-01/CASES/9-Linear_transformations_and_matrices/media/videos/section_6/480p15/Section6Scene.mp4>) | [6 帧](</home/yang-zhi/文档/ChatGPT/concept2motion/work/code2video-reproduction/runs/pilot-01/samples/section_6-contact.png>) |

## 本地重跑入口

诊断封装：`tools/code2video_pilot.py`。上游与依赖位于 ignored `work/code2video-reproduction/`，原始模型日志不进入 Git。此机器使用了已有 Cairo/Pango 开发 sysroot；系统包与 Python 包版本记录在 `environment.json`。

```bash
work/code2video-reproduction/venv/bin/python tools/code2video_pilot.py smoke --run smoke-new
work/code2video-reproduction/venv/bin/python tools/code2video_pilot.py generate --run pilot-new
work/code2video-reproduction/venv/bin/python tools/code2video_pilot.py render --run pilot-new
```

`generate` 可在同一 run 下加载已保存的大纲、分镜和源码；模型调用日志单独累积。请勿重复运行同一 run 的并发入口。`render` 保留每次输入源码与错误日志，只在全部节成功时合并。

本次另行使用 `render-discovered --run pilot-01` 收集成功却不在固定路径的产物，并完成剩余渲染；该入口是显式修补，不是原流程。抽帧命令为 `work/code2video-reproduction/venv/bin/python evaluation/2026-10-02/code2video-pilot/sample.py pilot-01`。候选清单在 `candidates.json`；原始日志与媒体位于 ignored work。本次独立图片审查在用户授权后完成；授权范围限于这六张联系表。

换机器时需要重新准备固定版本源码、requirements 与 TeX：稀疏检出上游 `src/`、`prompts/`、`json_files/` 和 LICENSE/README，将本报告的 `upstream-source-manifest.json` 放入 upstream/SOURCE_MANIFEST.json。创建 Python 3.12 隔离环境，安装原 requirements；提供 Cairo/Pango 开发头文件。TeX 包清单在 environment.json，本次通过 apt download + dpkg-deb -x 解包至 work，未安装系统包。`tools/code2video_pilot.environment()` 设置本地 TeX 查找路径；在其环境中用 pdftex -ini -etex -jobname=latex -progname=latex latex.ini 生成 work/code2video-reproduction/tex/formats/latex.fmt。以上环境准备步骤当前是机器相关的实验记录，并非已实现跨机器一键复现。

## baseline 的采纳门槛

完成此单任务诊断后，先判定该公开方法是否值得进入对照，而非直接采纳。下一阶段应冻结模型、输入、预算、模式和失败处理，比较直接生成与该方法，至少包含重复运行，并报告全部失败。视觉检查须用负对照验证是否把缺少解释的影片判为好；教学理解须处理模型先验知识污染。TEB 跨任务移植应单独列出，不能称为原论文复现。当前没有解决这些测量问题。
