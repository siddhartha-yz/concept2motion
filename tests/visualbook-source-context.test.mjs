import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import {
  sourceContext,
  validateAnnotations,
} from "../packages/visualbook/anchors.mjs";
import { normalizeEmphasis } from "../packages/visualbook/emphasis.mjs";
test("insertion cannot separate an introduction from display math, code, list or table", () => {
  for (const type of ["math", "code", "list", "table"]) {
    const book = {
      blocks: [
        { id: "p", type: "paragraph", raw: "根据定义：" },
        { id: "next", type, raw: "a" },
      ],
    };
    assert.equal(sourceContext(book, "p").recommendedAnchor, "next");
    assert.equal(sourceContext(book, "p").safeToInsertAfter, false);
    assert.throws(() =>
      validateAnnotations(book, [
        { id: "note-a", afterAnchor: "p", kind: "condition", text: "条件" },
      ]),
    );
    validateAnnotations(book, [
      { id: "note-a", afterAnchor: "next", kind: "condition", text: "条件" },
    ]);
  }
  assert.throws(() => sourceContext({ blocks: [] }, "missing"));
});
test("render-only emphasis repair preserves code literals and source identities", async () => {
  assert.equal(normalizeEmphasis("求**$f$**的导数"), "求 **$f$** 的导数");
  assert.equal(normalizeEmphasis("代码`a**$b$**c`保持"), "代码`a**$b$**c`保持");
  const { importMarkdown } = await import("../packages/visualbook/import.mjs");
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "vh-emphasis-"));
  try {
    const raw = "# 公式\n\n求**$f$**的导数。\n\n```python\nx**2\n```\n";
    const file = path.join(dir, "source.md");
    fs.writeFileSync(file, raw);
    const b = importMarkdown(file, { id: "test" });
    assert.equal(
      b.sourceSha256,
      crypto.createHash("sha256").update(raw).digest("hex"),
    );
    assert.equal(b.blocks[1].raw, "求**$f$**的导数。");
    assert(b.blocks[1].html.includes("<strong>"));
    assert(!b.blocks[1].html.includes("**"));
    assert(b.blocks[2].html.includes("x**2"));
    assert.equal(b.adaptation.mathExpected, 1);
    assert.equal(b.adaptation.mathRendered, 1);
  } finally {
    fs.rmSync(dir, { recursive: true });
  }
});
