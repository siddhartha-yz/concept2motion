/* Callable canonical numerics, independent of rendering and models. */
import fs from "node:fs";
import { createRequire } from "node:module";
const C = createRequire(import.meta.url)(
  "../packages/visualbook/calculations.cjs",
);
export const operations = C.operations;
export const computeMath = C.compute;

if (process.argv[1] === import.meta.filename) {
  if (process.argv[2] === "describe") {
    const operation = process.argv[3],
      spec = operations[operation];
    if (!spec) throw Error("Unknown calculation");
    console.log(
      JSON.stringify({
        operation,
        inputs: spec.keys,
        required: spec.required,
        outputs: spec.outputs,
        scope: "Canonical calculation metadata, not an independent math review",
      }),
    );
  } else {
    let text = "";
    for await (const chunk of process.stdin) {
      text += chunk;
      if (text.length > 65536) throw Error("Numeric input exceeds 64 KiB");
    }
    const request = JSON.parse(text);
    console.log(JSON.stringify(computeMath(request.operation, request.inputs)));
  }
}
