# Concept2Motion · 概念成形

让 AI 根据画面证据快速、局部地修改概念动画，并检验修改是否改善表达。

目标是减少每次重新提示和人工盯画面的成本。当前是实验基础设施的起点，尚未宣称解决自动艺术审美。

2026-10-10 新增[随阅读变化的 HTML 教材实验](evaluation/2026-10-10/reading-textbook-v1/REPORT.md)：固定复现 Video2Book/Zanim 的关键流程，实际导入 CS336 的 21 份文档，做出三个段落跟随图解和离线单文件。[源码与重建说明](experiments/reading-textbook/README.md)独立于旧视频作者／裁判流程；工程可运行，学习收益尚未验证，新音频转写仍有工具缺口。旧研究与负结果继续保留。

[仓库定位、约束、假设与验证方式](docs/positioning.md)说明目标和现有能力的边界。当前已有渲染、部分数学检查、局部补丁与快速预览；可信评分和评价驱动的完整改进循环尚未完成，尚未证明稳定的表达质量提升。

已记录三个待解决问题：[评价分数](docs/issues/evaluation-score.md)、[评价后怎样改进](docs/issues/evaluation-to-revision.md)、[定位落实与效果验证](docs/issues/repository-positioning.md)。

[研究图谱](docs/research-map.md)把问题、实验结果和对应 commit 连起来，保留失败与未决结论。[模型策略](docs/decisions/2026-10-04-model-strategy.md)记录为何先验证反馈循环，再考虑小规模后训练。

新增无需额外实验模型调用的[事实响应导入与技术修订入口](docs/offline-feedback.md)：七项预设控制验证了目标修补和失败/退化回退。票据与补丁由维护会话写定，尚未接入外部画面裁判与作者模型，不能据此声称表达质量提升。

现成评分也需要先检查：[Code2Video 评分代码重放](evaluation/2026-10-04/metric-replay-v1/REPORT.md)发现答案读取、格式计分和失败处理会制造假成绩。新增[严格离线计算](docs/metric-replay.md)，没有把模拟验证当真实裁判或教学评价。

[参考复现清单](docs/reproductions.md)逐项区分研究与执行：六个项目有部分实际执行，尚无完整论文成绩复现。本轮补 TEA/PhyEduVideo 原函数处理；48 次官方 Codex 裁判尝试只有 16 次可用，32 次遇到账号额度上限。[结果和失败](evaluation/2026-10-04/reproduction-status-v1/REPORT.md)保留全部分母，评分可信度仍未建立。

现在的主要入口是小型 Canvas 运行时、常驻局部预览和带哈希的版本修改。对象、镜头、时间和绘图代码分别处理；已注册的动作可以只改 `timing.json`，保留原绘图源码。

首轮同模型对照没有证明运行时提速：Direct 整臂 93.6 秒，Infra 100.7 秒。[保留的负结果](evaluation/2026-10-02/infra-pair-v1/REPORT.md)。随后将同一生成候选明确适配到命名动作，参数修改到局部视频实测 0.865 秒、零模型调用；这是时序调整的结果，不是新场景生成或艺术质量的收益。[参数实验](evaluation/2026-10-02/timing-bindings-v1/REPORT.md)。

```bash
# 真实模型生成和一次小补丁修改；使用已登录官方 Codex CLI
python3 tools/iterate.py --run runs/my-pair
python3 tools/iterate.py --run runs/my-pair --resume
python3 tools/audit_preview.py --run runs/my-pair

# 常驻浏览器；输出本地 origin，接受 POST /preview
node tools/studio.mjs
```

需要 Python 3、Node 22、Playwright/Chromium、FFmpeg/ffprobe。环境变量与参数修改命令见 [短循环使用说明](docs/runtime-loop.md)。当前 studio 和独立数学检查限定在 10 秒雪花 benchmark；运行时保留通用对象与 Canvas 扩展。

## 初始范围

- **Codex 优先**：在已登录 ChatGPT 的 Codex 桌面端或 CLI 中完成代码生成与画面审看；本地准备和验证不要求模型 API 密钥。
- **独立评测**：参考项目固定到提交，分别记录安装、程序测试、真实渲染、真实模型生成和视觉评价。
- **机制契约**：动画对象的运动必须对应数学过程；先验证 Softmax、残差连接、GRU 的数值约束。
- **证据保存**：保留 brief、候选源码、错误、关键帧、版本和审看结论。渲染成功不等于质量通过。

