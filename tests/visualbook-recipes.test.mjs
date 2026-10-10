import test from "node:test";
import assert from "node:assert/strict";
import { resolvePlan, build, validatePlan } from "../tools/visualbook.mjs";
const source = {
  title: "Recipe control",
  sourceSha256: "maintenance-control",
  blocks: [
    {
      id: "one",
      raw: "control",
      type: "paragraph",
      html: "<p>control</p>",
      math: { expected: 0 },
      sha256: "maintenance-control",
    },
  ],
};
const plan = {
  figures: [
    {
      id: "sum",
      design: "gradient-contributions",
      afterAnchor: "one",
      overrides: [
        { path: "/scene/props/terms/0/value", value: [-2, 3] },
        { path: "/params/0/value", value: 0.7 },
      ],
    },
  ],
};
test("named design expands data changes without rewriting drawing code or mutating template", () => {
  const r = resolvePlan(plan);
  assert.deepEqual(r.figures[0].scene.props.terms[0].value, [-2, 3]);
  assert.equal(r.figures[0].params[0].value, 0.7);
  assert.equal(r.figures[0].designRef.id, "gradient-contributions");
  assert.equal(r.figures[0].designRef.catalogSha256.length, 64);
  assert(!Object.hasOwn(r.figures[0], "code"));
  assert(!Object.hasOwn(plan.figures[0], "scene"));
  assert.deepEqual(
    resolvePlan({ figures: [{ ...plan.figures[0], overrides: [] }] }).figures[0]
      .scene.props.terms[0].value,
    [-1, 2],
  );
  assert.equal(validatePlan(source, plan).length, 1);
  assert(build(source, plan).includes('"designRef"'));
  assert.throws(() => build(source, plan, { direct: true }), /Direct arm/);
});
test("recipe replacements reject typos, prototype paths, conflicts and invalid resulting inputs", () => {
  const change = (overrides) => ({
    figures: [{ ...plan.figures[0], overrides }],
  });
  assert.throws(
    () => resolvePlan(change([{ path: "/scene/props/termz", value: [] }])),
    /does not exist/,
  );
  assert.throws(
    () => resolvePlan(change([{ path: "/scene/constructor", value: {} }])),
    /Unsafe/,
  );
  assert.throws(
    () => resolvePlan(change([{ path: "/code", value: "x" }])),
    /JSON pointer/,
  );
  assert.throws(
    () =>
      resolvePlan({
        figures: [{ ...plan.figures[0], code: "function draw(){}" }],
      }),
    /Choose/,
  );
  assert.throws(
    () =>
      validatePlan(
        source,
        change([{ path: "/scene/props", value: { termz: [] } }]),
      ),
    /Unknown contributions input/,
  );
  assert.throws(
    () => validatePlan(source, change([{ path: "/params/0/value", value: 8 }])),
    /Bad range/,
  );
});
