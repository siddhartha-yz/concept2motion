# v3 成对证据页

只读页面并列 B/C 最终视频，支持共同跳转、共同播放/暂停；显示两种附件顺序的原裁判理由、错误、检查及版本源码哈希。A/D 参考单列，不在 v3 赋予画面排名。缺视频明确展示，不能拿占位画面计算胜负。

真实 Chromium 验证：4 组配对、6 条可用 B/C 视频；同跳 11 秒并共同播放/暂停，两视频相差约 0.000059 秒；无页面脚本错误。100 字节 HTTP Range 返回 206。确认一个真实存在的原始 stdout.log 请求返回 404，允许名单不暴露它。没有读取或显示日志内容。

第一版审核请求的是不存在的 raw.json，只能证明该路径 404，不能证明现有日志受限；原审计保留在 browser-audit-v1.json。第二版改为已存在的 stdout.log，结果在 browser-audit-v2.json。

临时 localhost 页面、截图与构建 manifest 在 ignored work/。源码为 tools/build_pilot_view.py 与 tools/serve_pilot_view.py；构建时记录输入 summary SHA-256。没有模型请求、分数或新的艺术接受。
