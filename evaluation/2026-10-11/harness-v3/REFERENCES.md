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
