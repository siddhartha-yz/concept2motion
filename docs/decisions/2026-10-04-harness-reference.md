# Harness 文章能支持什么

状态：**已阅读的方向参考，未复现其模型或实验。**

参考：[Language model harnesses are compositional generalizers](https://alexzhang13.github.io/blog/2026/harness/)。

它对本项目最有用的想法是：外部程序保管上下文和状态，让模型按需读取证据、处理有边界的小任务，再由程序组合结果。可以对应到按对象和时段读取画面、提出局部补丁、核验修改。

但文章中的训练与长上下文实验不是动画表达实验，也不是本仓库的固定模型对照。它不能证明 Concept2Motion 能提高作品质量。是否能把新概念拆成模型熟悉的小问题，也是需要验证的假设。

当前采纳：有限的证据查询、明确修改范围、独立验证与回退。当前不据此扩大递归代理平台。验证时应使用未参与调试的概念，并区分模型训练收益与工具组织收益。

相关原始研究：[Recursive Language Models](https://arxiv.org/abs/2512.24601)；相关项目：[官方 RLM 仓库](https://github.com/alexzhang13/rlm)。这里只登记参考价值，不宣称已经采用或复现其完整实现。
