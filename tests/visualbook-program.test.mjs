import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { computeMath, operations } from "../tools/visualbook_math.mjs";
const R = createRequire(import.meta.url)("../packages/visualbook/program.cjs");
test("array view indexes independent contiguous, transposed, reversed and broadcast layouts", () => {
  const buffer = [0, 1, 2, 3, 4, 5];
  assert.deepEqual(R.arrayView(buffer, [2, 3]).matrix, [
    [0, 1, 2],
    [3, 4, 5],
  ]);
  const transpose = R.arrayView(buffer, [3, 2], {
    elementStrides: [1, 3],
    index: [2, 1],
    itemSize: 4,
  });
  assert.deepEqual(transpose.matrix, [
    [0, 3],
    [1, 4],
    [2, 5],
  ]);
  assert.equal(transpose.selectedAddress, 5);
  assert.deepEqual(transpose.byteStrides, [4, 12]);
  assert.deepEqual(
    R.arrayView(buffer, [6], { elementStrides: [-1], offset: 5 }).flat,
    [5, 4, 3, 2, 1, 0],
  );
  const broadcast = R.arrayView(buffer, [2, 3], { elementStrides: [0, 1] });
  assert.deepEqual(broadcast.flat, [0, 1, 2, 0, 1, 2]);
  assert.equal(broadcast.aliases, true);
  assert.throws(
    () => R.arrayView(buffer, [2, 3], { elementStrides: [4, 1] }),
    /leave/,
  );
  assert.throws(() => R.arrayView(buffer, [2, 3], { index: [2, 0] }), /Index/);
});
test("broadcast trailing dimensions preserve source index maps rather than claiming copies", () => {
  const b = R.broadcast([0, 10], [2, 1], [1, 2, 3], [3]);
  assert.deepEqual(b.shape, [2, 3]);
  assert.deepEqual(b.matrix, [
    [1, 2, 3],
    [11, 12, 13],
  ]);
  assert.deepEqual(b.leftIndexMap, [0, 0, 0, 1, 1, 1]);
  assert.deepEqual(b.rightIndexMap, [0, 1, 2, 0, 1, 2]);
  assert.deepEqual(
    R.broadcast([2], [], [1, 2], [2], { operation: "multiply" }).values,
    [2, 4],
  );
  assert.throws(
    () => R.broadcast([1, 2], [2], [1, 2, 3], [3]),
    /cannot broadcast/,
  );
  assert.throws(
    () => R.broadcast([1], [], [0], [], { operation: "divide" }),
    /finite/,
  );
});
test("schedule honors dependencies, lane order and release with explicit non-measured times", () => {
  const tasks = [
    { id: "submitA", lane: "CPU", duration: 0.5 },
    { id: "submitB", lane: "CPU", duration: 0.5 },
    { id: "A", lane: "GPU", duration: 3, dependencies: ["submitA"] },
    { id: "B", lane: "GPU", duration: 2, dependencies: ["submitB", "A"] },
    { id: "read", lane: "CPU", duration: 0.2, dependencies: ["B"] },
  ];
  const result = R.schedule(tasks),
    byId = Object.fromEntries(result.records.map((t) => [t.id, t]));
  assert.equal(byId.A.start, 0.5);
  assert.equal(byId.B.start, 3.5);
  assert.equal(byId.read.start, 5.5);
  assert.equal(result.span, 5.7);
  assert.equal(result.busy.GPU, 5);
  for (const record of result.records)
    for (const dep of record.orderedDependencies)
      assert(record.start >= byId[dep].finish);
  const sync = tasks.map((t) =>
    t.id === "submitB" ? { ...t, dependencies: ["A"] } : t,
  );
  assert.equal(R.schedule(sync).span, 6.2);
  assert.throws(
    () =>
      R.schedule([
        { id: "a", lane: "CPU", duration: 1, dependencies: ["b"] },
        { id: "b", lane: "CPU", duration: 1 },
      ]),
    /cycle/,
  );
  assert.throws(
    () => R.schedule([{ id: "a", lane: "CPU", duration: -1 }]),
    /Nonnegative/,
  );
  assert.equal(
    R.schedule([{ id: "a", lane: "CPU", duration: 0, release: 3 }]).span,
    3,
  );
});
test("bounded memory trace keeps aliases, copy identity and old snapshots independent", () => {
  const instructions = [
    { op: "allocate", name: "a", id: "buf", values: [1, 2, 3] },
    { op: "alias", name: "b", from: "a" },
    { op: "copy", name: "c", from: "a", id: "copy" },
    { op: "write", name: "b", index: 1, value: 9 },
  ];
  const trace = R.memoryTrace(instructions);
  assert.equal(trace.locals.a.ref, trace.locals.b.ref);
  assert.notEqual(trace.locals.a.ref, trace.locals.c.ref);
  assert.deepEqual(trace.objects.buf, [1, 9, 3]);
  assert.deepEqual(trace.objects.copy, [1, 2, 3]);
  assert.deepEqual(trace.history[1].objects.buf, [1, 2, 3]);
  assert.equal(trace.history[0].line, null);
  assert.throws(
    () => R.memoryTrace([{ op: "write", name: "a", index: 0, value: 1 }]),
    /reference/,
  );
  assert.throws(
    () =>
      R.memoryTrace([
        { op: "allocate", name: "a", id: "buf", values: [1] },
        { op: "write", name: "a", index: 1, value: 2 },
      ]),
    /limits/,
  );
  assert.throws(
    () =>
      R.memoryTrace([
        { op: "allocate", name: "a", id: "buf", values: [1] },
        { op: "allocate", name: "b", id: "buf", values: [2] },
      ]),
    /identity/,
  );
  assert.deepEqual(
    R.memoryTrace([
      { op: "allocate", name: "constructor", id: "constructor", values: [1] },
    ]).objects.constructor,
    [1],
  );
});
test("program computation discovery exposes actual fields", () => {
  const cases = {
    "array-view": { buffer: [1, 2], shape: [2] },
    broadcast: {
      leftValues: [1],
      leftShape: [],
      rightValues: [2],
      rightShape: [],
    },
    "task-schedule": { tasks: [{ id: "a", lane: "CPU", duration: 1 }] },
    "memory-trace": {
      instructions: [{ op: "allocate", name: "a", id: "buf", values: [1] }],
    },
  };
  assert(Object.keys(operations).length >= 20);
  for (const [operation, inputs] of Object.entries(cases))
    assert.deepEqual(
      Object.keys(computeMath(operation, inputs).result).sort(),
      operations[operation].outputs.slice().sort(),
    );
});
