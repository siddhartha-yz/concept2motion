# 首次独立复现 · 2026-10-01

结论：**先复现再选型很有必要。Paper2Manim 的执行与错误反馈值得借鉴；OpenMotion 可以参考组件设计，但当前提交不适合作为可直接运行的底座。新项目采用 Codex 订阅工作流 + 本地确定性渲染。**

这里记录可证实的工程结果，不宣称已经复现参考项目的端到端 AI 创作质量。两份上游源码均未修改，未复制到新仓库；原有动画作品仓库未改动。

## 测试范围

两个仓库独立克隆，提交见 [upstreams.json](../upstreams.json)。两个短片使用本次 Codex 会话编写的固定 Softmax 案例；这验证了“用当前订阅完成编写 → 本地渲染”的工作方式，并非上游 Storyboarder/Coder/VLM API 的原生生成实验。没有调用任何模型 API，也没有提取 Codex 登录凭据。

本机 `codex login status` 返回 `Logged in using ChatGPT`。官方客户端支持订阅认证与非交互任务；上游模型 HTTP 客户端尚未适配这条路径。[官方认证说明](https://learn.chatgpt.com/docs/auth)，[非交互模式](https://learn.chatgpt.com/docs/non-interactive-mode)。

## Paper2Manim

固定提交：[`d7e5a31`](https://github.com/jwj1342/Paper2Manim/tree/d7e5a310c11a4071ff5e2f7bd0042ac36ce43359)。

| 检查 | 结果 | 实际含义 |
|---|---|---|
| 隔离安装 | 通过，Python 3.12.14 / Manim 0.20.1 | 需要 Cairo/Pango 开发依赖；本机复用了已有用户目录 sysroot，未安装系统包 |
| `pytest -m 'not slow' -q` | 350 passed / 33 skipped | 验证程序逻辑；模型、渲染与视觉闭环测试多使用 mock，部分可选后端缺少依赖而跳过 |
| 原始默认渲染资源设置 | 失败，MemoryError | 默认 4096 MiB 地址空间限制与数值库线程初始化组合产生问题 |
| 环境限制线程后重试 | 通过 | 设置 `OPENBLAS_NUM_THREADS=1 OMP_NUM_THREADS=1`，未修改上游代码或放宽其内存限制 |
| 真实 Softmax 输出 | 854×480 / 15 fps / 171 帧 / 11.4 秒 | 使用上游 `sandbox.render.render()`；FFmpeg 全片解码无错误 |
| 人工注入 NameError | 正确返回错误类型与类别 | 验证真实错误反馈；恢复正确 fixture，不算 AI 自动修复 |
| 上游四帧采样 | 通过 | 使用真实 ffprobe 和 ffmpeg；已查看采样图 |
| 真实 API 生成 / VLM 审看 / 记忆提升 | 未测 | 无法从 mock 测试推断生成效果、审美提升或成本 |

环境依赖通过项目虚拟环境隔离。上游 `requirements.txt` 含旧集群的 `+computecanada` 版本和失败日志，不能作为普通机器的有效锁文件；安装使用 `pyproject.toml`。本次成功环境见 [python-packages.txt](python-packages.txt)。

四帧显示了有符号 logits、正质量、共享总量堆叠、总长度固定的概率分区。最小几何案例能检查身份与数量关系，但缺少足够的 exp / 归一化语义提示、镜头与过渡设计，不能算成品艺术质量。未测试 LaTeX，fixture 无文字公式依赖。

许可证：`pyproject.toml` 声明 MIT，但测试提交缺少独立 LICENSE。当前只调用独立克隆，不 vendoring 上游源文件。

## OpenMotion

固定提交：[`1c93d99`](https://github.com/Yuan-ManX/open-motion/tree/1c93d99b064e8674f244a8f24227358ec6f61618)。

| 检查 | 结果 | 实际含义 |
|---|---|---|
| 安装依赖 | 通过，Node 22.22.1 / 382 包 | `npm install --ignore-scripts`，未运行安装脚本；官方 registry 的 Node TLS 连接失败后改用单次镜像参数 |
| 原生类型检查 / 构建 | 失败，服务端 19 条 TS 错误 | 缺少 `routes/batch`、`templates/crystalCascade`，并有事件与建议类型不匹配；客户端检查被前序失败阻断 |
| 原生启动 | 失败，ERR_MODULE_NOT_FOUND | `server/app.ts` 导入的 `routes/batch.js` 对应文件不存在 |
| 额外构建门槛 | 静态确认 | package script 引用的 `scripts/postbuild.mjs` 未提交；尚未执行到此步骤 |
| 原始模块：schema / HTML | 通过 | 绕过完整服务，直接通过其安装的 tsx 加载原始模块 |
| 组件编辑 | 通过 | 单组件改时长与颜色，导出的 HTML 变化 |
| 变体生成 | 9 个变体，原始 spec 不变 | 测试 duration / easing / intensity 三轴 |
| 结构性评分 | 96 / 100 | 只是 spec 规则评分，不评估数学语义或实际画面质量 |
| 浏览器关键帧 | 通过，无 pageerror | 在 0.8 / 4.5 / 7.5 / 11.5 秒暂停 CSS 动画采样 |
| 原始 recorder 模块 | 可运行，但时间不准确 | 12 秒意图，528 帧；以 30 fps 编码后实测 17.6 秒 |
| 完整应用编辑 / 持久化回滚 / 视频 job / AI 生成 | 未验证 | 完整服务启动失败；独立模块结果不可当作全应用通过 |

录帧问题：上游 `recordFrames()` 使用 `Page.startScreencast` 实时接收帧，每次回调保存一张图，不按目标帧时间采样。其 `fps` 参数未参与捕获，视频路径以目标 fps 编码所有帧。此次独立调用 recorder 后，使用相同的 30 fps 输入和 scale/编码方式确认输出为 528 帧、17.6 秒。这里没有执行完整的导出服务 job。不同机器的帧数与偏差可能不同，单次测量不能当作固定倍率。

已经查看四张关键帧：三种颜色保持身份，正质量进入同一堆叠并转为比例分区；无明显裁切。最后三段宽度和为 600 px，比例与数值参考一致。但同样不足以证明无文字的数学过程可以被普通观众理解，结构评分 96 不解决这个问题。

许可证：独立 MIT LICENSE 存在。依赖锁存为 [npm-package-lock.json](npm-package-lock.json)，用于记录本次环境；不是新项目自身的 npm 依赖。

## 对新仓库的决定

- 保留独立参考克隆和固定提交，不立即 fork 成整套基础设施。
- 采用 Codex 官方桌面 / CLI 的订阅身份，普通本地工具处理渲染、数学检查与证据，不要求另购 API 才能起步。
- 借鉴 Paper2Manim 的每场景错误反馈与审看接口；先验证真实视觉修改效果，再考虑复杂记忆模块。
- 借鉴 OpenMotion 的可编辑组件与变体接口。完整服务和录帧问题解决前，不采用其作为主运行时。
- 固定 `t = frame_index / fps` 驱动画面，导出帧数与时长必须可核验。

下一次评测需要使用同一冻结 brief，多次真实生成，比较数学正确性、视觉可读性、修正轮数和人工介入。订阅 CLI 的自动调度适配、上游真实 VLM 与全 GRU 网络仍待验证；本轮未对两者作艺术排名，也未测模型用量或 API 成本。

结构化结果见 [results.json](results.json)。原始测试日志、视频和 PNG 保留在本机 ignored `raw/` 与 `artifacts/` 中，交付副本另放在当前会话 outputs 下。
