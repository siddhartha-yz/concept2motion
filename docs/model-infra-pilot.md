# 弱生成模型、强最终裁判：可复核的小对照

执行器是 `tools/model_infra_pilot.py`。它沿用当前数学渲染契约，测试
**确定性检查反馈能否改善弱模型的修订结果**，不引入新 agent 平台。
不是整个 concept2motion 设计的最终证明。

| 组 | 生成模型 | 候选版本 | 收到的修订信息 |
|---|---|---|---|
| A | gpt-6-luna | 一版 | 无 |
| B | gpt-6-luna | 三版 | 前版源码、同样抽帧、执行错误，普通自查 |
| C | gpt-6-luna | 三版 | B 的全部信息，另加确定性检查的具体发现 |
| D | gpt-6-astra | 一版 | 无，作为参考 |

A/B/C 共享同一初稿。每个任务独立产生两份初稿，B/C 的后续调用分别
使用新上下文。所有组收到同一 brief 和证据协议；只有 C 的修订提示
包含检查反馈。B 没有被故意剥夺图像、执行错误或自行改进的机会。
强模型裁判始终不参与作者的修订。

B/C 的作者调用次数、reasoning、源长度软限制、导出入口与超时相同。
它们实际 token 数可能不同；不能把相同调用次数写成相同计算成本。
初稿共享在每组单独运行的成本表中分别计入，在实际唯一调用表中只算一次。

两个任务是已有 Softmax/residual 契约家族、换了数值，18 秒/854×480/15fps。
任务并非广泛的未见概念，因此结果仅为探索性证据。固定最后一版，
不挑最好版本、回退或在模型失败后偷偷增加恢复调用。

裁判先检查旧的四个负对照，再看最终匿名联系表。四组同时呈现，
附件顺序正反各一次；每条片按四项明确要求给出画面证据，比较六对。
顺序导致 C/B 胜负变化就记为未决，不能只选有利的审查。
真实视频导出与完整解码、数学检查、静帧视觉审查各自报告。
没有观看人类答题、完整连续运动或显著性测量。

从仓库根目录运行各个明确阶段：

```bash
python3 tools/model_infra_pilot.py prepare
python3 tools/model_infra_pilot.py calibrate
python3 tools/model_infra_pilot.py generate
python3 tools/model_infra_pilot.py sheets
python3 tools/model_infra_pilot.py judge
python3 tools/report_model_infra_pilot.py
```

模型调用通过已登录官方 CLI；无凭据提取或通用 API 转换。渲染依赖
复用工作区现有隔离环境，路径在 `render_environment()`。生成和裁判
调用最多四并行，每次 240 秒；渲染每次最多 120 秒。
候选每版的输入、源码、数学检查、导出、抽帧、反馈与调用都保留。
原始模型日志、视频留在 ignored work/，报告保存安全结构化结果和源快照。

首次 prepare 拒绝覆盖。完成的调用可复用，未完成的中断会明确停止，
不能悄悄当成新样本重试。冻结后修改脚本/协议必须建立新实验版本。
当前执行目录是 `evaluation/2026-10-02/model-infra-pilot-v1/`。

这轮实际结果没有证明增强：C 对 B 为 0 胜、2 负、2 不可比较；
不可比较来自双方无导出，不能记成视觉平局。完整记录见
[v1 报告](../evaluation/2026-10-02/model-infra-pilot-v1/REPORT.md)。

之后的 [导出与证据回归](../evaluation/2026-10-03/render-evidence-v2/REPORT.md)
原样重渲染全部 16 个最终候选，恢复 7 个导出，并抓到旧检查漏掉的
中间指数条形比例错误。另用手写正负对照验证绘图接口自动记录证据。
这是工程修复；没有新模型生成或盲审，不覆盖 v1 的失败与结论。

下一次能力对照必须创建新实验版本。将同样的绘图接口提供给所有组，
重新冻结共同 brief、提示、工具与调用预算；保留 B/C 同初稿、同修订
次数和固定最后版本。再比较导出率、机制错误和匿名画面判断，并记录
实际时间/token。仅 C 得到检查反馈，以隔离反馈的作用；若要单独测接口
的收益，应另设对照，不能把两个改动混成一个提升数字。

