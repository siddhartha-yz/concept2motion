# 教材到可视化教材

这里帮助 LLM 给已有教材添加有用的段落内图解：固定原文和已有图，生成一两处补充图，实际打开、核对关系，再保存局部修改。当前支持的是六个 D2L 章节的实验；还不是任意教材转换器。

[方向与讨论](../../docs/decisions/2026-10-10-visualbook-direction.md)、[实验报告](../../evaluation/2026-10-10/d2l-visualbook-v1/REPORT.md)、[执行日志](../../evaluation/2026-10-10/d2l-visualbook-v1/LOG.md)。旧视频流程保留在自己的目录，不是新教材流程的前置依赖。Zanim 可选。

## 不消耗模型额度的重建

需要 Python 3.11+、Node 22、Git、npm。首次准备会联网下载固定 D2L 提交和锁定依赖，它们都放在忽略的 `work/visualbook/`：

```bash
python3 experiments/visualbook/bootstrap.py --fetch
python3 -m http.server 8768 --bind 127.0.0.1 --directory outputs/visualbook
```

打开 <http://127.0.0.1:8768/index.html>。每节 HTML 内嵌字体、公式、图片与图解，复制出去也能离线打开。以后只需 `python3 experiments/visualbook/bootstrap.py`；它会保留首版入口，再构建 `active.json` 中的当前版本。没有新模型调用。

D2L 源码中的正文、原图和 PyTorch 代码能固定重建。源码不带代码输出。下面的可选步骤只补入与源码代码唯一匹配的原版公开输出；网站构建提交未知，不能把它当成严格固定的源码执行结果：

```bash
python3 experiments/visualbook/fetch-snapshots.py
node experiments/visualbook/source-outputs.mjs
python3 experiments/visualbook/fetch-output-assets.py
python3 experiments/visualbook/bootstrap.py
```

实验匹配了35个公开代码单元中的20个；不猜测未匹配项，也不在本机假装执行 D2L 代码。完整原版始终有来源链接。D2L Apache 2.0、KaTeX MIT 许可证随 HTML 一起导出。

## 生成与修改

生成入口使用用户已通过 ChatGPT 登录的官方 Codex CLI。它会消耗现有账号额度，请先明确授权生成；不会提取登录令牌。这里记录的研究批次已用完8次预算，重建不受这个限制。下一轮应先记录新问题、抽样和有上限的预算，再设置新的证据目录。

当前步骤是：在抽样清单里固定新章节及来源 SHA → 导入全文、原图截图和已有输出 → 生成 → 查看页面并独立检查 → 审查 → 才将版本写入 `active.json`。生成器不会自行替换当前版本。

```bash
codex login status
# 示例：只有在另一个有明确授权的新实验中才运行这一条。
VISUALBOOK_EVIDENCE_DIR=work/visualbook/new-bounded-run \
  python3 experiments/visualbook/call.py section-id attempt-id \
  --image /absolute/path/original-figure.png
```

章节必须已经由 `prepare.mjs` 导入。更换章节目前需要维护采样清单和相应的数学核对；不要把这个示例当成“一条命令转换整本书”。下一轮默认使用 [v3生成要求](generation-guide-v3.md)，允许明确解释后的零幅图；它尚未经历真实生成评估。本批使用的 [v2要求](generation-guide-v2.md)、[首轮要求](generation-guide.md)和[原始schema](response.schema-v1.json)保留作对照。独立模型返回纯 SVG 函数，这只是当前后端；以后需要 HTML/Canvas 或 Zanim 时再加适配，不能把所有图强行做成 SVG。

阅读时，粗略滚动位置选中解释状态；“自己试一下”可以暂停跟随、调参数，再“回到阅读位置”。不是眼动追踪。短屏和减少动态偏好使用普通文中摆放。手机上图可能先滚出屏幕，后面的状态不一定与文字同屏；这是当前限制，需用户试读。

“记下问题”只下载本地 JSON，含来源与图版本、状态、参数。把文件转成修订输入：

```bash
python3 experiments/visualbook/feedback.py /path/note.json work/visualbook/revision-input.json
# 新的、已授权实验中，用 --feedback 传入；不覆盖旧候选。
```

工具拒绝过期图版本。意见仍须独立核对；反馈文件不是自动修复，也不会自动发给模型。

## 检查与证据

实际浏览器检查需要 Chromium。可设置 `CHROMIUM_PATH`；本机默认路径只是实验环境，其他机器应显式设置：

```bash
npm exec --prefix work/visualbook/runtime -- playwright-core install chromium
export CHROMIUM_PATH="$(node --input-type=module -e "import {chromium} from './work/visualbook/runtime/node_modules/playwright-core/index.mjs'; console.log(chromium.executablePath())")"
python3 experiments/visualbook/check-frozen.py
```

这个入口重新构建、独立数值复算、检查指定 SVG 关系、操作实际阅读控件，模型调用0。CI 也只做这些事。证据写入新的忽略目录，研究批次的旧失败不覆盖。单独检查并保存采样图：

```bash
node experiments/visualbook/audit-browser.mjs holdout-spatial layout-revised new-audit --full-controls
node experiments/visualbook/capture-reading.mjs new-reading-capture
```

数值检查与画法检查都是按已审查案例写的，尚无通用“教学正确性裁判”。标签越界/重叠检查也不能代替人看画面。`vm` 和语法检查用于防止误用，不是恶意代码沙箱；只运行已审查候选，不能接受陌生上传代码。

文件分工：

| 文件 | 用途 |
|---|---|
| sampling / holdout-sampling | 可追查的随机选择、固定上游与源哈希 |
| prepare | D2L语法适配、公式和图片导入、正文锚点 |
| generation-guide / schema / call | 生成输入、结构化输出、官方串行调用与预算 |
| candidates / active | 不可覆盖的候选、输入记录、当前版本选择 |
| build / app / style / theme | 文中图解、阅读位置、控件、静态降级和显示风格 |
| math-check / relation-check | 指定例子的独立数值与实际SVG关系 |
| audit-browser / reading-check | 实际渲染、来源保留和阅读操作 |
| feedback | 版本绑定的读者问题与局部修订输入 |

完整教材、第三方仓库、依赖、提供方原始日志和大量截图都留在忽略目录。Git 保存生成源码、来源定位、提示、检查摘要和失败/修订记录。只有实际用户试读，才能继续判断这些图是否值得保留。
