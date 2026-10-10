# 发布审计与远端核对

用户明确授权提交并push。发布目标为公开仓库 `siddhartha-yz/concept2motion` 的 `main`；不是内部应用checkpoint refs，不创建或发布tag。

已经实际检查的公开表面：仓库元数据、issues、issue评论、PR review评论、commit评论、releases、tags、branches、deployments、Pages API，以及11个未过期Actions artifact及其对应11份run日志。前述评论/issue/release/tag/deployment列表均为空，branches只有main；Pages API返回404，只能报告未从该入口看到Pages。下载22个归档后用Gitleaks 8.30.1扫描，启用3层归档解析、忽略行内跳过标记、redact，发现0。对应调用输出、清单与归档在忽略的 work/visualbook/publication/。

初次main全历史扫描覆盖76个提交，约18.40MB变更文本，发现0。该历史包含之前未push的研究提交，不只看本轮新增文件。最终提交、整棵发布文件及远端SHA核对随后追加在下面。

原始模型事件/提供方日志、完整教材HTML、第三方checkout/dependency、视频中间物、账号配置不在发布文件中。公开截图只显示公开D2L正文和本实验图解，已实际看过；不含账号界面。CI只重建冻结候选，上传数学/关系/阅读摘要，排除raw目录，不调用模型。

局限：Gitleaks是已知模式检查，0不是保证所有秘密不存在；它不理解所有自定义凭据，图片内容由维护会话目视核对。这里只检查可访问的上述公开表面和下载时未过期归档，不声称检查已删除/过期资料或GitHub内部状态。内部checkpoint refs、ignored工作目录不是发布目标。

## 发布前完整文件与历史

13:53 UTC扫描提交 acc75b17964522060349e92e2e9e03abf3648bbb：main全历史78提交，约19.49MB变更文本；整棵拟发布树2438个tracked文件，约19.25MB可扫描内容。两份Gitleaks报告均为0。随后仅增加浏览器路径发现、CI中文字体安装及审计文字，提交后再次扫描才push。

## 首次本轮推送与真实CI

非强制推送79298077dd12941beec53bb2e6a0b227f10a68ce完成；本地HEAD与git ls-remote main相同，git status为空。推送前再次全历史79提交、拟发布树扫描均0。

GitHub运行38057717014三个任务success；visualbook在Ubuntu runner独立重建并完成79项阅读、228项关系，没有模型调用。新公开两份artifact（一个旧scene，一个教材摘要）及本次run日志已下载，连同旧归档共13份artifact、12份对应run日志，再用3层归档Gitleaks扫描约19.93MB可扫描内容，发现0。教材artifact只有8份数学/关系/阅读摘要，没有raw或全文HTML。
