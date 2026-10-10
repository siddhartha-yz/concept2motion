你要把当前目录的完整教材变成优秀的段落内可视化教材。中文，保留原文与公式，不改source文件。阅读source.md的完整内容与锚点，source-map.json提供结构。source.json包含编译后的大段HTML和图片编码，仅给编译器使用，不要读取它来重复占用上下文；完整原文已经在source.md中。选择1–3个原书没有解释清楚的关系，允许有依据地零图；不要把原文段落再次塞进图。
本次工具路径 TOOL=/home/yang-zhi/文档/ChatGPT/concept2motion/work/harness-v3/frozen/phase1/tools/visualbook.mjs。把绘图计划写到book.json，调用构建和预览工具，查看实际桌面与手机PNG，自行修订。需要连续的0–1进度、真实因果参数、清楚的轴与短标签、安静但有设计感的画面。不要只把进度取整后切换静态图片。图解默认静止，由读者拖动、单步或主动播放；页面滚动只暂停。避免装饰卡片、说明墙和超过480px的桌面图。
两臂共享同一原文、基本任务、编译器、阅读运行时和预览检查。你的arm=direct。
运行 node TOOL build source.json book.json book.html --direct（TOOL换成上面绝对路径）。运行 node TOOL preview book.html preview-01 会得到真实PNG与report.json。至少预览一次并查看桌面和手机的图片。每次修改重新build，预览目录另起名。最多3次预览，1800秒会话上限；内部检查不能代替审美判断。失败保留，不自打分。
你使用普通SVG/DOM自行绘图，不调用VisualBook/Board库。draw收到svg,width,height,progress,params，可自己管理稳定SVG对象。
输出book.json形状和接口见下面。源码是function draw(input)，绘图后返回实际使用的facts；不要自称训练结果或实测性能。公式已经编译，不重写教材。最终写AUTHOR.md说明图的取舍、实际预览与修订、未解决问题。
禁止网络、其他模型或代理、读取账号配置与凭据、修改工具源码或任务外文件。只操作当前目录，不需要git提交。预览若因sandbox被阻断可按正常审批请求执行本地Chromium，不跳过安全控制。

# 模型可调用的可视化工具

先读取 source.md 的完整正文与锚点（source-map.json是结构，source.json是编译器内部数据），选择原书没有说明清楚的联系。输出 book.json：

```json
{"figures":[{"id":"one-idea","title":"短图名","afterAnchor":"章节-001","endAnchor":"章节-004","height":320,"mobileHeight":360,"summary":"最多一句必要的例子条件，不复制正文","stages":["观察","改变","比较"],"params":[{"key":"eta","label":"学习率","min":0.01,"max":0.3,"step":0.01,"value":0.1}],"code":"function draw({svg,board,width,height,progress,params}) { /* 绘图，返回实际数值 facts */ return {}; }"}]}
```

最多4图，推荐1–3图，也可合理跳过。每幅覆盖最多8个正文块，不交叠。height稳定，手机可用不同高度。progress 是读者控制的连续0–1，不能只Math.floor后切换整张画面；移动、展开、计算步骤需要适合原文的解释。参数应有因果意义。默认停在初始画面，读者可以拖动、单步或主动播放一次；滚动只会暂停，不推进图解。原文不要重写，图片和公式已经导入。

可选 `initialProgress`（0–1，默认0）、`durationMs`（1000–60000，默认8000）和 `checkpoints`（包含0和1的严格递增进度数组）控制初始视图、主动播放时长与单步位置。不要在源码中自行启动定时器或监听页面滚动。开启系统“减少动态效果”时，播放按钮禁用，拖动和单步仍可用。

## 命令行工作流程

使用任务给定的TOOL绝对路径：

```
node TOOL build source.json book.json book.html
node TOOL preview book.html preview-01
```

preview返回真实桌面/手机PNG和report.json，覆盖0、0.25、0.26、0.5、1进度，以及单参数两端、全最小/全最大参数在0.5/1进度的实际检查。不是所有参数组合穷举。用图片查看工具看画面，处理具体碰撞、越界、错误轴和解释问题。修改book.json后重新build并使用新preview目录，旧失败保留。两臂都有同一预览工具；direct加`--direct`并自行操作SVG DOM，不使用Board或VisualBook库。

预览的布局检查不证明数学或教学正确；返回facts须是画面实际使用的数据，不能自打分。不要访问网络、账号配置、外部凭据或改工具源码；只写当前任务目录。工具接受本地已授权生成源码，不是陌生代码上传服务。

构建和预览用MCP的build_book/preview_book，图片直接作为工具结果进入模型上下文。不要cat编译后的book.html或source.json来假装看图；源文、锚点和真实图片是分开提供的。每次修改后重新预览，导出哈希必须一致。

trace要求有限向量、同形有限梯度、eta≥0、epsilon>0、0≤rho<1和0..1000整数步。其step>0记录的gradient是到达当前theta时使用的上一位置梯度；需要当前位置梯度时重新用自己的gradient(theta)计算。sequence让同一个signal对象跨越各层，不用切换不同标记。普通Markdown可用--source-name注明原文归属。

最终检查：用inspect_frame({id,width,progress})查看最后预览的每幅图在1280/375下的0/1端点，图片直接返回，不消耗新预览。随后调用finalize_book({issues:[],mathCheckNote:"实际核对方式",limits:"未验证范围"})。issues必须如实记录所有已知未解决遮挡/数学/教学问题，不给自己打分。没有最终记录、记录过期或仍有已知问题，流水线停止导出。这个机制只能挡住已经被发现的问题，不能证明模型审美判断正确。

本轮有本地 visualbook MCP 工具。可以先用list_designs和show_design查看适合章节的可复用设计与真实图片。必须用 build_book 构建，再用 preview_book 预览；它直接返回真实桌面/手机PNG图片内容，不能仅凭文件路径或数值报告声称看过画面。观察图片后自行修订。CLI命令只用于读取原文和写book.json，不用shell替代图片预览。最多3次预览，不要更改工具源码。最后必须用inspect_frame检查每幅图在1280和375下的起点/终点，并用finalize_book记录数学核对、已知未解决问题与限制。不要因为数值报告零发现就隐瞒遮挡、错误解释或其它问题；有问题就记录，工具会停止导出。
