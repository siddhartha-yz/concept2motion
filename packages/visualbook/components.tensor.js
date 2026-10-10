/* Reusable tensor views and adapters. Cells retain identity across parameter changes. */
(function (global) {
  const V = global.VisualBook,
    P = V.palette,
    N = global.VisualBookNeural;
  const fmt = (v, p = 2) => V.formatNumber(v, { precision: p });
  function tensor(
    board,
    {
      values,
      title = null,
      encoding = "neutral",
      domain = null,
      showValues = true,
      rowLabels = null,
      columnLabels = null,
      selected = null,
      stateKey = null,
      precision = 2,
      cellAspect = "auto",
    } = {},
    context = {},
  ) {
    const [rows, cols] = N.matrix(values);
    if (rows > 8 || cols > 8)
      throw Error("Drawn tensor supports at most 8×8 cells; use a slice");
    if (!["neutral", "sequential", "diverging"].includes(encoding))
      throw Error("Tensor encoding is neutral/sequential/diverging");
    if (!Number.isInteger(precision) || precision < 0 || precision > 5)
      throw Error("Tensor precision must be 0..5");
    if (typeof showValues !== "boolean")
      throw Error("showValues must be boolean");
    for (const [labels, length] of [
      [rowLabels, rows],
      [columnLabels, cols],
    ])
      if (
        labels !== null &&
        (!Array.isArray(labels) ||
          labels.length !== length ||
          labels.some((v) => typeof v !== "string" || v.length > 16))
      )
        throw Error("One short string label per tensor row/column required");
    if (
      selected !== null &&
      (!Array.isArray(selected) ||
        selected.length !== 2 ||
        !selected.every(Number.isInteger) ||
        selected[0] < 0 ||
        selected[0] >= rows ||
        selected[1] < 0 ||
        selected[1] >= cols)
    )
      throw Error("Selected tensor cell is outside its shape");
    const flat = values.flat(),
      minimum = Math.min(...flat),
      maximum = Math.max(...flat);
    const bounds =
      domain ??
      (encoding === "diverging"
        ? [
            -Math.max(Math.abs(minimum), Math.abs(maximum), 1e-9),
            Math.max(Math.abs(minimum), Math.abs(maximum), 1e-9),
          ]
        : [Math.min(0, minimum), Math.max(maximum, 1e-9)]);
    if (
      !Array.isArray(bounds) ||
      bounds.length !== 2 ||
      !bounds.every(Number.isFinite) ||
      bounds[1] <= bounds[0]
    )
      throw Error("Increasing finite tensor color domain required");
    if (encoding === "diverging" && !(bounds[0] < 0 && bounds[1] > 0))
      throw Error("Diverging tensor domain must straddle zero");
    const left = rowLabels ? 54 : 20,
      top = title || columnLabels ? 52 : 28,
      bottom = encoding === "neutral" ? 24 : 52;
    if (!["auto", "square", "free"].includes(cellAspect))
      throw Error("Tensor cell aspect is auto/square/free");
    const availableX = Math.min(50, (board.width - left - 20) / cols),
      availableY = Math.min(50, (board.height - top - bottom) / rows),
      square =
        cellAspect === "square" ||
        (cellAspect === "auto" && rows > 1 && cols > 1),
      cellX = square ? Math.min(availableX, availableY) : availableX,
      cellY = square ? Math.min(availableX, availableY) : availableY;
    if (Math.min(cellX, cellY) < 30)
      throw Error(
        "Tensor cells need at least30px in each direction; reduce shape or allocate more space",
      );
    const x = left + (board.width - left - 20 - cols * cellX) / 2,
      y = top + (board.height - top - bottom - rows * cellY) / 2;
    const fill = (v) =>
      encoding === "neutral"
        ? P.faint
        : encoding === "sequential"
          ? global.d3.interpolateRgb(
              P.paper,
              P.blue,
            )(V.clamp((v - bounds[0]) / (bounds[1] - bounds[0]), 0, 1))
          : global.d3.interpolateRgb(
              P.paper,
              v < 0 ? P.blue : P.orange,
            )(V.clamp(Math.abs(v) / (v < 0 ? -bounds[0] : bounds[1]), 0, 1));
    const displayValues = values.map((row) => row.map(() => null));
    const displayPrecisions = values.map((row) => row.map(() => null));
    values.forEach((row, r) =>
      row.forEach((v, c) => {
        const active = selected?.[0] === r && selected?.[1] === c;
        const color = fill(v),
          node = board.rect(
            "cell-" + r + "-" + c,
            x + c * cellX,
            y + r * cellY,
            cellX - 3,
            cellY - 3,
            color,
            { rx: 3, stroke: active ? P.ink : "none", "stroke-width": 2 },
          );
        if (stateKey) {
          const hit = board.mark("select-" + r + "-" + c, "rect", {
            x: x + c * cellX - 2,
            y: y + r * cellY - 2,
            width: cellX + 1,
            height: cellY + 1,
            fill: "transparent",
            "aria-label": `选择单元 ${r}, ${c}，值 ${fmt(v, precision)}`,
          });
          board.selectable(hit, {
            label: `选择单元 ${r}, ${c}，值 ${fmt(v, precision)}`,
            selected: active,
            onSelect: () => context.controls.setState(stateKey, [r, c]),
          });
        }
        if (showValues) {
          const contrast =
            encoding === "neutral"
              ? P.ink
              : global.d3.lab(color).l < 55
                ? "#fff"
                : P.ink;
          const display = V.fitNumber(v, {
            precision,
            maxWidth: cellX - 7,
            size: Math.max(12, Math.min(16, Math.min(cellX, cellY) * 0.38)),
          });
          displayValues[r][c] = display.text;
          displayPrecisions[r][c] = display.precision;
          board.text(
            "value-" + r + "-" + c,
            display.text,
            x + (c + 0.5) * cellX - 1.5,
            y + (r + 0.5) * cellY + 4,
            {
              anchor: "middle",
              size: display.size,
              color: contrast,
              halo: false,
            },
          );
        }
      }),
    );
    if (title)
      board.label("title", title, board.width / 2, 20, {
        anchor: "middle",
        maxWidth: board.width - 32,
        avoid: false,
        size: 14,
      });
    if (rowLabels)
      rowLabels.forEach((s, r) =>
        board.label("row-" + r, s, x - 9, y + (r + 0.5) * cellY + 4, {
          anchor: "end",
          maxWidth: 44,
          size: 12,
          avoid: false,
        }),
      );
    if (columnLabels)
      columnLabels.forEach((s, c) =>
        board.label("column-" + c, s, x + (c + 0.5) * cellX - 1.5, y - 12, {
          anchor: "middle",
          maxWidth: cellX - 4,
          size: 12,
          avoid: false,
        }),
      );
    if (encoding !== "neutral") {
      const barY = board.height - 28,
        barW = Math.min(board.width - 80, 180),
        barX = (board.width - barW) / 2;
      Array.from({ length: 32 }, (_, i) => {
        const v = V.mix(bounds[0], bounds[1], i / 31);
        board.rect(
          "scale-" + i,
          barX + (i * barW) / 32,
          barY,
          barW / 32 + 0.3,
          7,
          fill(v),
          { rx: 0 },
        );
      });
      board.text("scale-min", fmt(bounds[0]), barX - 7, barY + 8, {
        anchor: "end",
        size: 12,
        color: P.muted,
      });
      board.text("scale-max", fmt(bounds[1]), barX + barW + 7, barY + 8, {
        size: 12,
        color: P.muted,
      });
    }
    return {
      values,
      shape: [rows, cols],
      cellWidth: cellX,
      cellHeight: cellY,
      cellAspect,
      displayValues,
      displayPrecisions,
      minimum,
      maximum,
      domain: bounds,
      selected,
      value: selected ? values[selected[0]][selected[1]] : null,
      row: selected ? values[selected[0]] : null,
      column: selected ? values.map((r) => r[selected[1]]) : null,
      convention:
        "Stable row-major cell identity; color domain is explicit or reported; clipped colors and fitted display precision do not change numeric values",
    };
  }
  const components = {
    tensor,
    "matrix-product": (b, { a, b: right, ...options }) =>
      b.product("product", a, right, options),
    reshape: (b, { values, rows, ...options }) =>
      b.reshape("reshape", values, rows, options),
    convolution: (b, { input, kernel, ...options }) =>
      b.convolution("convolution", input, kernel, options),
    optimizer: (b, options) => b.optimization("optimizer", options),
    probabilities: (b, { scores, ...options }) =>
      b.probabilities("probabilities", scores, options),
    sequence: (b, { nodes, ...options }) => ({
      boxes: b.sequence("sequence", nodes, options),
    }),
  };
  V.components = Object.assign(V.components, components);
  V.tensor = tensor;
})(window);
