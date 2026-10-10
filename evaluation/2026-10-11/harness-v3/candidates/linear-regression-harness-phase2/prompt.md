你要把当前目录的完整教材变成优秀的段落内可视化教材。中文，保留原文与公式，不改source文件。阅读source.md的完整内容与锚点，source-map.json提供结构。source.json包含编译后的大段HTML和图片编码，仅给编译器使用，不要读取它来重复占用上下文；完整原文已经在source.md中。选择1–3个原书没有解释清楚的关系，允许有依据地零图；不要把原文段落再次塞进图。
本次工具路径 TOOL=/home/yang-zhi/文档/ChatGPT/concept2motion/work/harness-v3/frozen/phase2/tools/visualbook.mjs。把绘图计划写到book.json，调用构建和预览工具，查看实际桌面与手机PNG，自行修订。连续演示使用连续的0–1进度；直接拖动或调参数的图可声明interaction=parameters，静态关系可声明static。需要真实因果参数、清楚的轴与短标签、安静但有设计感的画面。不要只把进度取整后切换静态图片。图解默认静止，由读者拖动、单步或主动播放；页面滚动只暂停。避免装饰卡片、说明墙和超过480px的桌面图。
两臂共享同一原文、基本任务、编译器、阅读运行时和预览检查。你的arm=harness。
运行 node TOOL build source.json book.json book.html （TOOL换成上面绝对路径）。运行 node TOOL preview book.html preview-01 会得到真实PNG与report.json。至少预览一次并查看桌面和手机的图片。每次修改重新build，预览目录另起名。最多3次预览，1800秒会话上限；内部检查不能代替审美判断。失败保留，不自打分。
你可以使用可复用Board和VisualBook数学工具，使用稳定图元id，充分利用库减少布局与绘图负担。
输出book.json形状和接口见下面。源码是function draw(input)，绘图后返回实际使用的facts；不要自称训练结果或实测性能。公式已经编译，不重写教材。最终写AUTHOR.md说明图的取舍、实际预览与修订、未解决问题。
禁止网络、其他模型或代理、读取账号配置与凭据、修改工具源码或任务外文件。只操作当前目录，不需要git提交。预览若因sandbox被阻断可按正常审批请求执行本地Chromium，不跳过安全控制。

# 模型可调用的可视化工具

先读取 source.md 的完整正文与锚点（source-map.json是结构，source.json是编译器内部数据），选择原书没有说明清楚的联系。输出 book.json：

```json
{"figures":[{"id":"one-idea","title":"短图名","afterAnchor":"章节-001","endAnchor":"章节-004","height":320,"mobileHeight":360,"summary":"最多一句必要的例子条件，不复制正文","stages":["观察","改变","比较"],"params":[{"key":"eta","label":"学习率","min":0.01,"max":0.3,"step":0.01,"value":0.1}],"code":"function draw({svg,board,width,height,progress,params}) { /* 绘图，返回实际数值 facts */ return {}; }"}]}
```

最多4图，推荐1–3图，也可合理跳过。每幅覆盖最多8个正文块，不交叠。height稳定，手机可用不同高度。progress 是读者控制的连续0–1，不能只Math.floor后切换整张画面；移动、展开、计算步骤需要适合原文的解释。参数应有因果意义。默认停在初始画面，读者可以拖动、单步或主动播放一次；滚动只会暂停，不推进图解。原文不要重写，图片和公式已经导入。

可选 `initialProgress`（0–1，默认0）、`durationMs`（1000–60000，默认8000）和 `checkpoints`（包含0和1的严格递增进度数组）控制初始视图、主动播放时长与单步位置。不要在源码中自行启动定时器或监听页面滚动。开启系统“减少动态效果”时，播放按钮禁用，拖动和单步仍可用。

figure 可声明 `interaction:"timeline"`（默认）、`"parameters"` 或 `"static"`。参数探索适合直接拖动点或调参数：不显示播放/进度条，必须提供实际有效的参数或共享状态把手。静态图没有交互控件。预览仅对 timeline 要求连续进度改变图形；参数检查仍检查两个端点的真实画面，声明但没有视觉效果的参数会报错。不要为了检查加入没有意义的运动。

## Board：共享绘图、布局与稳定对象

draw每次收到同一个board；工具负责begin/end、尺寸和键值复用。每个图形使用固定id，不要自己清空svg。纯数值计算使用JavaScript；工具不替你选择教学内容。以下颜色在`VisualBook.palette`中：ink、muted、blue、orange、faint、paper。

