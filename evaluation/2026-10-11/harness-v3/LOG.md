# 执行日志

- 北京时间02:03:51开始七小时任务；main bb53a02，工作区干净。最早结束09:03:51。
- 用户否定滚动跟随图解；这是实际用户体验负反馈，旧工程测试不能推翻它。新默认改为手动观察。
- 初查共享runtime默认注册scroll/sync，界面按钮和来源说明也宣传跟随阅读。修复在共享运行时和生成器，不仅改四章样书。
- 开始参考资源研究。部分猜测文章URL在web工具不可达，不当作已读来源；Tangle与Mafs官网内容可读，后续核对具体源码、许可证和设计画面。
# 02:30 北京时间 — 手动交互完成第一轮验证

- 共享运行时不再按阅读位置推进，滚轮/触摸滚动只暂停主动播放。取消 sticky；拖动、单步、重置与主动播放一次成为共享行为。
- `node tools/check_visualbook.mjs work/harness-v3/manual-tool-check`：既有数学、真实渲染与静态 SVG 解码控制通过，模型调用0。
- `node tools/check_visualbook_controls.mjs work/harness-v3/manual-interaction-check-02`：11项实际 Chromium 交互控制通过，包含滚轮、原生滑块鼠标拖动、键盘、播放暂停、单步与减少动态效果。
- 首次控制检查因维护者把生成器的 `figure-manual-0` 写成 `manual-0`，选择器等待超时；失败目录保留。修正控制样本后通过，这不是候选教材的模型修订。
- 旧四章教材在 `outputs/visualbook/harness-v3-manual/` 重新构建，渲染检查无发现；没有新模型调用，也不据此宣称审美改进。
- 已查证 Mafs、Tangle、Dagre 的上游提交；后续只在 ignored work 下研究源码与许可证。
