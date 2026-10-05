# SVGEditBench V2：恢复数据与原生基线

固定日期：2026-10-05。上游和三个数据子仓库版本见 source-pin.json；运行前固定。保持上游源不变，所有资产、依赖、栅格图留在忽略目录。

先用原 1_rasterize_images.py 和 restore_dataset.py 恢复发布的全部 1683 个任务。全部 PNG 为原规定的 64×64、白背景；必须核对每题 before/after SVG、PNG、instruction、metadata 六个文件齐全。恢复失败不能缩小分母或临时填图。

执行原 inference/nop.py 的 nop_inference 和拼写为 pefect_inference 的目标复制基线。不调用原 GPT/Gemini/vLLM 服务；这两个基线不是模型生成。按原评价器 224×224 白背景渲染，执行原 MSE 函数。明确报告返回项数、丢失/失败、非有限值和完整 1683 分母，不以成功退出证明分数可靠。

轮廓计算 Python 双循环昂贵，先固定任务 ID 0000、0001、0002：两个基线共六项，原 chamfer_distance 每轮廓100点。另执行四个手写控制：相同形状、只换颜色、空白、rotate(90 10 20) 的中心坐标，检查轮廓指标的颜色/缺内容/变换盲区。变换用独立矩阵和 Cairo 实际像素作参照。它们不属于原论文任务分母。

完整 9_calculate_metrics.py 在 import 时会下载 CLIP B/32 和 DINOv2 giant；没有固定来源/权重前不执行。只运行 MSE/Chamfer 不叫整套评价完成。后续权重与模型生成采用新的独立冻结设计，预算仍统一扣剩余授权，不在本设计暗中新增调用。

安装范围仅原栅格化、恢复和 MSE/Chamfer 支路所需依赖，版本单独记载；没有原锁文件、没有安装全部 requirements，均如实写明。实际 SVG 画面、数学几何、技术指标与艺术/学习评价分开。静态 emoji 修改不证明动画时间关系或概念讲解质量。