- `board.axes(id,{xDomain,yDomain,equalUnits,xLabel,yLabel,box,grid})`：返回`{x,y,left,right,top,bottom,unitX,unitY}`。box为[left,top,right,bottom]像素；默认自排。equalUnits保证x/y单位比例一致。
- `board.vector(id,frame,from,to,{color,label})`：数据坐标箭头，自动算箭头头部和短标签。
- `board.curve(id,frame,[[x,y],...],{color,width,opacity})`：数据曲线。
- `board.matrix(id,values,{x,y,cell,activeRow,activeCol,activeCell,label,color,precision})`：矩阵格、数值、高亮行列；返回尺寸。小屏须安排合适cell及上下排布，不要让矩阵超宽。
- `board.sequence(id,[{id,label},...],{active,x,y,width,height})`：宽屏横排、窄屏竖排的流程；active允许连续值，让信息位置持续变化。推荐3–5个短节点。
- `board.label(id,text,x,y,{maxWidth,size,color,anchor,avoid})`：实测字体宽度、换行、边界限制与有限避让。避让不保证所有组合无碰撞，必须看预览。
- `board.text(id,text,x,y,{size,color,anchor,opacity,weight})`：精确短数值。默认15px。勿塞段落。
- `board.line(id,x1,y1,x2,y2,color,width,opacity)`、`board.circle(id,x,y,r,color)`、`board.rect(id,x,y,w,h,fill,attrs)`、`board.path(id,points,options)`：基础图元。
- `board.mark(id,tag,attrs,text)`：自定义SVG扩展，保留对象身份。

## 可直接复用的完整设计

- `board.product(id,A,B,{progress,row,col})`：自动算矩阵乘法，桌面并排、手机上下排布，高亮参与的行/列并移动贡献标记，返回真实terms/sum/C。适合小矩阵（最多5行/列，太密会明确拒绝）。高度建议桌面300、手机420；自己看预览。
- `board.optimization(id,{a,b,start,kind,eta,rho,epsilon,steps,progress,compare,xDomain,yDomain})`：二次目标a*x₁²+b*x₂²的等高线、优化轨迹、连续当前位置和可选比较；实际计算用trace。默认是D2L常见示意条件，不是通用深度网络训练。轨迹若超出指定domain需改参数或范围，工具不掩盖发散。
- `board.probabilities(id,scores,{temperature,progress,labels})`：稳定softmax计算、概率轴、短柱形标签，progress从均匀权重连续变到目标分布；不是把插值当真实训练过程。最多10项。

设计模板也允许组合或扩展；不是每个章节都应该套模板。模板返回facts仍须核对表达是否贴合教材。不能把不适合问题的模板强行使用。

## 可以像积木一样组合

一幅图可以用 `scene` 替代 `code`，二者只选一个。scene 负责排布和连接输入；所有实际计算与绘图由组件执行。组件数值输出可传给后面的组件，不能拿未生成的结果。任意新想法仍可写 draw 源码，不必局限于目录。

```json
{"type":"columns","layout":{"weights":[2,1],"gap":18},"children":[{"id":"geom","type":"projection","props":{"vector":{"$state":"v","fallback":[1.5,1]},"onto":[1,0],"progress":{"$progress":true},"stateKey":"v","draggable":true}},{"id":"values","type":"readout","props":{"items":[{"label":"投影","value":{"$result":"geom.projection"},"color":"orange"}]}}]}
```

figure 中可设 `state:{"v":[1.5,1]}`。拖动向量会更新同一份状态，图与读数一起重画；手机上下排布保留状态与对象。`columns`、`stack`、`grid`、`overlay` 可以嵌套，每个子项必须有不同 id。columns 默认每列至少260px，窄屏改为上下排布；`layout` 支持 gap、padding、weights、minColumnWidth 和 grid 的 columns。先给足 mobileHeight，不要靠缩小字号塞下所有东西。

绑定仅支持：`{"$param":"eta"}` 读取已声明参数；`{"$state":"v","fallback":[1,1]}` 读状态；`{"$progress":true}` 或 `{"$progress":[0,6.28]}` 映射演示进度；`{"$lerp":[起始数值或数组,终值]}` 连续插值；`{"$result":"组件id.输出字段"}` 引用前一组件的实际结果。插值是解释变化，不能称为真实迭代或训练。

源码组合也支持 `board.region(id,{x,y,width,height},localBoard=>...)`，所有坐标变成该区域的局部坐标，原有矩阵、曲线等方法可直接复用。`board.layout(count,options)` 返回局部排布。`draw` 额外收到 `state` 和 `controls`：setState(key,value)、setParam(key,value)、setProgress(value)、pause()。不要改状态后忘记刷新，使用这些共享方法。

`board.handle(id,frame,[x,y],{onChange,label,color,axis,step,bounds,constrain})` 提供稳定的鼠标/触摸把手、方向键与边界约束，默认双轴移动，axis 可为 x 或 y，bounds 为 `{x:[最小,最大],y:[最小,最大]}`。拖动时暂停演示。`board.selectable(node,{label,selected,onSelect})` 让已有图元能用点击、Enter、空格选择。