新版入口为 `tools/model_infra_pilot_v2.py`，目录为
`evaluation/2026-10-03/model-infra-pilot-v2/`。A/B/C/D 都获得同一冻结的
绘图接口；任务、调用数和最后版本选择沿用上述规则。四个裁判筛查
按顺序执行，首个同时检查当前服务能否接受请求；失败就停止，不增加
额外探测调用。作者与最终审查按最多四请求一批执行，失败批次保留，
不继续提交后面的请求。没有静默补调用或更换失败模型。

```bash
python3 tools/model_infra_pilot_v2.py prepare
python3 tools/model_infra_pilot_v2.py calibrate
python3 tools/model_infra_pilot_v2.py generate
python3 tools/model_infra_pilot_v2.py sheets
python3 tools/model_infra_pilot_v2.py judge
python3 tools/model_infra_pilot_v2.py report
```

`prepare` 拒绝覆盖既有实验。工具、提示、输入或附件变化时续跑拒绝，
成功和失败请求都保留，失败不能通过重复命令变成一个新样本。
完整运行预定 24 次独立作者请求、4 次裁判筛查和8次最终审查。
`report` 在中断时也能记录实际调用与未完成状态，不能给出完整质量结论。
当前代码的 60 项 Python 测试通过（包括模拟调用）；实际模型请求、
渲染和视觉结论另见 [v2 报告](../evaluation/2026-10-03/model-infra-pilot-v2/REPORT.md)。

## 已完成的 v2 与 v3

v2 实际 36 次请求、32 次完成，4 次最终裁判因额度失败。原预算结果保留：
两个配对缺审查、两个缺视频。另获授权的 4 次补审单独记录，全部完成；
补充分析 C 胜 1、B 胜 0、未决 1、缺视频 2，不回写原实验的完成率或成本。
[独立补充批次](../evaluation/2026-10-03/v2-review-supplement-v1/REPORT.md)。

v3 提供相同显式 reveal/timeline 接口，B/C 从 A 共享初稿各固定修订一次，
A/D 保留技术参考。裁判只看 B/C 两张匿名联系表，交换附件顺序；
已有四项筛查只作基础筛查。16 次作者 + 8 次裁判全部完成。
C 胜 1、B 胜 1、未决 1、缺视频 1。B/C 各导出 3/4；冻结技术通过 C 2/4、B 0/4。
**没有证明稳定的画面能力提升。**
[完整 v3 结果](../evaluation/2026-10-03/model-infra-pilot-v3/REPORT.md)。

v3 的作者请求次数比 v2 少，接口、数值和评判面板也变化；跨轮耗时/通过率
不能作为某个接口改动的因果效果。多个版本仍是两个已开发任务家族，
不能拼成更大的独立概念样本。正确数学、固定布局约定、画面事实与艺术判断分别看：
输出水平原点不一致可能是布局协议限制，而非算术错误。

新的[事实对照包](../evaluation/2026-10-03/judge-fact-probes-v3/REPORT.md)
保持正确文字，只改变箭头接点/指数比例/最终完整度；正负条件平衡。
12 个控制已实际渲染并完整解码，匿名抽帧固定；**没有外部裁判结果**，
不能宣称裁判已经通过它。它不提供艺术或人类教学真值。
相关研究与适用边界见[原始论文补充](../evaluation/2026-10-03/judge-research/REPORT.md)。

看 B/C 视频与两个顺序的具体理由，可构建只读证据页：

```bash
python3 tools/build_pilot_view.py \
  --experiment evaluation/2026-10-03/model-infra-pilot-v3 --out work/my-view
python3 tools/serve_pilot_view.py --view work/my-view --port 0
```

服务只读取页面列出的证据文件，输出 localhost URL；支持成对跳转/播放。
实际浏览器验证见[证据页报告](../evaluation/2026-10-03/pilot-view-v3/REPORT.md)。
页面没有模型请求、自动判分或新的艺术接受。
