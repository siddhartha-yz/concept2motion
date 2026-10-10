/* Original inline local-influence and weighting views. */
(function (global) {
  const V = global.VisualBook,
    P = V.palette,
    N = global.VisualBookSpatial;
  const fmt = (v) => V.formatNumber(v);
  function receptiveField(
    board,
    { inputLength, layers, index = 0, stateKey = null, title = null } = {},
    context = {},
  ) {
    const initial = N.receptiveField(inputLength, layers),
      selected = Math.max(0, Math.min(initial.outputLength - 1, index));
    if (
      !Number.isInteger(index) ||
      inputLength > 24 ||
      layers.length > 4 ||
      initial.layers.some((l) => l.length > 24)
    )
      throw Error(
        "Receptive field drawing supports 24 positions and four layers",
      );
    const facts = N.receptiveField(inputLength, layers, { index: selected });
    const top = title ? 64 : 40,
      bottom = board.height - 62,
      row = (bottom - top) / layers.length,
      left = 78,
      right = board.width - 22;
    if (
      row < 48 ||
      (right - left) /
        Math.max(inputLength, ...facts.layers.map((l) => l.length)) <
        9
    )
      throw Error("Receptive field needs fewer positions or more space");
    if (title) board.text("title", title, 16, 20, { size: 14 });
    const lengths = [inputLength, ...facts.layers.map((l) => l.length)],
      positions = lengths.map((length, level) =>
        Array.from({ length }, (_, i) => [
          left + ((i + 0.5) * (right - left)) / length,
          top + level * row,
        ]),
      );
    for (let level = facts.layers.length - 1; level >= 0; level--) {
      const record = facts.layers[level],
        outputs = facts.selectedByLayer[level + 1];
      for (const target of outputs)
        for (const source of record.sources[target])
          if (source >= 0 && source < record.inputLength) {
            const [x1, y1] = positions[level][source],
              [x2, y2] = positions[level + 1][target],
              middle = (y1 + y2) / 2;
            board.svgPath(
              `edge-${level}-${source}-${target}`,
              `M${x1},${y1 + 6} C${x1},${middle} ${x2},${middle} ${x2},${y2 - 6}`,
              { color: P.blue, width: 1.5, opacity: 0.28 },
            );
          }
    }
    positions.forEach((points, level) => {
      const info = level ? facts.layers[level - 1] : null,
        label = info ? String(info.label) : "输入";
      if (V.measure(label, 13) > 52) throw Error("Use a shorter layer label");
      board.text("label-" + level, label, 16, top + level * row + 4, {
        size: 13,
        color: P.muted,
      });
      if (info)
        board.text(
          "spec-" + level,
          `k${info.kernel}·s${info.stride}·d${info.dilation}`,
          16,
          top + level * row + 21,
          { size: 12, color: P.muted },
        );
      points.forEach(([x, y], i) => {
        const active = facts.selectedByLayer[level].includes(i),
          last = level === facts.layers.length,
          color = last && active ? P.orange : active ? P.blue : P.faint;
        board.circle(`node-${level}-${i}`, x, y, last && active ? 7 : 5, color);
        if (last && stateKey) {
          const target = board.mark("hit-" + i, "circle", {
            cx: x,
            cy: y,
            r: Math.min(18, (right - left) / points.length / 2),
            fill: "transparent",
          });
          board.selectable(target, {
            label: "查看输出位置 " + i,
            selected: active,
            onSelect: () => context.controls.setState(stateKey, i),
          });
        }
        if (last && active)
          board.text("selected-index", i, x, y + 24, {
            size: 12,
            anchor: "middle",
            color: P.orange,
          });
        if (
          !level &&
          active &&
          (i === facts.inputIndices[0] ||
            i === facts.inputIndices.at(-1) ||
            points.length <= 10)
        )
          board.text("input-index-" + i, i, x, y - 14, {
            size: 12,
            anchor: "middle",
            color: P.blue,
          });
      });
    });
    board.text(
      "support",
      `实际输入 ${facts.inputIndices.length} 个 · 理论跨度 ${facts.span}`,
      16,
      board.height - 18,
      { size: 13, color: P.blue },
    );
    return {
      ...facts,
      requestedIndex: index,
      selectionClamped: selected !== index,
    };
  }
  function kernelRegression(
    board,
    {
      data,
      query = 0,
      bandwidth = 1,
      xDomain = null,
      yDomain = null,
      draggable = false,
      stateKey = null,
      title = null,
    } = {},
    context = {},
  ) {
    if (
      !Array.isArray(data) ||
      data.length < 2 ||
      data.length > 24 ||
      data.some(
        (p) => !Array.isArray(p) || p.length !== 2 || !p.every(Number.isFinite),
      )
    )
      throw Error("Kernel drawing needs 2..24 finite [x,y] observations");
    const xs = data.map((p) => p[0]),
      ys = data.map((p) => p[1]),
      span = Math.max(...xs) - Math.min(...xs);
    const xd = xDomain ?? [
        Math.min(...xs) - Math.max(0.5, span * 0.1),
        Math.max(...xs) + Math.max(0.5, span * 0.1),
      ],
      range = Math.max(...ys) - Math.min(...ys),
      yd = yDomain ?? [
        Math.min(...ys) - Math.max(0.5, range * 0.15),
        Math.max(...ys) + Math.max(0.5, range * 0.15),
      ];
    if (
      !Array.isArray(xd) ||
      !Array.isArray(yd) ||
      !xd.every(Number.isFinite) ||
      !yd.every(Number.isFinite) ||
      xd.length !== 2 ||
      yd.length !== 2 ||
      xd[0] >= xd[1] ||
      yd[0] >= yd[1] ||
      query < xd[0] ||
      query > xd[1] ||
      data.some(([x, y]) => x < xd[0] || x > xd[1] || y < yd[0] || y > yd[1])
    )
      throw Error("Kernel domains must enclose data and query");
    const calculate = (x) =>
      N.gaussianWeights(
        [x],
        xs.map((x) => [x]),
        ys,
        { bandwidth },
      );
    const facts = calculate(query),
      f = V.plotFrame(board, "axes", {
        xDomain: xd,
        yDomain: yd,
        title,
        grid: false,
        footerHeight: 20,
      });
    const curve = Array.from({ length: 101 }, (_, i) => {
      const x = V.mix(...xd, i / 100);
      return [x, calculate(x).output[0]];
    });
    board.curve("regression", f, curve, {
      color: P.blue,
      width: 2.2,
      opacity: 0.55,
    });
    data.forEach(([x, y], i) => {
      board.mark("weight-" + i, "circle", {
        cx: f.x(x),
        cy: f.y(y),
        r: 20 * Math.sqrt(facts.weights[i]),
        fill: P.blue,
        opacity: 0.2,
        "clip-path": f.clip,
      });
      board.circle("observation-" + i, f.x(x), f.y(y), 3, P.ink);
    });
    const output = facts.output[0];
    board.line(
      "query",
      f.x(query),
      f.top,
      f.x(query),
      f.bottom,
      P.orange,
      1.3,
      0.5,
    );
    board.circle("estimate", f.x(query), f.y(output), 5, P.orange);
    if (draggable) {
      if (!stateKey) throw Error("Kernel drag needs shared scalar query state");
      board.handle("query", f, [query, output], {
        axis: "x",
        bounds: { x: xd, y: yd },
        color: P.orange,
        ariaLabel: "移动查询位置",
        onChange: (value) => context.controls.setState(stateKey, value[0]),
      });
    }
    board.text("estimate-value", "估计 " + fmt(output), f.right, f.top + 14, {
      size: 13,
      anchor: "end",
      color: P.orange,
    });
    board.text("legend", "彩色圆面积表示权重", f.left, board.height - 10, {
      size: 12,
      color: P.muted,
    });
    return {
      ...facts,
      data: data.map((p) => p.slice()),
      queryScalar: query,
      response: output,
      curve,
      xDomain: xd,
      yDomain: yd,
    };
  }
  Object.assign(V.components, {
    "receptive-field": receptiveField,
    "kernel-regression": kernelRegression,
  });
})(window);
