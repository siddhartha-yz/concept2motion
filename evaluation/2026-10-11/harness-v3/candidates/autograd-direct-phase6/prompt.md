你要把当前目录的完整教材变成优秀的段落内可视化教材。中文，保留原文与公式，不改source文件。阅读source.md的完整内容与锚点，source-map.json提供结构。source.json包含编译后的大段HTML和图片编码，仅给编译器使用，不要读取它来重复占用上下文；完整原文已经在source.md中。选择1–3个原书没有解释清楚的关系，允许有依据地零图；不要把原文段落再次塞进图。
本次工具路径 TOOL=/home/yang-zhi/文档/ChatGPT/concept2motion/work/harness-v3/frozen/phase6/tools/visualbook.mjs。把绘图计划写到book.json，调用构建和预览工具，查看实际桌面与手机PNG，自行修订。连续演示使用连续的0–1进度；直接拖动或调参数的图可声明interaction=parameters，静态关系可声明static。需要真实因果参数、清楚的轴与短标签、安静但有设计感的画面。不要只把进度取整后切换静态图片。图解默认静止，由读者拖动、单步或主动播放；页面滚动只暂停。避免装饰卡片、说明墙和超过480px的桌面图。
两臂共享同一原文、基本任务、编译器、阅读运行时和预览检查。你的arm=direct。
运行 node TOOL build source.json book.json book.html --direct（TOOL换成上面绝对路径）。运行 node TOOL preview book.html preview-01 会得到真实PNG与report.json。至少预览一次并查看桌面和手机的图片。每次修改重新build，预览目录另起名。最多3次预览，1200秒会话上限；内部检查不能代替审美判断。失败保留，不自打分。
你使用普通SVG/DOM自行绘图，不调用VisualBook/Board库。draw收到svg,width,height,progress,params，可自己管理稳定SVG对象。
输出book.json形状和接口见下面。源码是function draw(input)，绘图后返回实际使用的facts；不要自称训练结果或实测性能。公式已经编译，不重写教材。最终写AUTHOR.md说明图的取舍、实际预览与修订、未解决问题。
禁止网络、其他模型或代理、读取账号配置与凭据、修改工具源码或任务外文件。只操作当前目录，不需要git提交。预览若因sandbox被阻断可按正常审批请求执行本地Chromium，不跳过安全控制。

# 直接SVG对照的共同接口

读取source.md完整正文和source-map.json锚点。保留原文、代码、图片和已导入的公式。只输出book.json图解计划；最多4图，通常1–3图，不要求每段配图。每幅覆盖最多8个正文块，scope不能交叠。

figure包含id、title、afterAnchor、可选endAnchor、height（180..480整数）、mobileHeight（180..560整数）、最多一句必要的summary，以及`code:"function draw({svg,width,height,progress,params,state,controls}){...return facts;}"`。用原生SVG DOM绘图，稳定id更新同一个对象，避免清空重画。直接对照没有VisualBook绘图库、设计模板或scene计算/组件。

progress是读者手动控制的0..1连续值；不要监听滚动或启动定时器。默认停在0，支持拖动、单步、主动播放一次与暂停。可选initialProgress、durationMs（1000..60000）、checkpoints（严格递增并包含0/1）。只有有意义的变化才使用时间轴；`interaction:"parameters"`保留参数探索而不显示播放条，必须有实际生效的参数或把手；`static`没有控件。

params支持数字范围`{key,label,min,max,step,value}`、整数stepper（kind=stepper，step=1且bounds/value整数）和原生select（kind=select，value与options中的string/number/boolean值严格对应；options为2..8项`{value,label}`）。最多8个不同key。用controls.setParam/setState更新共享状态；重置恢复初始值。参数和图形应有因果关系，不能只改一个读数假装图解。

SVG文字宜短，图形补充原文缺失的关系，不重复正文段落。保持对象、颜色、坐标范围和对照条件一致；手机需要实际排布，不能把大图整体缩小到难读。返回实际计算使用的facts，注明例子条件、公式约定和未验证范围。手选权重不是训练结果；给定时间或内存大小不是硬件测量。

使用MCP build_book构建，preview_book查看实际桌面/手机PNG；最多三轮，失败也占次数。自动检查覆盖有限进度与参数取值，不是艺术或数学认证。实际看图后自行修订，错误和旧版本保留。不能修改共享工具、访问账号配置、网络或凭据；当前任务目录内用python3和本地文件操作。

最后用inspect_frame查看每幅图在1280/375下的0/1端点，再finalize_book登记issues、数学核对和限制。已知问题必须如实记录，工具会停止导出；不能用零发现或exit0代替审阅。可选export_motion在匹配且issue-free的final review之后按固定帧导出GIF/MP4；参数图需指定数字sweep。两次导出尝试，最多300帧，GIF只播放一遍，不为教材加入自动播放。

本轮有本地 visualbook MCP 工具。可以先用list_designs和show_design查看适合章节的可复用设计与真实图片。必须用 build_book 构建，再用 preview_book 预览；它直接返回真实桌面/手机PNG图片内容，不能仅凭文件路径或数值报告声称看过画面。观察图片后自行修订。Python脚本使用python3，环境未提供python别名。可用search_designs按概念寻找积木，describe_component核对真实输入输出，再用scene的$result或共享状态拼接；不必把全部目录读进上下文。CLI命令只用于读取原文和写book.json，不用shell替代图片预览。最多3次预览，不要更改工具源码。最后必须用inspect_frame检查每幅图在1280和375下的起点/终点，并用finalize_book记录数学核对、已知未解决问题与限制。不要因为数值报告零发现就隐瞒遮挡、错误解释或其它问题；有问题就记录，工具会停止导出。
