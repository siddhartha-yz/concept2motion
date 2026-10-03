# 研究图谱：问题、证据与下一步

更新时间：2026-10-04。下表是研究索引，提交按本次归档顺序排列；不伪装成过去逐日提交的历史。

**当前结论：局部预览更快，部分工程检查更可靠；尚未证明完整工具循环能稳定提高概念表达质量。**

| 研究问题 | 目前得到什么 | 证据与提交 |
|---|---|---|
| 有哪些可借鉴的基线？ | 固定上游版本，做有限复现和裁判筛查；不能直接沿用原论文成绩 | [基线调研](../evaluation/2026-10-02/baseline-research/REPORT.md)、[Code2Video 复现](../evaluation/2026-10-02/code2video-pilot/REPORT.md) · [f6ca121](https://github.com/siddhartha-yz/concept2motion/commit/f6ca121) |
| 弱模型能否因检查反馈而画得更好？ | 首轮 C 0 胜、B 2 胜、2 组不可比较；没有证明收益 | [v1](../evaluation/2026-10-02/model-infra-pilot-v1/REPORT.md) · [b0865c6](https://github.com/siddhartha-yz/concept2motion/commit/b0865c6) |
| 数值正确是否意味着图形正确？ | 增加独立几何、像素和阶段进度检查；范围限于已实现机制 | [接口与边界](math-evidence.md) · [3947d7c](https://github.com/siddhartha-yz/concept2motion/commit/3947d7c) |
| 检查器自己可靠吗？ | 保留正负控制、数值边界、元数据失败与原样重渲染；这些不是艺术评价 | [进度控制](../evaluation/2026-10-03/progress-controls-v3/REPORT.md)、[实际边界渲染](../evaluation/2026-10-03/render-math-stress-v3/REPORT.md) · [ebbc21d](https://github.com/siddhartha-yz/concept2motion/commit/ebbc21d) |
| 复用环境能否缩短等待？ | 同一两秒片段的 8 对测速：中位数 0.533 秒对 0.858 秒；不含模型生成 | [测速](../evaluation/2026-10-03/math-preview-latency-v1/REPORT.md) · [592059e](https://github.com/siddhartha-yz/concept2motion/commit/592059e) |
| 同接口、同修订次数下有质量提升吗？ | v3 四组：C/B 各赢一组，一组未决、一组缺视频；未证明稳定优势 | [v2 与额度失败](../evaluation/2026-10-03/model-infra-pilot-v2/REPORT.md)、[v3](../evaluation/2026-10-03/model-infra-pilot-v3/REPORT.md) · [75630a5](https://github.com/siddhartha-yz/concept2motion/commit/75630a5) |
| 有没有可信的现成评分？ | 已核查论文公式和验证范围，尚未在本项目独立复现；新的图形事实控制只做了本地渲染 | [已发表评价研究](../evaluation/2026-10-03/published-metrics/REPORT.md)、[未执行裁判的控制包](../evaluation/2026-10-03/judge-fact-probes-v3/REPORT.md) · [aa4ec74](https://github.com/siddhartha-yz/concept2motion/commit/aa4ec74) |
| 仓库到底承诺什么？现在该训练吗？ | 明确可证伪假设、约束与三项缺口；先验证反馈循环，后训练仍是候选实验 | [定位](positioning.md)、[模型策略](decisions/2026-10-04-model-strategy.md)、[Harness 参考](decisions/2026-10-04-harness-reference.md) · [585b582](https://github.com/siddhartha-yz/concept2motion/commit/585b582) |

本轮无新额度的执行边界见[离线反馈设计](decisions/2026-10-04-offline-feedback.md)：先准备事实响应校验，再用已知控制验证技术修改与回退；不把它算作新模型或表达质量结果。

## 本轮零额外实验调用的推进

- [事实响应入口预检](../evaluation/2026-10-04/fact-import-preflight-v1/REPORT.md)：原冻结文件和实际刺激哈希核对通过，空响应明确保留 12/12 缺失；没有外部裁判结果，评分可信度仍未建立。
- [技术循环控制](../evaluation/2026-10-04/offline-feedback-v2/REPORT.md)：七项预设控制符合 7/7，四项保留、三项回退；14 次渲染尝试、13 次完整导出/解码。保留[首次环境失败](../evaluation/2026-10-04/offline-feedback-v1/REPORT.md)，不把手写修补当作作者模型或艺术收益。设计 `cbd8b51`，实现与失败归档 `d13f29a`；结果由紧随其后的独立提交归档。
- [未见任务准备](../evaluation/2026-10-04/unseen-task-plan-v1/REPORT.md)：登记三个新概念结构、隔离要求和启动依赖；没有生成或对照，未封存成盲测集，评分/阈值/新预算仍待固定。

## 评分代码是否会制造假成绩？

[固定评分逻辑重放](../evaluation/2026-10-04/metric-replay-v1/REPORT.md)查实三类反例：解释中的字母被当答案、AES 同分项因格式给出 80/16 两个总分、模拟请求失败被计为零分而制造 100 个百分点增益。14 个预设控制符合预期；原错误保留，新增严格计算入口。题集结构为 117 × 5 = 585，永猜 B 对发布答案得 296/585（约 50.6%），仅为探索算术诊断。设计 `55c0e62`，实现 `ebb155f`；没有新的实际裁判或视频评价，评分可信度仍未建立。

## 下一段研究的顺序

1. [评分](issues/evaluation-score.md)：固定一个现成评价方案，记录原样复现和改编的差异，先检验已知对错的控制样本。
2. [反馈到修改](issues/evaluation-to-revision.md)：把具体画面问题转成有定位、有保护范围的修改票据；修改后验证，失败保留并回退。
3. [效果验证](issues/repository-positioning.md)：固定预算和未见任务，对比普通修订与完整循环，再做组件消融。最终评测不参与修订。
4. 只有积累可靠的修改数据后，才考虑同一开源模型的训练前后对照；不预先承诺后训练收益。

每个里程碑分别提交设计、实现或结果，标题说明变化。旧实验不因新工具修好而被改写为成功；新增重跑用新目录和新记录。局部补丁、完整循环和模型训练的证据分别归档。

公开前检查见[发布审计](../evaluation/2026-10-04/publication-audit/REPORT.md)。视频、原始模型调用日志、第三方依赖和本地配置继续留在忽略目录；公开的是研究材料、工具和可核验的结果摘要。
