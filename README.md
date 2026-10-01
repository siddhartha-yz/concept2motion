# Concept2Motion · 概念成形

让 AI 创作的数学与机器学习动画可以复现、检查、局部修改和持续积累。

目标是减少每次重新提示和人工盯画面的成本。当前是实验基础设施的起点，尚未宣称解决自动艺术审美。

## 初始范围

- **Codex 优先**：在已登录 ChatGPT 的 Codex 桌面端或 CLI 中完成代码生成与画面审看；本地准备和验证不要求模型 API 密钥。
- **独立评测**：参考项目固定到提交，分别记录安装、程序测试、真实渲染、真实模型生成和视觉评价。
- **机制契约**：动画对象的运动必须对应数学过程；先验证 Softmax、残差连接、GRU 的数值约束。
- **证据保存**：保留 brief、候选源码、错误、关键帧、版本和审看结论。渲染成功不等于质量通过。

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

## 参考项目复现

记录见 [首次评测](evaluation/2026-10-01/REPORT.md)，固定版本见 [upstreams.json](evaluation/upstreams.json)。

```bash
# 在独立目录中克隆、安装参考项目后运行；不复制其源码进本仓库
python tools/evaluate_paper2manim.py --upstream /path/to/Paper2Manim --out runs/paper2manim
node tools/evaluate_openmotion.mjs --upstream /path/to/open-motion --out runs/openmotion
```

Paper2Manim 工具要使用其虚拟环境 Python，且 `manim`、`ffmpeg`、`ffprobe` 应在 PATH。详细环境要求和本机遇到的问题均记录在报告中。
OpenMotion 工具在已安装依赖的隔离副本中加载原始 TypeScript 模块，评测组件、HTML 生成、变体与结构性评分；不代表完整服务能够启动。


## 下一步

先对三个小案例跑真实模型生成，再决定采用哪些组件。比较首次渲染成功率、机制错误、视觉问题、修正轮次、人工介入和用量。当前样本数不支持成功率或成本结论。

架构方向见 [architecture.md](docs/architecture.md)。目前没有多代理调度器、自动学习记忆库或跨渲染器通用场景语言；这些能力应由评测结果推动。
