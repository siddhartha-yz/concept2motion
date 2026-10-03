静音 Canvas2D，854×480，15fps，18秒。深色背景；青色恒为 identity，琥珀色恒为 correction，紫色恒为 output。三行分别代表三个带符号分量。
0–4秒：提出“什么沿 identity path 保留下来？”从共同起点逐步显露 x 的箭头和值，说明 x 原样传递。
4–8.2秒：在每根青色箭头终点接出独立琥珀色 correction，说明 F(x) 是示意修正，不是训练权重。
8.2–13秒：强调逐分量首尾相接，说明每个 correction 接到对应 x 的终点，并由 signed displacement 表示相加。
13–18秒：在紫色独立输出行显露结果箭头，保留 identity 与 correction 的角色标签。展示 y=x+F(x) 和 [0.50, −0.25, −0.10]。时间线固定覆盖全片并留有稳定展示阶段；按显式时间完整重绘，?export=1 时停播。