新增概率/学习组件：distribution、histogram、bayes、regression、loss-curve、decision-boundary、pca，可和下列基础组件用共享状态和 $result 拼接。用 describe_component 查询完整字段。

当前基础组件：projection（vector、onto、progress，可拖动）、linear-transform（2×2 matrix、vector、progress）、plot（xDomain/yDomain 与 curve/points/vector/area/handle 图层）、readout（短 label/value 数值列表）。数学组件：function-plot（function、x、derivative）、derivative（function、x、h）、integral（function、a、b、count、rule、progress）、unit-circle（angle）。函数 function 是数据：polynomial + 低次到高次 coefficients，或 sin/cos/exp/log/sigmoid/tanh/relu/gaussian；gaussian 支持 mean/sigma。范围需要覆盖教材例子，工具不会把画外数据伪装成画内结果。用目录的真实图片选择合适设计，完整示例和限制随目录提供。

独立核对：`VisualBook.project(v,onto)`、`scalarFunction(spec).f(x)/df(x)`、`riemannSum(spec,a,b,{count,rule})`。ReLU在0处不可导，显示0只是选择的次梯度；`h=0` 显示解析导数，不执行0/0；数值积分和精确积分分开返回。

## 张量与卷积设计

- `board.reshape(id,values,rows,{progress})`：保持行优先顺序和元素数量，让同一批稳定对象移动到新形状；不是转置。最多36值、每维最多8，过密会拒绝。新行数必须整除元素总数。
- `board.convolution(id,input,kernel,{stride,padding,progress})`：实际计算深度学习中的互相关、输出尺寸、当前窗口的乘积求和；核不翻转。支持输入最多6×6、核最多3×3、零填充最多1。连续窗口移动是阅读演示，输出只取实际离散位置。手机需选择小例子，建议height330/mobileHeight430。
- `VisualBook.correlate2d(input,kernel,{stride,padding})`：独立数值结果，检查核、步幅与填充形状，不假装测量硬件执行。

本地MCP的 `search_designs({query})` 按概念检索最多六个组件；`describe_component({id})` 返回实际输入字段、输出、限制与示例。目录是积木的展示方式，不要把整份源码读进上下文。概率/学习组件的 `compute_math({operation,inputs})` 调用同一无DOM计算内核，支持normal-cdf、binomial、histogram、bayes、regression、regression-optimum、pca；这是核对实际使用数值的便利工具，不是独立数学验收。

本地MCP的`list_designs`给出目录与限制，`show_design({id})`返回某种设计的执行示例及真实桌面/手机PNG。每次会话最多查看两种不同设计；查看示例不修改候选教材，也不占候选的三轮预览。

## 可检查的数学计算

`VisualBook.dot(a,b)`、`matmul(A,B)`、`mix(a,b,t)`、`clamp(v,min,max)`。

`VisualBook.trace(kind, gradient, start, {eta,rho,epsilon,steps})` 返回每一步theta、square、gradient、step。kind是sgd/rmsprop/adagrad/momentum，采用RMSProp分母sqrt(square+epsilon)、momentum的velocity=rho*velocity+gradient约定；条件与教材不同请明确说明或自定义，不能盲套。参数不是训练结果。

`VisualBook.interpolateTrace(trace,progress)`只把相邻迭代位置作阅读演示插值，返回theta/index/previous/next；不是新增优化步骤。数据范围先按全部轨迹确定，避免镜头随progress乱变。

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

计算图 autograd 使用标量节点，支持多输出与反传 seeds 计算 Jᵀv；detach 保持前向值并截断梯度。g 表示目标加权和对该节点的导数。多次使用同一输入须分别累计，零贡献的反向边不显示传播标记。traceGraph 的 seededValue 是加权目标，value 仍是原始输出（多个输出时为数组）。

本轮有本地 visualbook MCP 工具。可以先用list_designs和show_design查看适合章节的可复用设计与真实图片。必须用 build_book 构建，再用 preview_book 预览；它直接返回真实桌面/手机PNG图片内容，不能仅凭文件路径或数值报告声称看过画面。观察图片后自行修订。Python脚本使用python3，环境未提供python别名。可用search_designs按概念寻找积木，describe_component核对真实输入输出，再用scene的$result或共享状态拼接；不必把全部目录读进上下文。CLI命令只用于读取原文和写book.json，不用shell替代图片预览。最多3次预览，不要更改工具源码。最后必须用inspect_frame检查每幅图在1280和375下的起点/终点，并用finalize_book记录数学核对、已知未解决问题与限制。不要因为数值报告零发现就隐瞒遮挡、错误解释或其它问题；有问题就记录，工具会停止导出。
