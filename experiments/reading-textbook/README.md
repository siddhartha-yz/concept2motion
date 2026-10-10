# 阅读教材实验

先看 `outputs/reading-textbook/index-portable.html`。它是单个文件，双击即可用现代浏览器阅读，不需要账号、模型接口或本地服务器。`book-01-portable.html`、`book-04-portable.html` 将三个补充图解放回整册教材。其余 19 个文档在 `library.html` 中，保持静态阅读。

源码在这个目录；第三方代码、课程全文、构建输出和测试截图分别留在忽略的 `work/`、`outputs/` 和 `evaluation/**/raw/` 中。不要把课程全文当成可以随意公开发布的软件资产。

## 本轮边界

这是一份可运行的框架实验。当前会话编写了三个图解和 12 段对应讲解，随后执行数学、图像和浏览器检查。它没有自动为全部课程编写图解，也没有完成新的音频转写，更没有做真人学习效果实验。

默认停留 170 毫秒切换段落，这是可调整的实现选择，不是研究得出的最佳参数。不要把光标位置解释为眼睛位置。触屏使用“阅读位置”，也可选择完整静态图或只读文字。

## 从固定版本重建

下面命令在项目根目录执行。需要 Git、Python 3.12 或更新、Node 24、npm、Zig 0.16.0。仅浏览成品不需要这些工具。本轮实际用 Node 24.19.0、Zig 0.16.0；本地路径可以换成对应程序。

第三方固定版本记录在 `evaluation/2026-10-10/reading-textbook-v1/upstreams.json`。若目录不存在，先克隆，随后显式检出该提交；不要让下面的 `checkout` 覆盖自己修改过的第三方文件。

```bash
mkdir -p work/reading-textbook/upstreams
git clone https://github.com/LINJIANG12/video2book-courses.git work/reading-textbook/upstreams/video2book-courses
git -C work/reading-textbook/upstreams/video2book-courses checkout --detach 0febad63d1bbeef886217effef59f3b2b0c86caf
git clone https://github.com/zjwqsd/zanim.git work/reading-textbook/upstreams/zanim
git -C work/reading-textbook/upstreams/zanim checkout --detach b17a62f979a44ce0f20ddfcb8533c07fca51f1d7

mkdir -p work/reading-textbook/clean-dependencies
cp experiments/reading-textbook/package.json experiments/reading-textbook/package-lock.json work/reading-textbook/clean-dependencies/
npm ci --prefix work/reading-textbook/clean-dependencies
export READING_DEPENDENCIES="$PWD/work/reading-textbook/clean-dependencies"
bash work/reading-textbook/upstreams/zanim/web/build.sh
python3 experiments/reading-textbook/build.py --npm "$READING_DEPENDENCIES"
node experiments/reading-textbook/import-books.mjs
node experiments/reading-textbook/portable.mjs
```

`package-lock.json` 保留了本轮使用的任务级 npm 镜像地址及完整包校验值；没有修改用户的全局 registry。若该镜像不可达，需要在任务目录重新生成锁文件并记录差异，不应悄悄升级依赖。Zig 构建需要可写缓存，本轮使用 `ZIG_GLOBAL_CACHE_DIR`、`ZIG_LOCAL_CACHE_DIR` 指向 `work/reading-textbook/zig-cache/`。页面的运行时只有自己的 JS、Zanim/WASM 和 KaTeX，不依赖原 reader。

最小依赖已在新的目录独立执行 `npm ci`，并实际执行过构建、整册导入和单文件打包。`READING_OUTPUT` 可以给两个 Node 构建脚本指定另一个绝对输出目录；与 `build.py --output` 配合即可隔离重建，不覆盖正在阅读的文件。原 Video2Book、Zanim Python/native、额外 reader 的复现工具环境与这个前端构建环境分开，详见最终报告。

## 加一个图解时应改哪些地方

1. 在 `content.json` 中写少量解释段落，明确每段对应哪个状态，并记录原教材路径与行号。只给真正需要图的地方加图。
2. 在 `math.mjs` 写可检查的数据计算；在 `scenes.mjs` 写图形。先保证回退和随机跳转结果一致，再考虑过渡效果。
3. 核对 `bindings.lock.json` 的文本、出处和状态映射。修改内容后构建拒绝旧锁是有意设计，不能直接关闭检查。刷新记录前应重新检查来源、数学和读图含义。
4. 如要放进整册，在 `import-books.mjs` 里列出固定原文标题。匹配不到或出现多个相同标题会停止，需要人工确定插入点。
5. 补齐简述、原文、计算结果、实际渲染、抽帧、审阅和修订记录。成功退出不能代替读图审阅。

现在三个图的布局是专门编写的，没有通用“任意概念自动画图”功能。静态回退与动态图使用同一输入，但布局还不同；开展严格真人对照时应改用动态图的同版截图，避免把排版差异混入实验。

## 检查入口

`check-build.py` 检查冻结输入与人为修改的拒绝行为；`check-controller.mjs` 检查输入规则；`check-document.mjs` 检查源码完整性、坏公式与输入策略，并与固定原 reader 实际比较。最后一项需要额外 reader checkout，只用于复现，不是运行时依赖。

浏览器检查需要 Playwright、Chromium 和一个临时本地服务器。`PLAYWRIGHT_MODULE_PATH` 指向安装了 Playwright 的 Node `package.json`，`CHROMIUM_PATH` 指向 Chromium 可执行文件。测试脚本创建自己的无头浏览器，不使用用户登录信息。

```bash
python3 -m http.server 8765 --bind 127.0.0.1 --directory outputs/reading-textbook
```

另一个终端执行：

```bash
python3 experiments/reading-textbook/check-build.py
node experiments/reading-textbook/check-controller.mjs
node experiments/reading-textbook/check.mjs
node experiments/reading-textbook/check-books.mjs
node experiments/reading-textbook/check-portable.mjs
node experiments/reading-textbook/sample-and-bench.mjs
```

不同修订使用 `CHECK_OUTPUT` 指向不同的忽略目录，保留失败结果。`check-document.mjs` 的当前输出路径是固定的；再次复现前请备份该目录。`soak.mjs` 和 `soak-input.mjs` 是定时合成操作，分别检查持续遍历和实际鼠标/滚动输入；它们不能证明用户确实理解或浏览器全部内存没有泄漏。

## 文件分工

| 文件 | 做什么 |
|---|---|
| `build.py` | 核对冻结输入，生成完整正文和静态回退，拷贝固定运行时 |
| `document.mjs` / `html-policy.mjs` | 保留原始章节区间，限制坏公式影响，处理导入内容 |
| `import-books.mjs` | 导入现有课程，按核对过的标题插入额外图解 |
| `controls.mjs` | 处理停留、回读、滚动、暂停和选择文字 |
| `app.mjs` | 将明确的段落状态送到图，加载失败保留可读页面 |
| `math.mjs` / `scenes.mjs` | 数据计算与实际 Zanim 图形 |
| `portable.mjs` | 把 JS、WASM、字体和图片装进单个离线 HTML |

正文导入与图解作者分开，出错时保留能读的文本。当前实现没有后台服务、聊天、用户账户、录屏器或自动评判平台。
