# Concept2Motion · 概念成形

让 AI 创作的数学与机器学习动画可以复现、检查、局部修改和持续积累。

目标是减少每次重新提示和人工盯画面的成本。当前是实验基础设施的起点，尚未宣称解决自动艺术审美。

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

先由用户审看匿名 A/B，决定画面方向是否值得继续。时序修改已能避开代码重写；新场景生成仍需减少绘图代码并验证跨概念复用。下一轮只针对具体画面缺陷改一个能力，再做对照，不靠增加长提示词或扩大 agent 平台判断进展。

架构方向见 [architecture.md](docs/architecture.md)。目前没有多代理调度器、自动学习记忆库或跨渲染器通用场景语言；这些能力应由评测结果推动。
