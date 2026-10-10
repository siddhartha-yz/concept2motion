/* Keep sample identity visible across numeric rows. Coordinates are numbers, not time. */
(function (global) {
  const V = global.VisualBook,
    P = V.palette,
    colors = [P.blue, P.violet, P.gold, P.orange, P.green];
  function alignedPoints(
    board,
    {
      rows,
      domain = [-3, 6],
      selected = 0,
      stateKey = null,
      connect = true,
      statistics = true,
      title = null,
      pointColors = null,
      compact = false,
      itemLabels = null,
    } = {},
    context = {},
  ) {
    if (
      !Array.isArray(rows) ||
      rows.length < 1 ||
      rows.length > 5 ||
      rows.some(
        (r) =>
          !r ||
          typeof r.label !== "string" ||
          r.label.length > 16 ||
          !Array.isArray(r.values) ||
          r.values.length < 1 ||
          r.values.length > 12 ||
          !r.values.every(Number.isFinite),
      )
    )
      throw Error(
        "Aligned points need 1..5 labelled rows, each 1..12 finite values",
      );
    const n = rows[0].values.length;
    if (rows.some((r) => r.values.length !== n))
      throw Error("Rows must preserve the same item count");
    if (!Number.isInteger(selected) || selected < 0 || selected >= n)
      throw Error("Selected aligned item is outside the rows");
    if (
      !Array.isArray(domain) ||
      domain.length !== 2 ||
      !domain.every(Number.isFinite) ||
      domain[0] >= domain[1] ||
      rows.some((r) => r.values.some((v) => v < domain[0] || v > domain[1]))
    )
      throw Error("Shared point domain must include every row value");
    if (typeof connect !== "boolean" || typeof statistics !== "boolean")
      throw Error("Aligned connect/statistics must be boolean");
    if (
      pointColors !== null &&
      (!Array.isArray(pointColors) ||
        pointColors.length !== n ||
        pointColors.some((c) => typeof c !== "string" || !P[c]))
    )
      throw Error("Use one known palette color per item");
    if (typeof compact !== "boolean")
      throw Error("Aligned compact must be boolean");
    if (
      itemLabels !== null &&
      (!Array.isArray(itemLabels) ||
        itemLabels.length !== n ||
        new Set(itemLabels).size !== n ||
        itemLabels.some(
          (label) =>
            typeof label !== "string" || !label.trim() || label.length > 12,
        ))
    )
      throw Error("One distinct short label per aligned item required");
    const legendHeight = itemLabels
      ? V.legend(
          board,
          "item-legend",
          itemLabels.map((label, i) => ({
            label,
            color: pointColors ? P[pointColors[i]] : colors[i % colors.length],
          })),
          { y: title ? 46 : 20 },
        ) + 8
      : 0;
    const left = 36,
      right = board.width - 24,
      top = (title ? 54 : 36) + legendHeight,
      bottom = board.height - 50,
      rowHeight = (bottom - top) / rows.length;
    if (board.width < 260 || rowHeight < (compact ? 50 : 68))
      throw Error(
        "Aligned points need260px width and50px compact/68px comfortable per numeric row",
      );
    const x = global.d3.scaleLinear(domain, [left, right]);
    const y = (r) => top + (r + 0.5) * rowHeight;
    const summary = rows.map((r) => {
      const mean = r.values.reduce((s, v) => s + v / n, 0),
        variance = r.values.reduce((s, v) => s + (v - mean) ** 2 / n, 0);
      if (!Number.isFinite(mean) || !Number.isFinite(variance))
        throw Error("Aligned statistics overflow; reduce scale");
      return {
        label: r.label,
        values: r.values,
        mean,
        variance,
        selectedValue: r.values[selected],
      };
    });
    if (title)
      board.label("title", title, 16, 20, {
        size: 14,
        maxWidth: board.width - 32,
        avoid: false,
      });
    if (connect)
      for (let r = 1; r < rows.length; r++)
        for (let i = 0; i < n; i++)
          board.line(
            "link-" + r + "-" + i,
            x(rows[r - 1].values[i]),
            y(r - 1),
            x(rows[r].values[i]),
            y(r),
            pointColors ? P[pointColors[i]] : colors[i % colors.length],
            1,
            i === selected ? 0.7 : 0.14,
          );
    summary.forEach((row, r) => {
      const cy = y(r);
      board.line("axis-" + r, left, cy, right, cy, P.faint, 1);
      for (const tick of x.ticks(4))
        board.line(
          "tick-" + r + "-" + tick,
          x(tick),
          cy - 3,
          x(tick),
          cy + 3,
          P.faint,
          1,
        );
      board.label("row-label-" + r, row.label, 16, cy - 21, {
        size: 13,
        maxWidth: board.width / 2 - 20,
        avoid: false,
      });
      if (statistics) {
        board.text(
          "stats-" + r,
          "μ " +
            V.formatNumber(row.mean) +
            " · v " +
            V.formatNumber(row.variance),
          right,
          cy - 21,
          { size: 12, anchor: "end", color: P.muted },
        );
        board.line(
          "mean-" + r,
          x(row.mean),
          cy - 9,
          x(row.mean),
          cy + 9,
          P.ink,
          1,
        );
      }
      row.values.forEach((value, i) => {
        // Repeated values share x; a small non-quantitative vertical offset preserves visibility.
        const equalBefore = row.values
          .slice(0, i)
          .filter((v) => v === value).length;
        const equalCount = row.values.filter((v) => v === value).length;
        const py =
          cy +
          (equalCount > 1 ? (equalBefore / (equalCount - 1) - 0.5) * 10 : 0);
        const c = pointColors ? P[pointColors[i]] : colors[i % colors.length];
        const node = board.circle(
          "point-" + r + "-" + i,
          x(value),
          py,
          i === selected ? 6 : 4,
          c,
        );
        if (stateKey) {
          const hit = board.mark("hit-" + r + "-" + i, "circle", {
            cx: x(value),
            cy: py,
            r: 14,
            fill: "transparent",
          });
          board.selectable(hit, {
            label: `选择第${i + 1}项：${row.label} ${V.formatNumber(value)}`,
            selected: i === selected,
            onSelect: () => context.controls.setState(stateKey, i),
          });
        }
      });
    });
    for (const tick of x.ticks(4))
      board.text("number-" + tick, V.formatNumber(tick), x(tick), bottom + 25, {
        size: 12,
        anchor: "middle",
        color: P.muted,
      });
    return {
      rows: summary,
      compact,
      itemLabels,
      domain,
      selected,
      selectedValues: summary.map((r) => r.selectedValue),
      convention:
        "Rows share a numeric x scale and item identity, not necessarily physical units. v uses population denominator N. Connector lines match item index, not causation, time or a training path. Small vertical offsets distinguish duplicate values; y is not quantitative.",
    };
  }
  V.components = Object.assign(V.components, {
    "aligned-points": alignedPoints,
  });
})(window);
