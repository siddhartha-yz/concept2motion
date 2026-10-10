/* Bounded educational array/scheduling semantics. These are not hardware measurements. */
(function (global) {
  const fail = (m) => {
    throw Error(m);
  };
  const finite = (v, m) => {
    if (!Number.isFinite(v)) fail(m + " must be finite");
    return v;
  };
  const integer = (v, m, lo, hi) => {
    if (!Number.isSafeInteger(v) || v < lo || v > hi)
      fail(m + " is outside its integer limits");
    return v;
  };
  const shape = (s) => {
    if (!Array.isArray(s) || s.length > 4)
      fail("Shape needs zero to four dimensions");
    s.forEach((n) => integer(n, "Shape dimension", 1, 4096));
    if (s.reduce((a, b) => a * b, 1) > 4096)
      fail("At most 4096 array elements");
    return s.slice();
  };
  const strides = (s) =>
    s.map((_, i) => s.slice(i + 1).reduce((a, b) => a * b, 1));
  const indices = (s) =>
    Array.from({ length: s.reduce((a, b) => a * b, 1) }, (_, flat) =>
      s.map((n, i) => Math.floor(flat / strides(s)[i]) % n),
    );
  const identifier = (s) => {
    if (typeof s !== "string" || !/^[a-zA-Z][a-zA-Z0-9_-]{0,30}$/.test(s))
      fail("Short identifier required");
    return s;
  };
  function arrayView(
    buffer,
    s,
    { elementStrides = null, offset = 0, itemSize = 4, index = null } = {},
  ) {
    shape(s);
    if (
      !Array.isArray(buffer) ||
      !buffer.length ||
      buffer.length > 4096 ||
      !buffer.every(Number.isFinite)
    )
      fail("Finite nonempty array buffer up to 4096 elements required");
    const steps = elementStrides ?? strides(s);
    if (!Array.isArray(steps) || steps.length !== s.length)
      fail("One element stride per dimension");
    steps.forEach((n) => integer(n, "Element stride", -4096, 4096));
    integer(offset, "Buffer element offset", 0, buffer.length - 1);
    integer(itemSize, "Illustrative bytes per element", 1, 16);
    const ix = indices(s),
      addresses = ix.map(
        (v) => offset + v.reduce((a, n, i) => a + n * steps[i], 0),
      );
    if (addresses.some((a) => a < 0 || a >= buffer.length))
      fail("Array view addresses leave its buffer");
    const flat = addresses.map((a) => buffer[a]);
    if (
      index !== null &&
      (!Array.isArray(index) ||
        index.length !== s.length ||
        index.some((v, i) => !Number.isInteger(v) || v < 0 || v >= s[i]))
    )
      fail("Index is outside array shape");
    const selectedAddress =
      index === null
        ? null
        : offset + index.reduce((a, n, i) => a + n * steps[i], 0);
    const matrix =
      s.length === 1
        ? [flat.slice()]
        : s.length === 2
          ? Array.from({ length: s[0] }, (_, r) =>
              flat.slice(r * s[1], (r + 1) * s[1]),
            )
          : null;
    return {
      shape: s.slice(),
      elementStrides: steps.slice(),
      byteStrides: steps.map((v) => v * itemSize),
      offset,
      itemSize,
      indices: ix,
      addresses,
      byteOffsets: addresses.map((v) => v * itemSize),
      flat,
      matrix,
      selectedAddress,
      selectedValue: selectedAddress === null ? null : buffer[selectedAddress],
      aliases: new Set(addresses).size !== addresses.length,
      logicalBytes: flat.length * itemSize,
      bufferBytes: buffer.length * itemSize,
      convention:
        "Element strides address an illustrative buffer; byte sizes are declared, not measured JS or GPU memory. A view does not claim reshape is always zero-copy.",
    };
  }
  function broadcast(
    leftValues,
    leftShape,
    rightValues,
    rightShape,
    { operation = "add" } = {},
  ) {
    shape(leftShape);
    shape(rightShape);
    for (const [v, s] of [
      [leftValues, leftShape],
      [rightValues, rightShape],
    ])
      if (
        !Array.isArray(v) ||
        v.length !== s.reduce((a, b) => a * b, 1) ||
        !v.every(Number.isFinite)
      )
        fail("Finite flat values must match their declared shape");
    if (!["add", "subtract", "multiply", "divide"].includes(operation))
      fail("Unknown broadcast arithmetic");
    const dims = Math.max(leftShape.length, rightShape.length),
      a = Array(dims - leftShape.length)
        .fill(1)
        .concat(leftShape),
      b = Array(dims - rightShape.length)
        .fill(1)
        .concat(rightShape);
    const outputShape = a.map((v, i) => {
      if (v !== b[i] && v !== 1 && b[i] !== 1)
        fail("Shapes cannot broadcast along trailing dimensions");
      return Math.max(v, b[i]);
    });
    shape(outputShape);
    const ix = indices(outputShape),
      as = strides(a),
      bs = strides(b),
      leftIndexMap = ix.map((v) =>
        v.reduce((sum, n, i) => sum + (a[i] === 1 ? 0 : n) * as[i], 0),
      ),
      rightIndexMap = ix.map((v) =>
        v.reduce((sum, n, i) => sum + (b[i] === 1 ? 0 : n) * bs[i], 0),
      );
    const values = ix.map((_, i) => {
      const x = leftValues[leftIndexMap[i]],
        y = rightValues[rightIndexMap[i]];
      return finite(
        operation === "add"
          ? x + y
          : operation === "subtract"
            ? x - y
            : operation === "multiply"
              ? x * y
              : x / y,
        "Broadcast result",
      );
    });
    const matrix =
      outputShape.length === 1
        ? [values.slice()]
        : outputShape.length === 2
          ? Array.from({ length: outputShape[0] }, (_, r) =>
              values.slice(r * outputShape[1], (r + 1) * outputShape[1]),
            )
          : null;
    return {
      shape: outputShape,
      values,
      matrix,
      indices: ix,
      leftIndexMap,
      rightIndexMap,
      leftAlignedShape: a,
      rightAlignedShape: b,
      operation,
      convention:
        "Trailing-axis broadcast semantics; repeated source indices describe conceptual reuse, not measured allocation or a framework execution.",
    };
  }
  function schedule(tasks) {
    if (!Array.isArray(tasks) || tasks.length < 1 || tasks.length > 64)
      fail("Schedule needs 1..64 tasks");
    const map = new Map(),
      lanes = [],
      previous = new Map();
    for (const task of tasks) {
      if (
        !task ||
        typeof task !== "object" ||
        Array.isArray(task) ||
        Object.keys(task).some(
          (k) =>
            ![
              "id",
              "lane",
              "duration",
              "dependencies",
              "release",
              "label",
            ].includes(k),
        )
      )
        fail("Unknown task fields");
      const id = identifier(task.id),
        lane = identifier(task.lane);
      if (map.has(id)) fail("Duplicate task id");
      const duration = finite(task.duration, "Duration"),
        release = finite(task.release ?? 0, "Release");
      if (duration < 0 || release < 0)
        fail("Nonnegative illustrative task times required");
      const dependencies = task.dependencies ?? [];
      if (
        !Array.isArray(dependencies) ||
        dependencies.some((d) => typeof d !== "string") ||
        new Set(dependencies).size !== dependencies.length
      )
        fail("Unique dependency ids required");
      const orderedDependencies = [
        ...new Set(
          dependencies.concat(previous.has(lane) ? [previous.get(lane)] : []),
        ),
      ];
      if (!lanes.includes(lane)) lanes.push(lane);
      map.set(id, {
        ...task,
        id,
        lane,
        duration,
        release,
        dependencies: dependencies.slice(),
        orderedDependencies,
      });
      previous.set(lane, id);
    }
    if (lanes.length > 8) fail("At most eight scheduling lanes");
    for (const task of map.values())
      if (task.orderedDependencies.some((d) => !map.has(d) || d === task.id))
        fail("Unknown/self task dependency");
    const records = [],
      done = new Map(),
      pending = new Set(map.keys());
    while (pending.size) {
      const ready = [...pending].find((id) =>
        map.get(id).orderedDependencies.every((d) => done.has(d)),
      );
      if (!ready) fail("Task dependencies and lane order contain a cycle");
      const task = map.get(ready),
        start = Math.max(
          task.release,
          ...task.orderedDependencies.map((d) => done.get(d).finish),
        ),
        finish = finite(start + task.duration, "Task finish");
      const record = { ...task, start, finish };
      done.set(ready, record);
      records.push(record);
      pending.delete(ready);
    }
    const span = Math.max(...records.map((t) => t.finish)),
      busy = Object.fromEntries(
        lanes.map((l) => [
          l,
          records
            .filter((t) => t.lane === l)
            .reduce((a, t) => a + t.duration, 0),
        ]),
      ),
      idle = Object.fromEntries(lanes.map((l) => [l, span - busy[l]]));
    return {
      records,
      lanes,
      span,
      busy,
      idle,
      convention:
        "Earliest feasible schedule with serialized tasks in each input lane order; durations are supplied example units, not CPU/GPU timing or an optimal scheduler.",
    };
  }
  function memoryTrace(instructions) {
    if (
      !Array.isArray(instructions) ||
      !instructions.length ||
      instructions.length > 32
    )
      fail("Memory demonstration needs 1..32 instructions");
    const locals = Object.create(null),
      objects = Object.create(null),
      variableIds = [],
      history = [{ locals: {}, objects: {}, line: null, operation: "start" }];
    const reference = (name) => {
      identifier(name);
      const value = locals[name];
      if (
        !value ||
        typeof value !== "object" ||
        !value.ref ||
        !objects[value.ref]
      )
        fail("Variable does not reference an existing object");
      return value.ref;
    };
    instructions.forEach((instruction, i) => {
      if (
        !instruction ||
        typeof instruction !== "object" ||
        Array.isArray(instruction)
      )
        fail("Memory instruction object required");
      const {
        op,
        name,
        from,
        id,
        index,
        value,
        values,
        line = i + 1,
      } = instruction;
      integer(line, "Displayed source line", 1, 64);
      identifier(name);
      if (!variableIds.includes(name)) variableIds.push(name);
      const keys = {
        allocate: ["op", "name", "id", "values", "line"],
        alias: ["op", "name", "from", "line"],
        copy: ["op", "name", "from", "id", "line"],
        write: ["op", "name", "index", "value", "line"],
        delete: ["op", "name", "line"],
      };
      if (
        !keys[op] ||
        Object.keys(instruction).some((k) => !keys[op].includes(k))
      )
        fail("Unknown memory instruction or fields");
      if (op === "allocate" || op === "copy") {
        identifier(id);
        if (objects[id]) fail("Object identity already exists");
        const data = op === "copy" ? objects[reference(from)].slice() : values;
        if (
          !Array.isArray(data) ||
          !data.length ||
          data.length > 16 ||
          !data.every(Number.isFinite)
        )
          fail("Memory arrays need 1..16 finite values");
        objects[id] = data.slice();
        locals[name] = { ref: id };
      } else if (op === "alias") locals[name] = { ref: reference(from) };
      else if (op === "write") {
        const ref = reference(name);
        integer(index, "Memory array index", 0, objects[ref].length - 1);
        objects[ref][index] = finite(value, "Written value");
      } else {
        if (!Object.hasOwn(locals, name))
          fail("Cannot delete unknown variable");
        delete locals[name];
      }
      if (Object.keys(locals).length > 16 || Object.keys(objects).length > 8)
        fail("Memory diagram exceeds bounded locals/objects");
      history.push({
        locals: JSON.parse(JSON.stringify(locals)),
        objects: JSON.parse(JSON.stringify(objects)),
        line,
        operation: op,
      });
    });
    return {
      history,
      locals: JSON.parse(JSON.stringify(locals)),
      objects: JSON.parse(JSON.stringify(objects)),
      objectIds: Object.keys(objects),
      variableIds,
      steps: instructions.length,
      convention:
        "Executed bounded allocate/alias/copy/write/delete instructions; not execution of arbitrary Python and no physical addresses or garbage-collection claims.",
    };
  }
  const api = { arrayView, broadcast, schedule, memoryTrace };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else global.VisualBookProgram = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
