# 无模型调用的事实导入和技术修改

这两个入口都不会调用模型。事实导入只检查结构和刺激身份；技术修改由维护者提供原因假设与精确补丁，只自动执行重渲染与保留/回退。实际结果与限制见[七项控制](../evaluation/2026-10-04/offline-feedback-v2/REPORT.md)。

## 事实响应导入

使用原 v3 包的 `stimuli-frozen.json`、`oracle.json` 和忽略目录中的实际视频/原帧/联系表。缺少媒体或哈希不一致会拒绝，不自动用当前画面冒充旧刺激。原包及其结果不修改。公开仓库不含媒体，新机器需要根据原冻结源码、工具和采样重建到新版本包；若哈希不同，记录新刺激身份。

响应批次格式如下；示例哈希需替换成所供给材料的实际值。`kind: mock` 表示模拟输入；实际外部裁判使用 `external` 并另外归档事先固定的模型、提示、预算和调用记录。

```json
{
  "kind": "mock",
  "reviewer": "schema example; no judge ran",
  "stimuli_sha256": "sha256 of frozen stimuli.json",
  "responses": [
    {
      "id": "H9",
      "status": "completed",
      "contact_sha256": "sha256 of supplied contact.png",
      "label": "contradicted",
      "observations": [{
        "time_s": 17.5,
        "frame_sha256": "sha256 of supplied frame-17.50.jpg",
        "object": "correction arrows",
        "description": "Concrete observation of the supplied geometry"
      }],
      "limitations": "Six still frames; unsampled motion not judged"
    },
    {"id": "T2", "status": "call_failed"}
  ]
}
```

标签只能是 `supported` / `contradicted` / `unverifiable`。证据不足也需要指出实际看过的供给帧和缺少什么。重复 ID 或未知 ID 拒绝整批，不能当新独立样本。单项格式/哈希错误记录 `invalid`，未提交记录 `missing`，请求失败记录 `call_failed`；有效的 `unverifiable` 单独列出。

```bash
python3 tools/score_fact_responses.py \
  --pack evaluation/2026-10-03/judge-fact-probes-v3 \
  --responses path/to/responses.json --out work/my-screen/result.json
```

报告三种事实、三种真值的混淆表。`标签符合率 = 正确标签数 / 全部预设控制数`；另报 `有效响应覆盖 = 有效标签响应数 / 全部控制数` 和 `有效响应内符合率 = 正确标签数 / 有效标签响应数`。分母为零时值为 `null`。这些都是事实控制统计，不是艺术分、论文质量分或人类看懂率。导入器不能判断观察内容是否真实；12 个合成控制也不能给普遍裁判可靠性证书。

## 一次技术补丁

票据示例见[冻结票据](../evaluation/2026-10-04/offline-feedback-v2/tickets/join-fix.json)。必须绑定全部原始素材哈希、基线 render manifest/checks、缺陷帧及对象，填写假设、预期、目标检查代码、允许修改文件、保护时刻与停止条件。补丁使用已有 `apply_edit.py` 的唯一精确匹配格式。

```bash
python3 tools/feedback_cycle.py \
  --ticket path/to/ticket.json \
  --scene path/to/scene-directory \
  --evidence-run path/to/original-full-render \
  --out work/my-ticket-attempt
```

需要 Python、Node 22+、Playwright/Chromium、FFmpeg/ffprobe。通过 `C2M_NODE`、`C2M_NODE_MODULES`、`C2M_CHROMIUM`、`C2M_FFMPEG`、`C2M_FFPROBE` 指定已有运行环境，不安装新依赖。渲染需要本地回环端口和 Chromium 执行权限。研究控制脚本沿用仓库此前记录的本机运行时路径；通用单票据入口由环境变量指定。

输出新目录含 `ticket.json`、工具快照、before/candidate/after、process 日志和 `decision.json`；不覆盖原版本。`active_source` 记录下一轮应使用的版本。回退只指回基线，失败候选和渲染不删除。这是可追查的版本选择，不替用户覆盖项目或修改 Git 分支。

一次票据最多一个补丁、两次渲染、每次至多 90 秒；超时终止渲染进程组，不自动重试。基线证据过期拒绝；基线重渲染不能重现证据则停止。目标必须在独立采样和全视频帧检查都消失，候选导出/解码/重复时刻确定性必须通过，无新增检查代码，保护帧必须完全相同。

保护范围有限：只强制精确源码编辑和指定时刻整幅 JPEG 字节一致。没有通用对象级约束，没有所有连续时刻保护，同一种检查代码变严重不一定能检出。保留不代表总体检查全过，更不代表艺术或教学质量提高。表达裁判反馈自动生成票据和 AI 修改尚未接入。
