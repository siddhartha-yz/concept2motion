# 研究图谱：问题、证据与下一步

更新时间：2026-10-06。下表是研究索引，提交按本次归档顺序排列；不伪装成过去逐日提交的历史。

**当前结论：局部预览更快，部分工程检查更可靠；尚未证明完整工具循环能稳定提高概念表达质量。**

| 研究问题 | 目前得到什么 | 证据与提交 |
|---|---|---|
| 有哪些可借鉴的基线？ | 固定上游版本，做有限复现和裁判筛查；不能直接沿用原论文成绩 | [基线调研](../evaluation/2026-10-02/baseline-research/REPORT.md)、[Code2Video 复现](../evaluation/2026-10-02/code2video-pilot/REPORT.md) · [f6ca121](https://github.com/siddhartha-yz/concept2motion/commit/f6ca121) |
| 弱模型能否因检查反馈而画得更好？ | 首轮 C 0 胜、B 2 胜、2 组不可比较；没有证明收益 | [v1](../evaluation/2026-10-02/model-infra-pilot-v1/REPORT.md) · [b0865c6](https://github.com/siddhartha-yz/concept2motion/commit/b0865c6) |
| 数值正确是否意味着图形正确？ | 增加独立几何、像素和阶段进度检查；范围限于已实现机制 | [接口与边界](math-evidence.md) · [3947d7c](https://github.com/siddhartha-yz/concept2motion/commit/3947d7c) |
| 检查器自己可靠吗？ | 保留正负控制、数值边界、元数据失败与原样重渲染；这些不是艺术评价 | [进度控制](../evaluation/2026-10-03/progress-controls-v3/REPORT.md)、[实际边界渲染](../evaluation/2026-10-03/render-math-stress-v3/REPORT.md) · [ebbc21d](https://github.com/siddhartha-yz/concept2motion/commit/ebbc21d) |
| 复用环境能否缩短等待？ | 同一两秒片段的 8 对测速：中位数 0.533 秒对 0.858 秒；不含模型生成 | [测速](../evaluation/2026-10-03/math-preview-latency-v1/REPORT.md) · [592059e](https://github.com/siddhartha-yz/concept2motion/commit/592059e) |
| 同接口、同修订次数下有质量提升吗？ | v3 四组：C/B 各赢一组，一组未决、一组缺视频；未证明稳定优势 | [v2 与额度失败](../evaluation/2026-10-03/model-infra-pilot-v2/REPORT.md)、[v3](../evaluation/2026-10-03/model-infra-pilot-v3/REPORT.md) · [75630a5](https://github.com/siddhartha-yz/concept2motion/commit/75630a5) |
| 有没有可信的现成评分？ | 原函数已有局部执行；本轮 48 次裁判尝试只有 16 次可用，仅覆盖四个残差控制；尚未验证可靠性或复现完整论文成绩 | [论文核查](../evaluation/2026-10-03/published-metrics/REPORT.md)、[本轮执行与失败](../evaluation/2026-10-04/reproduction-status-v1/REPORT.md)；原控制包 [aa4ec74](https://github.com/siddhartha-yz/concept2motion/commit/aa4ec74) |
| 仓库到底承诺什么？现在该训练吗？ | 明确可证伪假设、约束与三项缺口；先验证反馈循环，后训练仍是候选实验 | [定位](positioning.md)、[模型策略](decisions/2026-10-04-model-strategy.md)、[Harness 参考](decisions/2026-10-04-harness-reference.md) · [585b582](https://github.com/siddhartha-yz/concept2motion/commit/585b582) |

此前无新额度的执行边界见[离线反馈设计](decisions/2026-10-04-offline-feedback.md)：先准备事实响应校验，再用已知控制验证技术修改与回退；不把它算作新模型或表达质量结果。本轮随后获得的新授权单独记录如下。

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

## 参考复现盘点与新授权

用户为本轮新增授权最多 48 次官方 Codex 调用。[固定设计](../evaluation/2026-10-04/reproduction-status-v1/DESIGN.md)先盘点每个参考的实际执行程度，再补 TEA/PhyEduVideo 原函数执行与三种评价入口的控制测试。设计先于调用冻结；更换模型和输入的部分不称为原论文成绩复现。

[执行结果](../evaluation/2026-10-04/reproduction-status-v1/REPORT.md)：30 项一手参考逐项盘点，[六个项目有部分执行](reproductions.md)，无完整论文成绩复现。TEA/PhyEduVideo 原函数 12/12 预设行为得到验证，其中包括漏抽尾段、除零和缺失项跳过等负结果。48 次裁判尝试只有 16 次可用、32 次账号额度失败；事实重复各 4/12 覆盖，不能证明可信评分。设计 `57ced1e`、固定调用器 `23e5bc1`、原函数结果 `ada5408`、停发保护及模拟检查 `2ebdab5`；失败不重写，保护未用于本次冻结批次。下一步仍先补评分覆盖，再修改循环与未见任务。

## 完整复现持续目标

用户要求完成复现后再报告，并新增授权最多 96 次官方 Codex CLI 尝试。[完整范围设计](../evaluation/2026-10-04/full-reproduction-v1/plan.json)保留全部 30 项参考，逐项登记直接证据和尚未满足的条件；不把局部函数控制或更换模型的成绩等同完整论文结果。源码获取、隔离安装、原测试、原渲染和本地公开权重运行继续推进，目标仍 active。旧 48 次账目和失败不改写，原始日志与依赖在忽略目录。


## 2026-10-05：评分控制补齐，原流程与负结果继续冻结

[新增记录](../evaluation/2026-10-04/full-reproduction-v1/REPORT.md)：新增 96 次授权已用 35（34 有结果、1 额度失败），余额 61；旧 48 次不改写。同一固定 12 个控制的两个事实重复各覆盖/标签匹配 12/12，仍只有两个概念和 12 个独立样本，不能升级为一般可靠评分。TEA 单帧 12/12、AES 11/12，是更换裁判与稀疏帧的改编。事实进口校验和维护者画面检查分别保留。

新增原安装/测试：manim-bench 105，Math-To-Manim 268，RLM 271 通过/63 跳过；realtime 包 35 与 web 文件 1，通过的部分和 Python/Rust/WebGPU 失败分开。Math-To-Manim 原保留示例真实重渲染 97.933 秒/1469 帧，独立差分核对四个 Morse 临界点。Phy 原 CLIP 局部函数使用固定免费权重，本地 CPU 真实推理；没有训练或完整原权重评价。ManiBench 返回的视频退出后被删、skip_render 误报成功，VBench 空白静态得 1/单帧非有限，作为负结果保留。

原坐标题完成 1 作者、1 图片定位、1 修改尝试。模型补丁多一个括号被拒绝；人工只修语法后的版本重渲染，目标标签位置移开，数学/帧数不变、保护帧一致。保留的是带人工参与标记的版本；无自动改善、盲评或未见任务收益结论。全仓 87 Python、5 Node 测试文件通过；所有原 30 项完整成绩复现仍未完成。

用户截图消息核查见 [Karpathy 输出理解建议](research-notes/2026-10-05-karpathy-output-understanding.md)：原帖文本与截图一致，偏向让输出便于监督理解。可借鉴具体帧证据和容易核对的修改说明；消息及其关联技能实现不提供本项目质量验证。没有安装该插件或调用旁白 API。

## 2026-10-06：原数据恢复与真实答题的失败边界

[SVGEditBench V2](../evaluation/2026-10-05/svg-editbench-v2-native-v1/REPORT.md)全部1683题原样恢复，每题6文件齐全；原nop/perfect两组各1683项MSE均有限，均值0.06132848/0。三个预设任务执行原轮廓距离，四个手写控制查出颜色盲区、空图错误和中心旋转坐标错误。原CLIP/DINO、模型编辑与艺术评价未执行，不称完整论文实验复现。设计 `2b00781`，运行器 `683e8de`，结果 `94fa94e`。

[TeachQuiz第一次真实调用](../evaluation/2026-10-05/teachquiz-codex-port-v1/REPORT.md)14次得到11个结果，3次额度失败后停发，1题未发；失败冻结 `4a47c34`。[四次补齐](../evaluation/2026-10-06/teachquiz-completion-v1/REPORT.md)另行冻结 `be43648`，不改旧批次。15个入口合计18次尝试；原缓存重放普通/禁用/画面后为5/5、0/5、5/5，严格入口在画面后一题格式无效，因此仍不报告增益。模型看画面前已答对全部题，拒答不证明遗忘，后续答对不证明学习。

新96次总账累计53：49完成、4无结果，余43；旧48不改。截图建议已落实为具体画面与可核对修改记录，未用消息做效果证明。原30项范围继续保留；[来源可用性更新](../evaluation/2026-10-05/reference-availability-v1/results.json)记录Animation2Code仍标代码/数据待发布、EduVideoBench匿名链接401，以及VidCode/VideoEditBench的来源边界。
