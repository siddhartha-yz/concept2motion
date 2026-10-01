# Working conventions

Build reproducible animation infrastructure. Keep specific finished artworks in their own repositories.

- Default to the user's signed-in Codex workflow. Use official Codex CLI or desktop tools; never extract login tokens or turn them into generic API credentials.
- Do not spawn additional agents unless the user explicitly asks.
- Keep third-party checkouts and dependencies in ignored `work/` directories. Pin and record upstream commits before evaluating. Do not alter upstream source silently.
- Distinguish installation checks, mock workflow tests, actual renders, real model generation and artistic review in every report.
- Every generated candidate needs an input brief, source, math checks, render result, sampled frames, review and revision history. Never infer quality from an exit code or self-assigned score.
- Prefer deterministic frame-time rendering to wall-clock screen recording. Measure export timing before adopting a recorder.
- Mechanism must remain identifiable. Keep mathematical checks separate from artistic judgement. No claim of trained weights when weights are hand-selected.
- Keep new infrastructure narrow until a benchmark demonstrates its value. No large agent platform by default.
- Keep credentials, provider logs with secrets and video intermediates out of Git.
