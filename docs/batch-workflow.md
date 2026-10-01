# Fresh generation benchmark

The sequential runner uses the official signed-in Codex CLI. It supplies frozen briefs and a protocol, without existing fixture source. Initial authoring and sampled-frame review use separate fresh, ephemeral contexts. Calls inherit the configured model; the runner removes API-key environment variables and does not read authentication tokens.

```bash
codex login status
python3 tools/batch.py run --out runs/my-six
python3 tools/batch.py run --out runs/my-six --resume
python3 tools/batch.py report --out runs/my-six
```

The default is three Softmax and three residual trials. `--cases softmax --trials 1` selects a smaller exploratory batch. `--codex` and `--node` choose installed executable paths. Rendering uses the same `C2M_NODE_MODULES`, `C2M_CHROMIUM`, `C2M_FFMPEG` and `C2M_FFPROBE` settings as the local scene tool. No background scheduler is created.

During execution, read the checkpointed `summary.json` or existing `index.html`. The report command takes the same exclusive write lock and should be run after the active runner stops. The runner currently targets POSIX systems (Linux/macOS) and uses process groups to stop timed-out or interrupted children.

Fresh authoring produces structured HTML, JavaScript and a storyboard. The runner writes only these named candidate files. Generated text is never interpolated into shell commands. The CLI is read-only and is explicitly instructed not to call tools. Recorded CLI tool use invalidates the model call, because it may have accessed source outside the supplied prompt. Fresh contexts and a no-tools instruction do not constitute filesystem isolation or adversarial enforcement.

The local renderer snapshots the candidate, captures evidence and validates the full video. Concrete deterministic failures request technical or visual repairs. A full render that passes those checks proceeds to an independent-context visual review, with sampled images and the brief but no author source, storyboard or prior dialogue. This is context separation using the same configured model, not independence between different model families and not a blind human review.

Each trial permits two technical repairs and two visual revisions. A further failure stops that trial. Pass means the local checks and sampled-frame review passed; artistic acceptance remains `pending_user_review`.

The output directory is never replaced. Frozen protocol, prompts, briefs and local renderer/validator/review policy are hashed. Completed generations have hashes, and source edits are rejected. Checkpoints retain completed phases; an interrupted model call gets a new call directory on resume. Incomplete render directories remain as evidence and a new render directory is used. A lock prevents concurrent writers to the same batch.

Authentication, transport failures, renderer infrastructure failures and invalid reviewer output block the batch instead of masquerading as a quality failure. Fix the external issue and resume. Existing completed trials are not regenerated. Private model stdout/stderr stay in ignored `runs/`; do not publish them because provider logs may contain sensitive context.

`summary.json` and `REPORT.md` separate initial render outcome, initial review outcome, final status, revision requests and CLI-reported token usage. Cost is not inferred from tokens. Six trials are an exploratory baseline and do not establish production reliability. State-machine tests mock model/render calls and are not counted as actual generations.

The CLI's ephemeral sessions, structured output and JSON event interface follow [official non-interactive documentation](https://learn.chatgpt.com/docs/non-interactive-mode). No API-key adapter or credential extraction is used.