首条实际闭环已跑通：Softmax 初稿发现两类文字重叠，局部修订后 720 帧检查通过；12 秒 1080p60 视频在两个独立浏览器进程中得到相同 SHA-256。[结果与限制](evaluation/2026-10-01/softmax-loop/REPORT.md)。这是一次当前 Codex 会话驱动的试验，还不能证明模型生成稳定性或完全无人值守能力。

第二个案例已覆盖残差连接：验证直通路径不改变输入、带正负方向的分量相加和实际像素。视觉审看发现一次图形遮挡文字，局部修改后完整视频通过；检查器也加入了对应回归检查。[残差报告](evaluation/2026-10-01/residual-loop/REPORT.md)。两个案例共享相同的渲染器、证据格式和修订记录工具。

具体作品仍在 [neural-choreography](https://github.com/siddhartha-yz/neural-choreography)。这里开发通用能力，暂不迁移作品。

## 快速开始

只需 Python 3.11+，准备流程不需要安装第三方包：

```bash
python tools/bench.py list
python tools/bench.py check
python tools/bench.py prepare softmax
```

打开生成的 `runs/softmax/prompt.md`，交给当前 Codex 会话执行。它要求生成、渲染、采样、自查和保存证据，保留人最后的审美裁决。也可以在仓库中启动已通过 ChatGPT 登录的官方 CLI：

```bash
codex login status
codex exec --sandbox workspace-write - < runs/softmax/prompt.md
```

订阅登录走官方 Codex 客户端。上游 Paper2Manim / OpenMotion 的 LangChain 或模型 HTTP 接口需要独立适配，不能直接填入 Codex 登录信息。[认证文档](https://learn.chatgpt.com/docs/auth)，[非交互运行文档](https://learn.chatgpt.com/docs/non-interactive-mode)。

## 已可运行的渲染与审看工具

```bash
npm ci
npx playwright install chromium
node tools/render_scene.mjs --scene benchmarks/scenes/softmax/index.html \
  --out runs/softmax/attempt-01 --author 'Codex desktop session'
node tools/render_scene.mjs --scene benchmarks/scenes/residual/index.html \
  --out runs/residual/attempt-01 --author 'Codex desktop session'
```

需要 FFmpeg / ffprobe。工具保存源码快照、数值与几何检查、关键帧、确定性检查和完整视频验证。用 `--checks-only` 可先检查画面。[场景协议与审看记录](docs/scene-protocol.md)说明了接口、工具路径配置、修订预算和证据要求。

## 参考项目复现

记录见 [首次评测](evaluation/2026-10-01/REPORT.md)，固定版本见 [upstreams.json](evaluation/upstreams.json)。

```bash
# 在独立目录中克隆、安装参考项目后运行；不复制其源码进本仓库
python tools/evaluate_paper2manim.py --upstream /path/to/Paper2Manim --out runs/paper2manim
node tools/evaluate_openmotion.mjs --upstream /path/to/open-motion --out runs/openmotion
```

Paper2Manim 工具要使用其虚拟环境 Python，且 `manim`、`ffmpeg`、`ffprobe` 应在 PATH。详细环境要求和本机遇到的问题均记录在报告中。
OpenMotion 工具在已安装依赖的隔离副本中加载原始 TypeScript 模块，评测组件、HTML 生成、变体与结构性评分；不代表完整服务能够启动。

## 可续跑的真实生成评测

```bash
python3 tools/batch.py run --out runs/my-six
python3 tools/batch.py run --out runs/my-six --resume
python3 tools/batch.py report --out runs/my-six
```

默认分别生成三次 Softmax 与残差候选。输入和检查工具冻结，作者与视觉审看使用官方 CLI 的分开上下文；每轮保存源码、渲染、检查、审看和用量，修订有上限。服务故障会停止并保留进度，完成的试验不会重跑。[运行说明与限制](docs/batch-workflow.md)。需要已登录的 Codex CLI 及渲染工具；这些命令会实际消耗订阅用量。

首次六轮真实评测已完成：4/6 初稿通过审看，另两轮经共三次视觉修订后通过；没有技术修复。共 18 次调用、9 条真实视频，完成后的续跑未新增调用。[报告、源码与失败记录](evaluation/2026-10-01/fresh-six/REPORT.md)。结果仅支持这两个案例的小样本探索，最终艺术接受仍待用户判断。

用户审看指出这些片段未讲清楚要表达什么，旧的通过率不能解释为观众理解率。目前增加中文解释模式：先保存受众与教学分镜，再生成代码、按阶段取帧，并让不看 brief 的审看者复述。[参考分析与运行方式](docs/communication.md)。

一条 32 秒中文 Softmax 解释实验完成机器检查与模型复述审看，随后被用户明确拒绝，并指出迭代太慢。它是失败样本。[分镜、结果与反馈](evaluation/2026-10-01/explanation-softmax/REPORT.md)。

局部迭代改用带源码哈希的小补丁和 960×540 / 12 fps 草稿预览。草稿不能获得完整渲染通过状态；它只用于快速否决方向。[操作与实测](docs/fast-iteration.md)。


## 下一步

弱模型生成、强模型裁判的首轮对照没有证明检查反馈带来画面收益：C 对普通修订 B 为 0 胜、2 负、2 不可比较。[对照方法](docs/model-infra-pilot.md)和[完整结果](evaluation/2026-10-02/model-infra-pilot-v1/REPORT.md)保留失败与裁判缺失。

随后修复证据字段缺失导致的导出中断，并增加指数条形比例检查。16 条旧候选源码不变，19.3 秒完成重渲染，导出从 9/16 到 16/16；技术通过仍为 4/16。新的[绘图证据接口](docs/math-evidence.md)通过手写正负对照的实际渲染验证。[工程回归报告](evaluation/2026-10-03/render-evidence-v2/REPORT.md)。

同接口的两轮新对照已经完成，仍没有证明稳定的画面收益。v2 因额度缺失的四次审查保留，另获授权补审；v3 从共享初稿各固定修改一次，全部 24 次请求完成。

| 试验 | C 获胜 | 普通自查 B 获胜 | 未决 | 缺视频不可比较 |
|---|---:|---:|---:|---:|
| v2 补充分析（额外四次审查单计） | 1 | 0 | 1 | 2 |
| v3（同初稿、同一次修订预算） | 1 | 1 | 1 | 1 |

每行只有四份配对初稿，不是人类看懂率。v3 的 C/B 各导出 3/4；冻结技术通过 C 2/4、B 0/4，技术收益没有变成稳定画面优势。多个版本不可拼成更多独立概念样本。[v2 补审](evaluation/2026-10-03/v2-review-supplement-v1/REPORT.md) · [v3 完整结果](evaluation/2026-10-03/model-infra-pilot-v3/REPORT.md)。

能确认的短循环收益在本地预览：原生 Softmax/残差源码可直接交给常驻 studio，指定时间段、保存源码和检查，只导出局部草稿。相同 2 秒片段的 8 对测速，常驻中位数 0.533 秒，新启浏览器 0.858 秒（含启动），视频字节一致；模型生成、创作与审查耗时不包含在内。[预览与异常恢复](evaluation/2026-10-03/math-preview-v1/REPORT.md) · [重复测速](evaluation/2026-10-03/math-preview-latency-v1/REPORT.md) · [使用说明](docs/runtime-loop.md)。

显式进度接口分开记录完整目标、当前几何和稳定阶段，避免把正确渐显判成算错。16 个手写正负对照与 12 个数值边界控制都实际导出并完整解码，符合各自预设；它们只验证工程检查。另准备了 12 个保持正确文字、只改变图形事实的[裁判对照](evaluation/2026-10-03/judge-fact-probes-v3/REPORT.md)，尚未调用外部裁判。相关[原始研究](evaluation/2026-10-03/judge-research/REPORT.md)也没有被当作本仓库的复现成绩。

成对查看 B/C 视频、具体错误和两种顺序的裁判理由，可用 [只读证据页](docs/model-infra-pilot.md)。跨概念复用、解释清晰度与艺术质量仍需各自验证。

架构方向见 [architecture.md](docs/architecture.md)。目前没有多代理调度器、自动学习记忆库或跨渲染器通用场景语言；这些能力应由评测结果推动。
