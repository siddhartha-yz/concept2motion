# VisualBook Harness

给生成可视化教材的 agent 一套能实际调用的工具：领域绘图设计、连续交互、完整公式导入、真实图片预览和内部修订。当前聚焦数学、机器学习、深度学习和编程；先解决 **textbook → visualbook**，视频转教材留给独立的上游流程。

项目目标是让同一个模型更稳定地完成好教材。优秀样本、通过浏览器检查和稳定批量产出是三件不同的事。目前还没有证明“一本任意教材输入，就能无人反馈直出优秀成品”。

## 当前入口

- [工具接口与适用范围](packages/visualbook/API.md)：坐标、矩阵、数据流、优化轨迹、概率，以及张量和卷积设计。
- [运行方式](packages/visualbook/README.md)：官方 Codex 登录、原文导入、串行生成、预览修订与离线导出。
- [本轮报告](evaluation/2026-10-10/harness-v2/REPORT.md)：同源直接生成对照、实际图片通道、数学与阅读检查、仍未解决的限制。
- [研究记录](docs/research-map.md)、[方向讨论](docs/decisions/2026-10-10-visualbook-direction.md)、[定位修正](docs/decisions/2026-10-10-visualbook-harness.md)。

## 最短运行方式

需要 Node 22+、Python 3、已登录的官方 Codex CLI，以及 Chromium。首次安装固定依赖与 D2L 源码：

```bash
python3 experiments/visualbook/bootstrap.py --fetch
```

普通 Markdown 章节可以直接输入；本地图片与它放在同一目录范围。原始服务日志、会话文件和结果放在被 Git 忽略的 `work/`：

```bash
python3 tools/run_visualbook.py my-chapter.md work/my-book
```

多章使用 manifest，逐章串行生成、让模型看真实桌面和手机图片、自行修订，最后组装成一本 HTML 教材。默认最多3章，每章最多3轮候选预览；这是调用范围，不是教学质量认证。

```json
{"title":"我的教材","chapters":[{"id":"chapter-one","source":"chapter-one.source.json"}]}
```

```bash
python3 tools/run_visualbook.py chapters.json work/my-book --max-chapters 3
```

最后预览与代码不一致、公式出错或仍有渲染发现时，工具保留诊断并停止导出。模型使用现有 ChatGPT 登录，不需要提取 token 或转成 API 凭据。生成候选是本地已授权代码；这个项目目前不是接收陌生代码的公网服务。

## 可复用部分

`packages/visualbook/` 是绘图、数学、阅读运行时和设计目录。`tools/visualbook_mcp.py` 把实际 PNG 返回给模型，`tools/run_visualbook.py` 负责串行生成和导出，`tools/assemble_visualbook.mjs` 也可以不调用模型重建已保存的书。

正文与图在同一条阅读路径里。图解默认静止，可以拖动、单步查看或主动播放；滚动页面会暂停演示。公式数量覆盖、编译诊断、实际浏览器布局和数学核对分开记录，审美与教学判断另做。

D3按固定版本与ISC许可证使用，KaTeX与D2L许可证随导出保留。维护者编写的设计示例不冒充模型生成样本。[旧动画设施和研究入口](docs/legacy-infrastructure.md)继续保留，避免把负结果和历史证据丢掉。
