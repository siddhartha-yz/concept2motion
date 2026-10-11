# 公开设计参考与使用边界

这份记录区分设计灵感、实际使用的库和复制源码。阅读文章不等于复现完整作品，也不把别人作品的质量算作我们的效果。

| 来源 | 核对内容 | 在工具中的用途 | 使用方式 |
|---|---|---|---|
| [Red Blob：制作线段绘制教程](https://www.redblobgames.com/making-of/line-drawing/) | 输入、算法、绘图分开；局部图层、拖动点、扩大命中区、逐步解释 | 共享状态、局部画布、可直接拖动的点、稳定对象 | 借鉴实现思路，未复制原教程源码或资产 |
| [Mafs：可移动点](https://mafs.dev/guides/interaction/movable-points)；[源码](https://github.com/stevenpetryk/mafs) | 坐标变换可嵌套；水平、垂直及函数约束；键盘操作 | region、约束拖动、手机重排保留状态 | 阅读固定提交 `e74a3ef465f4ddc98704814d2ae18b73a6cd9dae`，MIT；未引入 React 或复制实现 |
| [Tangle](https://worrydream.com/Tangle/)；[源码](https://github.com/worrydream/Tangle) | 文中参数连接同一模型；输入变化更新所有输出 | 共享参数与数值表示，后续评估局部可操作文本 | 固定 `ba35e8d3a4949b4c7ea81190b16c6cf1dbfd8c68`；Tangle.js 头部声明 MIT；未复制源码 |
| [Observable Plot：分面](https://observablehq.github.io/plot/features/facets) | 共享坐标下比较不同条件 | 响应式组合、同尺度小图比较 | 借鉴设计原则，使用现有 D3，不额外引入 Plot |
| [Bartosz：Mechanical Watch](https://ciechanow.ski/mechanical-watch/) | 对象连续变化、细节层级、读者主动控制 | 视觉层级、短标签、保留画面和连续操作 | 设计参考；未复制图片、三维模型、源码或作品资产 |
| [Dagre](https://github.com/dagrejs/dagre) | 有向图自动布局及边路径 | 计算图、程序依赖图等可复用组件 | 实际依赖，npm `@dagrejs/dagre@3.1.1`，MIT；npm gitHead 与 GitHub 提交 `c3ed0802cd98de74c21cff1f754689ebbb0f8dae` 一致；安装与使用证据另记 |

所有第三方检出位于 ignored `work/harness-v3/upstreams/`，先固定提交再阅读；没有修改上游源码。猜测的不存在 URL 不当作已读参考。Dagre 的传递依赖及导出许可证随实际安装核对，不能只凭仓库首页许可声明。

实际安装补充：Graphlib `4.0.5` 为固定传递依赖，两包归档与官方 npm 锁中 SHA512 完全一致；本机官方 CDN 的 TLS 失败后，从常用镜像取得同一内容，再离线 npm ci。已读实际安装中的 MIT 文件及 Dagre bundle LEGAL 文件，HTML 嵌入该许可声明，离线导出分别附带 Dagre / Graphlib 许可证。Graphlib gitHead 查询失败，不补造提交号。

进一步阅读：[Distill 的可组合解释界面](https://distill.pub/2018/building-blocks/)启发“选择、转换、连接几个表示，同时控制信息量”的组合方向；[Momentum 解释](https://distill.pub/2017/momentum/)作为优化轨迹与局部细节参考；[Seeing Theory 概率教材](https://seeing-theory.brown.edu/basic-probability/index.html)用于概率与多种表示的设计研究。均未复制资产、未将原作品作为我们已经实现的效果。

从这些参考提取的约束是：一幅图集中说明一个关系；颜色代表固定角色；直接操作对象时提供可辨认的把手与键盘；正文不复制到图里；积木能共享状态、重新排布、保留对象。最终是否好看仍要看实际画面，不能用这张来源表证明。

- [Explained Visually 条件概率](https://setosa.io/ev/conditional-probability/)：在实际浏览器看过原视角与P(B|A)视角，借鉴对象保持联系、组别颜色一致、实际/期望分开。未复制源码或图片；源码许可证未核实，不纳入依赖。默认两个条件概率恰好相等可能造成误解，示例应避免只用对称条件。
- [Explained Visually PCA](https://setosa.io/ev/principal-component-analysis/)：读过解释与拖动数据点的交互目的；新PCA组件是独立二维解析实现。
- [Distill 感受野](https://distill.pub/2019/computing-receptive-fields/) 与 [Red Blob 网格关系](https://www.redblobgames.com/grids/parts/)：阅读结构化参数、对象关系与输入域边界设计；未复制代码或资产。
- [Abramowitz–Stegun p299](https://personal.math.ubc.ca/~cbm/aands/page_299.htm)：公式7.1.26的扫描原书参考；已在浏览器直接读取扫描图，核实五个系数、p及erf误差≤1.5×10^-7；单点CDF界取其一半，区间概率取两端误差之和。不把文本索引本身当公式证据。
- [Prettier 3.6.2](https://github.com/prettier/prettier/tree/7a8b05f41574633fd3af5298f3eeaf33567ad3d3)：开发格式化器，MIT LICENSE已读。包来自npmmirror固定版本，镜像SHA512与实际lock一致；未核实官方npm元数据，源码标签commit和打包gitHead不能混为一谈。仅保留在忽略work目录。

进一步参考：[Setosa PCA](https://setosa.io/ev/principal-component-analysis/)实际看图并拖动数据点，借鉴同一批点跨坐标系保持身份和颜色；没有复制图像或代码。[Python Tutor](https://pythontutor.com/visualize.html)阅读其逐步执行说明并打开交互页面，正在检查引用与复制的运行示例。

[Augmented RNNs](https://distill.pub/2016/augmented-rnns/)、[Illustrated Transformer](https://jalammar.github.io/illustrated-transformer/)、[Matrix Calculus](https://explained.ai/matrix-calculus/)已读网页文本，尚未逐图复核，不记为已完成视觉参考。[NumPy strides](https://numpy.org/doc/2.1/reference/generated/numpy.ndarray.strides.html)与[broadcasting](https://numpy.org/doc/stable/user/basics.broadcasting)提供索引/形状规则原始文档，编程积木拟借鉴这些关系，不复制正文或成品资产。

Python Tutor已实际运行维护者输入的四行allocate/alias/copy/write示例，并使用Last查看共享引用与复制的最终图。借鉴对象身份、逐步查看和代码对应，不复制其源码/界面资产，也不沿用其全文左右栏布局。

### FFmpeg：固定帧动画文件

- https://ffmpeg.org/ffmpeg-filters.html#palettegen — 实际阅读palettegen/reserve_transparent与paletteuse段；用整段帧生成调色板。
- https://ffmpeg.org/ffmpeg-formats.html#gif-2 — 官方GIF muxer文档与本机实际help都确认loop=-1表示不重复。
- 本机已有FFmpeg 7.0.2-static，没有下载媒体或新的二进制。使用已有CLI，不复制FFmpeg源码。工具完整解码并抽样检查导出的GIF/MP4。

### 局部依赖与加权查询

[Distill Computing Receptive Fields](https://distill.pub/2019/computing-receptive-fields/)已阅读递推关系，并实际在浏览器把第一层kernel滑块从3改为2，查看连线变化。新实现独立计算单路径结构依赖，保留膨胀空洞、补零与步长；图形仅借鉴局部连线和在原对象上改变参数的组织方式。未复制源码或图像，不支持论文中的任意多路径网络。

[D2L Nadaraya-Watson](https://zh.d2l.ai/chapter_attention-mechanisms/nadaraya-waston.html)提供归一化核加权回归的教材条件；新组件按给定样本、指定带宽计算，曲线101点显示采样，未训练。圆面积而非半径与权重成正比，同一份权重可以接到矩阵。D2L源码与Apache2许可证仍使用本轮已固定的上游commit。网页读取不替代源码固定。

- [D3 contour 官方接口](https://d3js.org/d3-contour/contour)：实际阅读网格中心坐标、阈值区域与线性插值定义。新等高线积木按这些坐标约定连接现有D3 7.9.0，没有复制展示作品资源；依赖沿用ISC归属。
- [Distill: Why Momentum Really Works](https://distill.pub/2017/momentum/)：再次核对二次型、梯度与等高线交互的表达。借鉴“稳定背景＋读者控制当前位置”的结构；没有复制代码、插图或文章内容。新Rosenbrock和鞍点只是维护者输入的示例，不算生成或训练结果。

### 响应图、小多图与自动图例

[Observable Plot facets](https://observablehq.com/plot/features/facets) 和 [legends](https://observablehq.com/plot/features/legends)：阅读共享尺度、多图组织与图例来自同一编码的官方说明。没有复制代码或图像。新增 plot 图例直接由真实图层生成，拒绝同名标签，减少维护者看图时发现的“观测和预测都叫预测”的错误。

[TensorFlow Playground](https://playground.tensorflow.org/)：实际打开并查看其输入、隐藏层响应和输出的组织。参考仓库 tensorflow/playground 固定为 `02469bd3751764b20486015d4202b792af5362a6`，核对 Apache-2.0 许可证；没有检出或复制源码、图像、模型权重或界面资产。新增响应图是独立实现的 Canvas 颜色采样 + SVG 坐标与共享拖动控件，默认权重手动给定，不是训练复现。

[LAPACK QR with column pivoting](https://www.netlib.org/lapack/lug/node42.html)：核对最小二乘中列主元 QR 与秩的用途，不复制 LAPACK 源码，也不把本项目的简单秩阈值等同于 LAPACK 的完整秩估计。新拟合内核独立实现，另用现有 NumPy 2.2.6 的 SVD 和 SciPy gelsy 对24种配置核对。系数基底和非截距惩罚明确；训练误差不代表泛化误差。

### 根据生成缺口补的数值与阅读层

- [D2L Adam](https://zh.d2l.ai/chapter_optimization/adam.html)、[Adam论文](https://arxiv.org/abs/1412.6980)、[PyTorch 2.7 Adam](https://docs.pytorch.org/docs/2.7/generated/torch.optim.Adam.html)：核对整数步矩估计与偏差校正、平方根外ε约定。新实现独立编写，实际用已有PyTorch 2.7.1 CPU/float64做600步数值对照；没有神经网络训练、代码复制或学习有效性评价。
- [D2L Softmax](https://zh.d2l.ai/chapter_linear-networks/softmax-regression.html)：原文解释分类分数、交叉熵与梯度。新gradient-step可接softmax-loss；96个配置另用真实PyTorch autograd和SGD核对，并保留手设分数/一步更新边界。
- [D2L Multihead Attention](https://zh.d2l.ai/chapter_attention-mechanisms/multihead-attention.html)：依据原文拆头和转置顺序，新增通用逻辑tensor-reindex，另用NumPy的transpose/reshape核对124配置1984元素映射。没有复制上游实现，也不声称零拷贝或GPU测量。
- [MDN overflow](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/overflow)、[KaTeX Common Issues](https://katex.org/docs/issues.html)：核对局部滚动、焦点与完整公式显示。长公式保持内容与字号，开脚本时显式实现方向键/Home/End；禁用脚本保留局部CSS滚动。没有复制教程界面资产。

- 固定D2L Adam源码的PyTorch Yogi递推：新增Yogi采用该分支的sign(g²−s)、整数校正和平方根外ε约定，独立实现；未调用/复制原训练代码，默认ε明确不冒充原示例。额外24配置744更新用独立CPU float64张量递推核对；这不是torch.optim自带Yogi，也不证明二次状态无偏或收敛。
