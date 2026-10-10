# 直接SVG对照的共同接口

读取source.md完整正文和source-map.json锚点。保留原文、代码、图片和已导入的公式。只输出book.json图解计划；最多4图，通常1–3图，不要求每段配图。每幅覆盖最多8个正文块，scope不能交叠。

figure包含id、title、afterAnchor、可选endAnchor、height（180..480整数）、mobileHeight（180..560整数）、最多一句必要的summary，以及`code:"function draw({svg,width,height,progress,params,state,controls}){...return facts;}"`。用原生SVG DOM绘图，稳定id更新同一个对象，避免清空重画。直接对照没有VisualBook绘图库、设计模板或scene计算/组件。

progress是读者手动控制的0..1连续值；不要监听滚动或启动定时器。默认停在0，支持拖动、单步、主动播放一次与暂停。可选initialProgress、durationMs（1000..60000）、checkpoints（严格递增并包含0/1）。只有有意义的变化才使用时间轴；`interaction:"parameters"`保留参数探索而不显示播放条，必须有实际生效的参数或把手；`static`没有控件。

params支持数字范围`{key,label,min,max,step,value}`、整数stepper（kind=stepper，step=1且bounds/value整数）和原生select（kind=select，value与options中的string/number/boolean值严格对应；options为2..8项`{value,label}`）。最多8个不同key。用controls.setParam/setState更新共享状态；重置恢复初始值。参数和图形应有因果关系，不能只改一个读数假装图解。

SVG文字宜短，图形补充原文缺失的关系，不重复正文段落。保持对象、颜色、坐标范围和对照条件一致；手机需要实际排布，不能把大图整体缩小到难读。返回实际计算使用的facts，注明例子条件、公式约定和未验证范围。手选权重不是训练结果；给定时间或内存大小不是硬件测量。

使用MCP build_book构建，preview_book查看实际桌面/手机PNG；最多三轮，失败也占次数。自动检查覆盖有限进度与参数取值，不是艺术或数学认证。实际看图后自行修订，错误和旧版本保留。不能修改共享工具、访问账号配置、网络或凭据；当前任务目录内用python3和本地文件操作。

最后用inspect_frame查看每幅图在1280/375下的0/1端点，再finalize_book登记issues、数学核对和限制。已知问题必须如实记录，工具会停止导出；不能用零发现或exit0代替审阅。可选export_motion在匹配且issue-free的final review之后按固定帧导出GIF/MP4；参数图需指定数字sweep。两次导出尝试，最多300帧，GIF只播放一遍，不为教材加入自动播放。
