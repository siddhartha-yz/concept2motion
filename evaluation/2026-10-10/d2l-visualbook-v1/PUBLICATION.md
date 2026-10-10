# 发布审计与远端核对

用户明确授权提交并push。发布目标为公开仓库 `siddhartha-yz/concept2motion` 的 `main`；不是内部应用checkpoint refs，不创建或发布tag。

已经实际检查的公开表面：仓库元数据、issues、issue评论、PR review评论、commit评论、releases、tags、branches、deployments、Pages API，以及11个未过期Actions artifact及其对应11份run日志。前述评论/issue/release/tag/deployment列表均为空，branches只有main；Pages API返回404，只能报告未从该入口看到Pages。下载22个归档后用Gitleaks 8.30.1扫描，启用3层归档解析、忽略行内跳过标记、redact，发现0。对应调用输出、清单与归档在忽略的 work/visualbook/publication/。

初次main全历史扫描覆盖76个提交，约18.40MB变更文本，发现0。该历史包含之前未push的研究提交，不只看本轮新增文件。最终提交、整棵发布文件及远端SHA核对随后追加在下面。

原始模型事件/提供方日志、完整教材HTML、第三方checkout/dependency、视频中间物、账号配置不在发布文件中。公开截图只显示公开D2L正文和本实验图解，已实际看过；不含账号界面。CI只重建冻结候选，上传数学/关系/阅读摘要，排除raw目录，不调用模型。

局限：Gitleaks是已知模式检查，0不是保证所有秘密不存在；它不理解所有自定义凭据，图片内容由维护会话目视核对。这里只检查可访问的上述公开表面和下载时未过期归档，不声称检查已删除/过期资料或GitHub内部状态。内部checkpoint refs、ignored工作目录不是发布目标。
