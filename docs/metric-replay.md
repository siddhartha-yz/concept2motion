# 评分计算的离线核验

目的：确认现成评分程序没有把答案、返回格式或服务故障读成错误成绩。不是测动画质量，也不是运行裁判。实测反例见[本轮报告](../evaluation/2026-10-04/metric-replay-v1/REPORT.md)。

## 重放原固定代码

上游导出留在忽略的 `work/code2video-reproduction/upstream/`，以既有提交和文件哈希清单验证。执行选定定义，跳过顶层提供商导入；使用模拟输入，不改上游源文件。新重跑使用新的输出目录，并先复制原 plan.json；prepare/run 拒绝覆盖已有冻结或结果文件。

```bash
mkdir -p evaluation/2026-10-04/metric-replay-v2
cp evaluation/2026-10-04/metric-replay-v1/plan.json evaluation/2026-10-04/metric-replay-v2/plan.json
python3 tools/replay_code2video_metrics.py prepare --out evaluation/2026-10-04/metric-replay-v2
python3 tools/replay_code2video_metrics.py run --out evaluation/2026-10-04/metric-replay-v2
```

只有 Python 标准库依赖。完整原版视频/API/CLI 流程没有验证；不能将这些命令报成真实评价或论文成绩复现。

## 严格计算入口

`tools/code2video_metrics.py` 是纯计算模块，没有模型调用。调用者提供冻结题目、答案和明确请求状态；不得只传成功请求而丢掉失败。

- `grade_answer(response, answer_key, mode)`：baseline 读首行答案；selective 读唯一 `EVIDENCE_STATUS` 和 `ANSWER` 字段。证据不足需配 `NULL`，分别保留无法判断、无效和错误。
- `grade_stage(questions, records, mode)`：题目带唯一 id、A–D 全部选项和正确字母；回应带题目 id、`status: completed/call_failed`、response。全部预设题都保留在分母中；未提交的题记 missing。截断列表不能伪装为完整阶段。
- `teachquiz(questions, stages)`：baseline、post_unlearning、post_video 三个阶段使用同一题集。公式仍为视频正确率减忽略先验知识正确率；任一阶段有缺失、请求失败或无效响应，就没有可报告的增益值。有效证据不足计入未答对，语义解释保留为未知；“可报告”只指记录完整，不代表已验证评分可信。
- `parse_aes(response, status)`：严格读五个有限的 0–20 数值，JSON 或明确的 `Dimension: score` 文本都相加。缺少维度、数值越界、非数、声明总分不符或请求失败返回独立状态，总分为 null，不填零分。

这些处理与原代码不同，必须标注改编。没有语义真实性检查，没有学生知识删除，没有人类学习结论，也没有给本仓库选择最终质量分数。
