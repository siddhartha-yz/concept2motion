# VisualBook 工具层

实际可调用绘图与布局代码在 viz.js，阅读进度与参数控制在 runtime.js。不是只把提示词包装成skill。模型通过 [API](API.md) 使用工具，仍负责图的取舍和解释。命令行入口：`node tools/visualbook.mjs catalog`、`import`、`build`、`preview`。

共享坐标/等比例、曲线、向量、实测文字排布、矩阵高亮和响应式流程。稳定图元id保留同一DOM对象；progress是连续数值，参数变化与阅读推进均可驱动画面，闲置时不请求新动画帧。支持减少动态偏好与键盘。gallery.json 是维护者编写的工具演示，不计入独立生成候选。

Math模块在编译层保留公式节点所需信息，逐块核对预期公式与渲染节点数。它修复的是漏渲染，不证明公式内容正确。preview检查实际桌面/手机、标签碰撞/越界、公式覆盖及连续小进度是否改变画面；布局检查仍可能误报，教学和审美需独立审看。

D3 7.9.0用于尺度、刻度、曲线和插值；npm锁在 experiments/visualbook/package-lock.json，依赖安装在ignored work/visualbook/runtime，上游checkout在ignored work/harness-v2/upstreams/d3。tag8186f1d496fef3cef9322d7ceeac1df11ddd30fd、实际commit1f8dd3b92960f58726006532c11e9457864513ec。采用[官方D3尺度](https://d3js.org/d3-scale/linear)和[插值](https://d3js.org/d3-interpolate/value)接口，导出须带D3 ISC及D2L/KaTeX许可证；没有复制未授权优秀作品的源码。

当前编译器接收导入的source.json，D2L适配器仍是主要入口。不是任意PDF/EPUB解析器，不是公共陌生代码上传服务。生成源码本地运行，只接受用户已授权的候选；CSP和预览不是恶意代码沙箱。工具不能保证任意教材均无需审查即可优秀。
