# 小型运行时与短循环

`runtime/concept-runtime.mjs` 负责确定性对象、相机、绘制层次、时间插值和命名动作。场景作者保留构图与 Canvas 扩展能力。[API](../runtime/API.md) 可直接交给模型；具体成片不成为运行时模板。

`tools/studio.mjs` 保持一个 Chromium 进程。每个请求冻结源码与运行时、创建独立加载 URL，渲染显式时间，保存新版本；失败后仍可接收下一请求。浏览器在多个 job 之间复用，页面和模块实例每 job 更新，不保留隐藏动画状态。

依赖准备：Node 22、Playwright 1.62.1 与 Chromium、Python 3、FFmpeg/ffprobe。`npm ci` 安装本仓库声明的依赖。已有工具可通过 `C2M_NODE_MODULES`、`C2M_CHROMIUM`、`C2M_FFMPEG`、`C2M_FFPROBE` 指定；Python 不要求模型 SDK。模型调用走已登录官方 Codex CLI，显式 low reasoning 与禁用本次无关 MCP 的配置写入实验 manifest，不读取登录令牌。

## 生成、预览、修改

```bash
python3 tools/iterate.py --run runs/pair-01
python3 tools/iterate.py --run runs/pair-01 --resume
python3 tools/audit_preview.py --run runs/pair-01
```

`iterate.py` 当前是雪花试验协调器，不是通用数学校验器：同一 brief 的 Direct 与 Infra 两臂，各有初稿、一次必要故障修复、同一局部反馈；每次模型调用最多 120 秒，每臂模型和渲染共享 300 秒。所有失败保留。初始化错误、程序状态与代数缺陷可触发一次模型小补丁，艺术质量仍需审看者给带时间点的反馈。初稿整段导出，时序修订只导出原片 4–8 秒，并检查区间外样本像素和角度时移。

续跑复用冻结输入、成功模型输出和既有预览；哈希、提示词或调用 schema 不一致时拒绝覆盖。既有失败调用保留，不隐式无限重试。完成首轮后实测续跑复用了 4 次调用，没有新增调用。原始实验与续跑计时分开。

绑定命名动作后可以跳过模型源码补丁：

```js
const T = rt.timings({
  'turn-one': {start: 0.8, end: 2.8},
  'turn-two': {start: 5.2, end: 7.2}
});
// 几何与运镜继续由 scene.mjs 绘制，动作插值使用 T 的区间。
```

```bash
python3 tools/retime.py --scene runs/candidate --result runs/preview/result.json \
  --action turn-two --shift -0.35 --out runs/candidate-earlier
```

它依据真实预览 metadata 的已注册区间，只改新版本的 `timing.json`；源码和本地资产保持字节相同。未知 ID、越界、过期 hash 和路径逃逸都会拒绝。它执行具体的时间修改，不理解任意自然语言，也不自动判定修改更美。

新模型生成可选择参数修订路径：

```bash
python3 tools/iterate.py --arm infra --run runs/parameter-pilot \
  --retime-action turn-two --shift -0.35
```

此路径已通过手动绑定的既有生成候选验证。包含新作者入口的整个命令尚未再次调用模型验证；不要把前一次生成对照当作该版本验证。

## 常驻预览 API

```bash
node tools/studio.mjs --runtime /path/to/frozen/runtime
```

stdout 返回 `origin`。POST `<origin>/preview`：

```json
{
  "sceneRoot": "/absolute/candidate",
  "out": "/absolute/new-preview",
  "arm": "infra",
  "from": 4,
  "to": 8,
  "fps": 24,
  "width": 960,
  "times": [1.8, 5.5, 9.8],
  "checksOnly": false,
  "timeoutS": 20
}
```

`scene.mjs` 导出 `createScene(rt)`，返回 `{meta,render(t)}`。若存在 `timing.json`，host 将 JSON 作为 runtime overrides 注入，不替换源码里的数字。Direct 的参数是 canvas，没有这个绑定接口。只采样时设 `checksOnly:true`，返回 `samples_ready`，不产生视频；连续导出返回 `preview_ready`。两者均不能代表艺术接受。

当前 host 固定 1920×1080、10 秒、离线资源和显式时间。它服务于已测的一个短 benchmark；运行时允许其他尺寸、时长和概念，扩 host 和机制检查应随新的案例验证。候选浏览器禁止外网，但此开发工具不是处理敌意源码的完备安全隔离层。

实际耗时与边界：[首轮同模型负结果](../evaluation/2026-10-02/infra-pair-v1/REPORT.md)、[参数修改与故障回滚](../evaluation/2026-10-02/timing-bindings-v1/REPORT.md)。首次人工适配、零模型参数操作、真实模型生成、真实视频及样本审看分开记账。

## 原生 Softmax / 残差的局部预览

已有 `index.html + window.C2M(version:1)` 候选可直接使用常驻 studio，
不必改成旧雪花的 `createScene(rt)` 入口。`arm: "math"` 需提供完整冻结 brief；
当前支持三分量 Softmax 与残差相加，时长不超过 60 秒。

```json
{
  "sceneRoot": "/absolute/path/to/candidate/source",
  "out": "/absolute/path/to/new-preview",
  "arm": "math",
  "brief": {"id": "softmax", "duration_s": 18,
            "inputs": {"logits": [-1, 0.7, 1.3]}},
  "from": 13, "to": 15, "fps": 12, "width": 960,
  "times": [4, 8, 14, 17], "timeoutS": 15
}
```

把 JSON 保存后 POST 到当前 studio 输出的 `/preview`，内容类型为
`application/json`。`sceneRoot/out` 必须是绝对路径；输出目录必须全新。
只需抽帧时加 `checksOnly: true`。抽帧可以位于片段之外，但须在 brief 时长内。
原生候选的 SDK 从候选源码快照保留，不偷偷换成仓库最新依赖。
数学检查器与捕获工具的实际版本另外保存。

`math_checks` 覆盖请求片段、指定样本和 seek 探针，包含数值、声明几何、
布局和可用像素。它不检查全片阶段覆盖。存在数学错误时仍可输出诊断草稿，
`math_checks.passed` 保持 false；绘图异常保留失败并允许下一次请求继续。
不存在整片 `render_passed` 或艺术接受。原生数学候选的确定性检查为 JPEG 字节，
和旧泛型候选的 PNG 检查分别标注。

[实际预览与异常恢复](../evaluation/2026-10-03/math-preview-v1/REPORT.md)：
2 秒 Softmax 草稿 0.444 秒，3 秒残差草稿 0.505 秒；均完整解码。
[8 对冷/热测速](../evaluation/2026-10-03/math-preview-latency-v1/REPORT.md)：
常驻中位数 0.533 秒，每次新启浏览器 0.858 秒（包括启动）；热启动成本另列。
16 条相同参数视频字节一致。这是本机单个源码的局部工程收益，未包含
模型生成、创作修订或艺术审看，也不代表全片质量或普遍延迟。
