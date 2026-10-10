# 模型可调用的可视化工具

先读取 source.json 的完整正文与锚点，选择原书没有说明清楚的联系。输出 book.json：

```json
{"figures":[{"id":"one-idea","title":"短图名","afterAnchor":"章节-001","endAnchor":"章节-004","height":320,"mobileHeight":360,"summary":"最多一句必要的例子条件，不复制正文","stages":["观察","改变","比较"],"params":[{"key":"eta","label":"学习率","min":0.01,"max":0.3,"step":0.01,"value":0.1}],"code":"function draw({svg,board,width,height,progress,params}) { /* 绘图，返回实际数值 facts */ return {}; }"}]}
```

最多4图，推荐1–3图，也可合理跳过。每幅覆盖最多8个正文块，不交叠。height稳定，手机可用不同高度。progress 是读者控制的连续0–1，不能只Math.floor后切换整张画面；移动、展开、计算步骤需要适合原文的解释。参数应有因果意义。没有自动播放。原文不要重写，图片和公式已经导入。

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

preview返回真实桌面/手机PNG和report.json，覆盖0、0.25、0.26、0.5、1进度。用图片查看工具看画面，处理具体碰撞、越界、错误轴和解释问题。修改book.json后重新build并使用新preview目录，旧失败保留。两臂都有同一预览工具；direct加`--direct`并自行操作SVG DOM，不使用Board或VisualBook库。

预览的布局检查不证明数学或教学正确；返回facts须是画面实际使用的数据，不能自打分。不要访问网络、账号配置、外部凭据或改工具源码；只写当前任务目录。工具接受本地已授权生成源码，不是陌生代码上传服务。
