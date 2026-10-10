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
