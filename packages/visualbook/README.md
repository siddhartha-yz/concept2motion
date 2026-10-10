# VisualBook 工具运行方式

这是可调用的教材生成工具，不是优质教材已经稳定批量生产的承诺。它使用官方 Codex 的现有 ChatGPT 登录，逐章串行调用；不提取凭据，也不调用额外代理。

## 安装与导入

要求 Node 22+、Python 3、官方 Codex CLI、Chromium。依赖和第三方固定源码放在忽略的 work/。

```bash
python3 experiments/visualbook/bootstrap.py --fetch
codex login status
```

如果 Chromium 未安装，使用 Playwright 官方安装入口。可用环境变量 CHROMIUM_PATH 指定实际可执行文件，不用绕过浏览器安全检查。

```bash
npm exec --prefix work/visualbook/runtime -- playwright-core install chromium
```

普通 Markdown 可直接输入。保留段落、代码、公式和本地图片；不默默下载远程图片，不忽略未知数学命令，不擅自删除原始HTML。D2L 的 Sphinx 宏、PyTorch标签和原图用固定源码适配器处理，不能当成普通Markdown直接扔进去。

```bash
python3 tools/run_visualbook.py my-chapter.md work/my-book --source-url https://example.com/original
```

D2L固定章节列表包含 upstream_commit、原文件哈希和 selected 路径；现成的随机样本可以这样导入：

```bash
node tools/visualbook.mjs import evaluation/2026-10-10/harness-v2/sampling.json work/new-sources
python3 tools/run_visualbook.py work/new-sources/programming.source.json work/programming-book
```

原始教材、模型事件与中间HTML都留在忽略目录。source.json是导入后的内容，不是任意网页代码的上传格式。

## 生成与交付

每章一次独立会话，最长1200秒，最多3轮候选预览；模型可以自己写计划、调用绘图工具、看真实桌面与手机PNG、修改后重试。没有用户逐轮反馈。共享设计负责稳定对象、坐标、字体测量、矩阵等布局；选什么关系、怎么解释仍需要模型判断。

输入可为普通Markdown、单章source.json、多章manifest：

```json
{"title":"我的教材","chapters":[{"id":"chapter-one","source":"chapter-one.source.json"},{"id":"chapter-two","source":"chapter-two.source.json"}]}
```

```bash
python3 tools/run_visualbook.py chapters.json work/my-book --max-chapters 3
```

最后预览必须匹配最终HTML哈希，公式完整，源文件和工具未被改动，图片确实返回给模型，渲染没有待处理问题，否则停止导出并保存 export-gate.json。停在诊断不等于教材完成；通过这些检查也不证明美观、严谨、易学。

成功后 book/index.html、各章HTML和许可证可以离线阅读。禁用脚本时显示真实渲染的初始图；它不能替代全部交互状态。完整正文保留，图按阅读位置或参数连续变化，不自动播放。默认最多3章，显式调整 --max-chapters 才扩大调用范围；目前不支持直接输入PDF/EPUB。

--resume只复用已有会话，不覆盖、不因为不满意而偷偷重复调用；原文改变必须另起目录。输入身份、调用用量、真实图片反馈、预览发现、失败和修订都留在会话目录。

## 不调用模型也能重建

```bash
node tools/visualbook.mjs build source.json book.json book.html
node tools/visualbook.mjs preview book.html preview-01
node tools/visualbook.mjs export book.html preview-01 offline.html
node tools/build_visualbook_catalog.mjs work/design-gallery
```

[接口和设计限制](API.md)给出完整方法。[本轮报告](../../evaluation/2026-10-10/harness-v2/REPORT.md)区分编译、实际渲染、模型生成、维护者复核和未做的用户审评。
