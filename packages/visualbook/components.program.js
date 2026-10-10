/* Original code/array/dependency views inspired by explicit program state. */
(function (global) {
  const V = global.VisualBook,
    P = V.palette,
    N = global.VisualBookProgram,
    mono = "ui-monospace, SFMono-Regular, Consolas, monospace";
  const fmt = (v) => Number(v.toFixed(3));
  const color = (id) =>
    [P.blue, P.orange, P.violet, P.green, P.gold][
      [...id].reduce((a, c) => a + c.charCodeAt(0), 0) % 5
    ];
  const cellText = (board, id, value, x, y, width, options = {}) => {
    const text = String(fmt(value)),
      size = Math.max(
        12,
        Math.min(14, (14 * (width - 8)) / Math.max(V.measure(text, 14), 1)),
      );
    if (V.measure(text, size) > width - 6)
      throw Error("Numeric value does not fit its memory cell");
    return board.text(id, text, x, y, {
      size,
      anchor: "middle",
      halo: false,
      ...options,
    });
  };
  function arrayView(
    board,
    {
      buffer,
      shape,
      elementStrides = null,
      offset = 0,
      itemSize = 4,
      index = null,
      stateKey = null,
      title = null,
    } = {},
    context = {},
  ) {
    if (
      shape.length < 1 ||
      shape.length > 2 ||
      buffer.length > 16 ||
      shape.some((n) => n > 6)
    )
      throw Error(
        "Array drawing needs a one/two dimensional view, dimensions ≤6 and buffer ≤16",
      );
    const facts = N.arrayView(buffer, shape, {
      elementStrides,
      offset,
      itemSize,
      index: index ?? shape.map(() => 0),
    });
    const cols = Math.min(buffer.length, Math.floor((board.width - 32) / 38)),
      rows = Math.ceil(buffer.length / cols),
      cell = Math.min(44, (board.width - 32) / cols),
      stripX = (board.width - cols * cell) / 2,
      stripY = 50,
      gridTop = stripY + rows * 50 + 38,
      gridRows = shape.length === 1 ? 1 : shape[0],
      gridCols = shape.at(-1),
      gridCell = Math.min(
        48,
        (board.width - 48) / gridCols,
        (board.height - gridTop - 76) / gridRows,
      );
    if (cols < 1 || gridCell < 32)
      throw Error("Array view needs larger space or fewer cells");
    if (title) board.text("title", title, 16, 20, { size: 14 });
    board.text("buffer-label", "同一块缓冲区", 16, 38, {
      size: 12,
      color: P.muted,
    });
    const addressPosition = (a) => [
      stripX + ((a % cols) + 0.5) * cell,
      stripY + Math.floor(a / cols) * 50 + 18,
    ];
    buffer.forEach((v, a) => {
      const [x, y] = addressPosition(a),
        active = a === facts.selectedAddress;
      board.rect(
        "buffer-" + a,
        x - cell / 2 + 2,
        y - 17,
        cell - 4,
        34,
        active ? P.blue : P.faint,
        { rx: 3 },
      );
      cellText(board, "buffer-value-" + a, v, x, y + 5, cell, {
        color: active ? P.paper : P.ink,
      });
      board.text("address-" + a, a, x, y + 30, {
        size: 12,
        color: P.muted,
        anchor: "middle",
      });
    });
    const gridX = (board.width - gridCols * gridCell) / 2;
    board.text("view-label", "逻辑索引 → 缓冲区位置", 16, gridTop - 12, {
      size: 12,
      color: P.muted,
    });
    facts.flat.forEach((v, i) => {
      const r = Math.floor(i / gridCols),
        c = i % gridCols,
        x = gridX + (c + 0.5) * gridCell,
        y = gridTop + (r + 0.5) * gridCell,
        active = facts.indices[i].every(
          (v, k) => v === (index ?? shape.map(() => 0))[k],
        );
      const node = board.rect(
        "view-" + i,
        x - gridCell / 2 + 2,
        y - gridCell / 2 + 2,
        gridCell - 4,
        gridCell - 4,
        active ? P.orange : P.faint,
        { rx: 3 },
      );
      cellText(board, "view-value-" + i, v, x, y + 5, gridCell, {
        color: active ? P.paper : P.ink,
      });
      if (stateKey)
        board.selectable(node, {
          label: "选择索引 " + facts.indices[i].join(", "),
          selected: active,
          onSelect: () =>
            context.controls.setState(stateKey, facts.indices[i].slice()),
        });
    });
    const selected = index ?? shape.map(() => 0),
      selectedFlat = facts.indices.findIndex((ix) =>
        ix.every((v, i) => v === selected[i]),
      ),
      r = Math.floor(selectedFlat / gridCols),
      c = selectedFlat % gridCols,
      start = [gridX + (c + 1) * gridCell + 4, gridTop + (r + 0.5) * gridCell],
      end = addressPosition(facts.selectedAddress);
    board.svgPath(
      "address-link",
      `M${start[0]},${start[1]} C${Math.min(board.width - 12, start[0] + 30)},${start[1]} ${Math.min(board.width - 12, end[0] + 24)},${end[1] + 48} ${end[0]},${end[1] + 34}`,
      { color: P.orange, width: 1.5, opacity: 0.65 },
    );
    board.text(
      "index",
      `索引 [${selected.join(", ")}]`,
      16,
      board.height - 45,
      { size: 13, color: P.orange },
    );
    board.text(
      "offset",
      `位置 ${facts.selectedAddress} · 字节偏移 ${facts.selectedAddress * itemSize}`,
      16,
      board.height - 20,
      { size: 13, color: P.blue },
    );
    return facts;
  }
  function schedule(
    board,
    { tasks, progress = 0, title = null, domain = null } = {},
  ) {
    const facts = N.schedule(tasks);
    if (facts.lanes.length > 4 || facts.records.length > 16)
      throw Error("Scheduling drawing supports four lanes and sixteen tasks");
    if (!Number.isFinite(progress) || progress < 0 || progress > 1)
      throw Error("Progress in [0,1] required");
    const interval = domain ?? [0, Math.max(facts.span, 1)];
    if (
      !Array.isArray(interval) ||
      interval.length !== 2 ||
      !interval.every(Number.isFinite) ||
      interval[0] !== 0 ||
      interval[1] < facts.span ||
      interval[1] <= 0
    )
      throw Error(
        "Schedule domain starts at zero and contains all supplied times",
      );
    const left = 62,
      right = board.width - 24,
      top = 52,
      bottom = board.height - 65,
      laneH = (bottom - top) / facts.lanes.length,
      x = (t) => left + ((right - left) * t) / interval[1],
      time = interval[1] * progress;
    if (laneH < 44 || right - left < 150)
      throw Error("Schedule needs more lane space");
    if (title) board.text("title", title, 16, 20, { size: 14 });
    const laneY = (lane) => top + facts.lanes.indexOf(lane) * laneH + laneH / 2;
    facts.lanes.forEach((lane, i) => {
      const y = laneY(lane);
      board.text("lane-" + i, lane, left - 10, y + 5, {
        size: 12,
        anchor: "end",
        color: P.muted,
      });
      board.line("lane-axis-" + i, left, y, right, y, P.faint, 1);
    });
    const byId = new Map(facts.records.map((t) => [t.id, t]));
    facts.records.forEach((t, i) => {
      const y = laneY(t.lane),
        width = Math.max(2, x(t.finish) - x(t.start)),
        fill = color(t.id),
        label = t.label ?? t.id;
      if (typeof label !== "string" || label.length > 20)
        throw Error("Short task label required");
      board.rect("task-" + t.id, x(t.start), y - 14, width, 28, fill, {
        opacity: time >= t.start ? 1 : 0.2,
        rx: 3,
      });
      for (const [j, dep] of t.dependencies.entries()) {
        const d = byId.get(dep);
        if (d.lane !== t.lane) {
          const a = [x(d.finish), laneY(d.lane) + 14],
            b = [x(t.start), y - 14];
          board.svgPath(
            "dependency-" + t.id + "-" + j,
            `M${a[0]},${a[1]} L${a[0]},${(a[1] + b[1]) / 2} L${b[0]},${(a[1] + b[1]) / 2} L${b[0]},${b[1]}`,
            {
              color: P.muted,
              width: 1,
              dash: "3 3",
              opacity: 0.45,
            },
          );
        }
      }
      if (V.measure(label, 12) <= width - 10)
        board.text("task-label-" + t.id, label, x(t.start) + width / 2, y + 4, {
          size: 12,
          anchor: "middle",
          color: P.paper,
          halo: false,
        });
      else if (width > 4)
        board.text(
          "task-number-" + t.id,
          String(tasks.findIndex((task) => task.id === t.id) + 1),
          x(t.start) + width / 2,
          y + 4,
          { size: 12, anchor: "middle", color: P.paper, halo: false },
        );
    });
    for (let i = 0; i <= 4; i++) {
      const t = (interval[1] * i) / 4;
      board.text("tick-" + i, fmt(t), x(t), bottom + 23, {
        size: 12,
        color: P.muted,
        anchor: "middle",
      });
    }
    board.line("cursor", x(time), top - 8, x(time), bottom + 6, P.orange, 1.5);
    board.text("time", `t = ${fmt(time)} · 示例时间单位`, left, bottom + 48, {
      size: 13,
      color: P.orange,
    });
    const current = facts.records
        .filter((t) => t.start <= time && time < t.finish)
        .map((t) => t.id),
      completed = facts.records
        .filter((t) => t.finish <= time)
        .map((t) => t.id);
    return { ...facts, time, current, completed };
  }
  function codeLines(
    board,
    {
      lines,
      activeLine = null,
      title = null,
      startLine = 1,
      highlights = {},
    } = {},
  ) {
    if (
      !Array.isArray(lines) ||
      !lines.length ||
      lines.length > 12 ||
      lines.some((l) => typeof l !== "string" || l.length > 100)
    )
      throw Error("Code view needs 1..12 short lines");
    if (!Number.isInteger(startLine) || startLine < 1)
      throw Error("Positive source start line required");
    if (
      activeLine !== null &&
      (!Number.isFinite(activeLine) ||
        activeLine < startLine ||
        activeLine > startLine + lines.length - 1)
    )
      throw Error("Displayed code line is out of range");
    const top = title ? 48 : 20,
      rowH = Math.min(30, (board.height - top - 12) / lines.length),
      font = 13;
    if (
      rowH < 23 ||
      lines.some((l) => V.measure(l, font, mono) > board.width - 64)
    )
      throw Error(
        "Code lines do not fit; shorten the local example, do not shrink below 13px",
      );
    if (title) board.text("title", title, 16, 20, { size: 14 });
    if (
      !highlights ||
      typeof highlights !== "object" ||
      Array.isArray(highlights) ||
      Object.keys(highlights).length > 16
    )
      throw Error("At most sixteen identifier highlights");
    if (
      Object.values(highlights).some(
        (v) =>
          typeof v !== "string" ||
          (!Object.hasOwn(P, v) && !/^#[0-9a-fA-F]{6}$/.test(v)),
      )
    )
      throw Error("Code highlights use palette names or six-digit hex colors");
    lines.forEach((line, i) => {
      const y = top + i * rowH + 16,
        n = startLine + i,
        active = activeLine !== null && Math.floor(activeLine) === n;
      board.rect(
        "line-bg-" + i,
        12,
        y - 18,
        board.width - 24,
        rowH,
        active ? "#eee9df" : P.paper,
        { rx: 2 },
      );
      board.text("line-no-" + i, n, 38, y, {
        size: 12,
        color: P.muted,
        anchor: "end",
        family: mono,
        halo: false,
      });
      let x = 52;
      line.split(/([A-Za-z_]\w*)/).forEach((part, k) => {
        const fill = Object.hasOwn(highlights, part)
          ? (P[highlights[part]] ?? highlights[part])
          : active
            ? P.ink
            : P.muted;
        if (part)
          board.text("line-" + i + "-" + k, part, x, y, {
            size: font,
            color: fill,
            family: mono,
            halo: false,
          });
        x += V.measure(part, font, mono);
      });
    });
    if (activeLine !== null)
      board.line(
        "line-cursor",
        14,
        top + (activeLine - startLine) * rowH - 2,
        14,
        top + (activeLine - startLine) * rowH + 17,
        P.orange,
        3,
      );
    return {
      activeLine,
      visibleLines: [startLine, startLine + lines.length - 1],
      convention:
        "Displayed line/state is supplied or comes from bounded demonstration instructions; this component does not execute source code.",
    };
  }
  function memoryObjects(
    board,
    { snapshot, objectIds = null, variableIds = null, title = null } = {},
  ) {
    if (
      !snapshot ||
      typeof snapshot !== "object" ||
      !snapshot.objects ||
      !snapshot.locals
    )
      throw Error("Memory snapshot needs locals and objects");
    const ids = objectIds ?? Object.keys(snapshot.objects),
      names = variableIds ?? Object.keys(snapshot.locals);
    if (
      ids.length > 4 ||
      names.length > 6 ||
      new Set(ids).size !== ids.length ||
      new Set(names).size !== names.length
    )
      throw Error("Memory drawing needs ≤4 objects and ≤6 unique variables");
    const top = title ? 45 : 20,
      rowH = Math.min(
        68,
        (board.height - top - 18) / Math.max(ids.length, names.length, 1),
      ),
      objectX = 110,
      cell = Math.min(
        36,
        (board.width - objectX - 22) /
          Math.max(...Object.values(snapshot.objects).map((a) => a.length), 1),
      );
    if (rowH < 38 || cell < 26)
      throw Error("Memory drawing needs more space or smaller objects");
    if (title) board.text("title", title, 16, 20, { size: 14 });
    names.forEach((name, i) => {
      const ref = snapshot.locals[name]?.ref,
        y = top + i * rowH + 20;
      board.text("variable-" + name, name, 28, y, {
        size: 14,
        color: ref ? color(ref) : P.muted,
      });
      if (ref) {
        if (!ids.includes(ref))
          throw Error("Referenced object missing from drawing order");
        const targetY = top + ids.indexOf(ref) * rowH + 20;
        board.svgPath(
          "reference-" + name,
          `M52,${y - 4} C80,${y - 4} 80,${targetY} ${objectX - 6},${targetY}`,
          { color: color(ref), width: 1.5 },
        );
        board.circle(
          "reference-end-" + name,
          objectX - 6,
          targetY,
          2.5,
          color(ref),
        );
      }
    });
    ids.forEach((id, i) => {
      const values = snapshot.objects[id],
        y = top + i * rowH + 6;
      if (!values) return;
      if (
        !Array.isArray(values) ||
        !values.length ||
        values.length > 8 ||
        !values.every(Number.isFinite)
      )
        throw Error(
          "Drawn memory objects are finite arrays of up to eight values",
        );
      values.forEach((value, k) => {
        board.rect(
          "object-" + id + "-" + k,
          objectX + k * cell,
          y,
          cell - 2,
          30,
          P.faint,
          { stroke: color(id), "stroke-width": 1, rx: 2 },
        );
        cellText(
          board,
          "value-" + id + "-" + k,
          value,
          objectX + (k + 0.5) * cell - 1,
          y + 20,
          cell,
        );
      });
      board.text("object-id-" + id, id, objectX, y - 6, {
        size: 12,
        color: color(id),
      });
    });
    return {
      snapshot,
      objectIds: ids,
      variableIds: names,
      convention:
        "Object identity and references; positions are illustrative and do not represent physical memory addresses.",
    };
  }
  function memoryTrace(
    board,
    { instructions, lines, step = 0, title = null } = {},
  ) {
    const facts = N.memoryTrace(instructions);
    if (!Number.isInteger(step) || step < 0 || step > facts.steps)
      throw Error("Integer demonstration step is out of range");
    const snapshot = facts.history[step],
      boxes = board.layout(2, {
        kind: "columns",
        gap: 20,
        minColumnWidth: 280,
        weights: [1, 1.3],
      });
    board.region("state", boxes[1], (b) =>
      memoryObjects(b, {
        snapshot,
        objectIds: facts.objectIds,
        variableIds: facts.variableIds,
        title: "变量与对象",
      }),
    );
    board.region("code", boxes[0], (b) =>
      codeLines(b, {
        lines,
        activeLine: snapshot.line,
        title: title ?? "刚执行的语句",
        highlights: Object.fromEntries(
          Object.entries(snapshot.locals).map(([name, value]) => [
            name,
            color(value.ref),
          ]),
        ),
      }),
    );
    return { ...facts, snapshot, step };
  }
  Object.assign(V, {
    arrayView,
    schedule,
    codeLines,
    memoryObjects,
    memoryTrace,
  });
  Object.assign(V.components, {
    "array-view": arrayView,
    "task-schedule": schedule,
    "code-lines": codeLines,
    "memory-objects": memoryObjects,
    "memory-trace": memoryTrace,
  });
})(window);
