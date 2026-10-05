# ALGOGEN 原筛法样例：原依赖、原轨迹、原渲染

运行前固定。源码 https://github.com/algenlab/algogen_anonymous ，提交1bb093c76499135ecf54fc8030219a4e7ee4424c。选上游发布的outputs/CASE/array_leetcode_204_seed_01/trace.json（埃拉托斯特尼筛法，n=10、12个delta），不改输入，不缩短场景，不使用随仓库已有视频作为本次渲染结果。

隔离安装原requirements，保留安装失败与修复；借用已有图形开发头文件，只修本机安装环境，不改上游版本。原renderer/manim_renderer.py CLI使用原支持的--quality low_quality、--codec默认mpeg4；不启用fast，不改原时间参数。全部渲染结果必须实际全解码、核对帧数，并抽六帧（5%、25%、45%、65%、85%、98%帧索引）查看。若原复制路径未找到输出，单独登记路径问题和实际媒体，不伪装完整入口成功。

独立数学检查：仅从trace中应用updateValues重建最后T/F状态，用逐数试除独立算出小于10的素数集合{2,3,5,7}，比较全部10个位置与最后显示计数4。只核对这个固定输入的终态，不证明任意算法或中间解释正确。

额外执行原RSL semantic_check_rsl、rsl_to_render_config，但不调用LLM。原发布RSL，以及空RSL、超界run_time/scale/fps为预设控制；空对象通过只能说明该函数缺少完整结构检查，不叫完整语义验证。其结果与实际渲染、数学和已知来源的维护者看帧分别报告。

本批模型调用0、权重训练0、人类盲评0。上游保存的轨迹不算本次模型生成，原LLM工具制造/轨迹生成/样式生成/AES评价未执行。源码、资产、视频和完整日志在忽略目录；发布版本、哈希、原生执行入口和有限结果，范围仍是原30项。
