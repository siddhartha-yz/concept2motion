# 公开前检查

日期：2026-10-04。类型：发布检查；没有新模型调用、训练或艺术质量评测。

**仓库已公开并独立核验；扫描未发现凭据，冻结证据未被改写。** 检查范围与机器可读结果见 [preflight.json](preflight.json)。公开后的状态记在 [publication.json](publication.json)。

## 检查范围

- 待发布文件：初次整理后的 1,700 个文件；审计文档新增后，提交的最终文件再扫描一次。
- Git 历史：当时 `main` 的全部 19 次提交，包括已经删除或修改过的文件内容。远端只有 `main`，原远端提交在本地；没有标签。
- GitHub：仓库信息、全部 issues/PR、评论、发布和标签；这些内容没有待审的正文或附件，wiki 与 discussions 未开启。
- CI：全部 9 份未过期产物、10 次运行日志，解包后共 835 个产物文件和 38 个日志文件。未发现凭据。
- 完整性：13 个冻结清单的 734 份文件哈希一致，全部已纳入 Git。

使用官方 Gitleaks 8.30.1，下载文件与官方校验和一致。使用默认规则、完全遮盖命中值的输出，没有环境配置覆盖或自定义豁免；另检查私钥、常见服务令牌、带凭据的 URL、字面量密码/密钥和禁止发布的文件路径。原始扫描报告、下载日志和附件仅保存在忽略的 `work/publication-audit/`。

## 发布边界

只推送 `main`。本地 `refs/codex/…` 是应用内部检查点，不属于发布分支；其中有无效引用，普通 `fetch` 因此报错。本次用 GitHub 分支接口核对远端 SHA，并显式扫描有效发布历史，没有删除或修复应用引用，也没有使用 `git push --mirror`。

`.gitignore` 明确排除本地账户配置、密钥文件、原始模型调用日志、依赖、视频和数据库中间产物。公开证据中的提示、结果摘要、用量和失败记录保留；它们不是原始鉴权日志。少量历史本地路径和会话标识保留在冻结材料中，没有当作凭据，也没有为美化发布改写哈希。

模式扫描不能证明绝对不存在敏感信息。本报告记录实际检查范围和结果，不作绝对安全承诺。

## 验证与后续操作

本地 63 个 Python 测试、5 个 Node 测试文件通过。非证据文件的空白检查通过；归档源码和冻结输入保留原始字节，并通过 `.gitattributes` 区别处理空白。

公开前的最终提交包含 20 次历史提交、1,703 个文件，再次扫描均为零发现。随后已推送 `main`，按用户授权将仓库设为公开，并通过独立读取核对远端 SHA 与可见性。实况写入 `publication.json`。本条发布记录的文档修改也在推送前扫描。

再次检查可使用官方 Gitleaks：

```bash
gitleaks git . --log-opts='main' --redact --report-format json \
  --report-path work/publication-audit/history.json
# 将 git archive HEAD 解包到忽略目录后扫描；不要扫描整个 work/ 依赖树。
gitleaks dir work/publication-audit/committed-export --redact \
  --report-format json --report-path work/publication-audit/files.json
```

未来新增分支、标签、issues、发布或 CI 产物时，需要按新的公开范围复查。研究结论索引见[研究图谱](../../../docs/research-map.md)。
