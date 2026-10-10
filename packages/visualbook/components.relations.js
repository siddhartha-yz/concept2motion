/* A common visual language for sums and durations, not chapter-specific drawings. */
(function (global) {
  const V = global.VisualBook,
    P = V.palette,
    N = global.VisualBookRelations;
  const colors = [P.blue, P.orange, P.violet, P.green, P.gold];
  const fmt = (v) => V.formatNumber(v);
  const label = (board, id, text, x, y, options = {}) => {
    if (
      typeof text !== "string" ||
      V.measure(text, options.size ?? 13) > (options.maxWidth ?? 100)
    )
      throw Error("Use a shorter relation label");
    return board.text(id, text, x, y, { size: 13, ...options });
  };
  function contributions(
    board,
    {
      terms,
      dimension = 0,
      progress = 1,
      domain = null,
      title = null,
      sumLabel = "合计",
    } = {},
  ) {
    const facts = N.contributions(terms, {
      prefix: V.clamp(progress, 0, 1) * terms.length,
    });
    if (
      terms.length > 6 ||
      !Number.isInteger(dimension) ||
      dimension < 0 ||
      dimension >= facts.dimension
    )
      throw Error("Draw at most 6 terms and one valid vector dimension");
    const titleHeight = title ? 36 : 14,
      row = (board.height - titleHeight - 40) / (terms.length + 1);
    if (row < 36 || board.width < 260)
      throw Error("Contributions need more space or fewer terms");
    const values = [
      ...facts.records.map((r) => r.value[dimension]),
      facts.sum[dimension],
    ];
    const extent = Math.max(1e-6, ...values.map(Math.abs));
    const limits = domain ?? [-extent * 1.12, extent * 1.12];
    if (
      !Array.isArray(limits) ||
      limits.length !== 2 ||
      !limits.every(Number.isFinite) ||
      limits[0] >= 0 ||
      limits[1] <= 0 ||
      values.some((v) => v < limits[0] || v > limits[1])
    )
      throw Error("Contribution domain must include zero and all terms/sum");
    const left = 84,
      right = board.width - 48,
      x = global.d3.scaleLinear(limits, [left, right]),
      zero = x(0);
    if (title)
      label(board, "title", title, 16, 20, {
        maxWidth: board.width - 32,
        size: 14,
      });
    board.line(
      "zero",
      zero,
      titleHeight,
      zero,
      titleHeight + row * (terms.length + 1),
      P.muted,
      1,
      0.6,
    );
    const records = [
      ...facts.records.map((r, i) => ({
        label: r.label,
        value: r.visibleValue[dimension],
        color: colors[i % colors.length],
      })),
      {
        label: facts.prefix === terms.length ? sumLabel : "当前合计",
        value: facts.visibleSum[dimension],
        color: P.ink,
      },
    ];
    records.forEach((record, i) => {
      const y = titleHeight + row * (i + 0.5),
        end = x(record.value);
      if (i === terms.length)
        board.line(
          "sum-divider",
          16,
          titleHeight + row * i,
          board.width - 16,
          titleHeight + row * i,
          P.faint,
          1,
        );
      label(board, "label-" + i, String(record.label), 16, y + 4, {
        maxWidth: 62,
        color: i === terms.length ? P.ink : P.muted,
      });
      board.rect(
        "bar-" + i,
        Math.min(zero, end),
        y - 9,
        Math.abs(end - zero),
        18,
        record.color,
        { rx: 2, opacity: i === terms.length ? 1 : 0.75 },
      );
      board.circle("tip-" + i, end, y, 3, record.color);
      board.text("value-" + i, fmt(record.value), board.width - 16, y + 4, {
        anchor: "end",
        color: record.color,
        size: 13,
      });
    });
    board.text("axis-negative", "−", left, board.height - 12, {
      size: 13,
      color: P.muted,
    });
    board.text("axis-zero", "0", zero, board.height - 12, {
      size: 12,
      anchor: "middle",
      color: P.muted,
    });
    board.text("axis-positive", "+", right, board.height - 12, {
      size: 13,
      anchor: "end",
      color: P.muted,
    });
    return { ...facts, selectedDimension: dimension, domain: limits };
  }
  function lifetimes(
    board,
    {
      intervals,
      progress = 0,
      time = null,
      domain = null,
      sizeUnit = "单位",
      title = null,
    } = {},
  ) {
    const base = N.lifetimes(intervals),
      limits = domain ?? [0, base.end];
    if (
      intervals.length > 8 ||
      !Array.isArray(limits) ||
      limits.length !== 2 ||
      !limits.every(Number.isFinite) ||
      limits[0] > base.start ||
      limits[1] < base.end ||
      limits[0] >= limits[1]
    )
      throw Error("Draw at most 8 lifetimes inside an increasing time domain");
    const at = time ?? V.mix(limits[0], limits[1], V.clamp(progress, 0, 1)),
      facts = N.lifetimes(intervals, { time: at });
    const top = title ? 42 : 20,
      bottom = board.height - 104,
      row = (bottom - top) / intervals.length;
    if (row < 26 || board.width < 260)
      throw Error("Lifetimes need more space or fewer intervals");
    if (title)
      label(board, "title", title, 16, 20, {
        maxWidth: board.width - 32,
        size: 14,
      });
    const x = global.d3.scaleLinear(limits, [74, board.width - 20]);
    for (const tick of global.d3.ticks(...limits, 4)) {
      board.line(
        "grid-" + tick,
        x(tick),
        top - 4,
        x(tick),
        bottom + 5,
        P.faint,
        1,
      );
      board.text("tick-" + tick, fmt(tick), x(tick), bottom + 22, {
        size: 12,
        color: P.muted,
        anchor: "middle",
      });
    }
    facts.records.forEach((record, i) => {
      const y = top + row * (i + 0.5),
        color = colors[i % colors.length];
      label(board, "label-" + i, String(record.label), 16, y + 4, {
        maxWidth: 52,
        color,
      });
      board.rect(
        "interval-" + i,
        x(record.start),
        y - 7,
        x(record.end) - x(record.start),
        14,
        color,
        { rx: 2, opacity: record.active ? 0.9 : 0.24 },
      );
      board.circle("start-" + i, x(record.start), y, 3, color);
      board.mark("end-" + i, "circle", {
        cx: x(record.end),
        cy: y,
        r: 3,
        stroke: color,
        "stroke-width": 1.5,
        fill: P.paper,
      });
    });
    const cursor = x(at);
    if (at >= limits[0] && at <= limits[1])
      board.line("time", cursor, top - 4, cursor, bottom + 5, P.ink, 1.5);
    const graphTop = bottom + 36,
      graphBottom = board.height - 28,
      max = Math.max(1, facts.peakSize),
      y = global.d3.scaleLinear([0, max], [graphBottom, graphTop]);
    const points = [[limits[0], 0]];
    for (const event of facts.series) {
      points.push([event.time, points.at(-1)[1]], [event.time, event.size]);
    }
    points.push([limits[1], points.at(-1)[1]]);
    board.path(
      "size",
      points.map(([t, size]) => [x(t), y(size)]),
      { color: P.ink, width: 1.8 },
    );
    board.circle("size-at", cursor, y(facts.activeSize), 4, P.orange);
    label(board, "size-label", String(sizeUnit), 16, graphTop + 12, {
      maxWidth: 52,
      size: 12,
      color: P.muted,
    });
    label(board, "size-now", String(fmt(facts.activeSize)), 16, graphBottom, {
      maxWidth: 52,
      color: P.orange,
    });
    board.text("time-label", "t = " + fmt(at), x(limits[1]), board.height - 8, {
      size: 12,
      anchor: "end",
      color: P.muted,
    });
    return { ...facts, domain: limits };
  }
  function vectorSum(
    board,
    {
      terms,
      start = [0, 0],
      progress = 1,
      xDomain = [-3, 3],
      yDomain = [-1, 5],
      title = null,
      sumLabel = "合向量",
    } = {},
  ) {
    const facts = N.contributions(terms, {
      prefix: V.clamp(progress, 0, 1) * terms.length,
    });
    if (
      facts.dimension !== 2 ||
      terms.length > 4 ||
      !Array.isArray(start) ||
      start.length !== 2 ||
      !start.every(Number.isFinite)
    )
      throw Error("Vector sum needs 1..4 finite 2D terms and start");
    const vertices = facts.partialSums.map((v) =>
      v.map((x, j) => x + start[j]),
    );
    if (
      !Array.isArray(xDomain) ||
      !Array.isArray(yDomain) ||
      xDomain.length !== 2 ||
      yDomain.length !== 2 ||
      ![...xDomain, ...yDomain].every(Number.isFinite) ||
      xDomain[0] >= xDomain[1] ||
      yDomain[0] >= yDomain[1] ||
      vertices.some(
        ([x, y]) =>
          x < xDomain[0] || x > xDomain[1] || y < yDomain[0] || y > yDomain[1],
      )
    )
      throw Error("Vector domains must enclose all complete vertices");
    const termColors = [P.blue, P.orange, P.green, P.gold];
    const footer = 20 * Math.ceil(terms.length / 2),
      f = V.plotFrame(board, "axes", {
        xDomain,
        yDomain,
        title,
        equalUnits: true,
        grid: false,
        footerHeight: footer,
      });
    facts.records.forEach((record, i) => {
      const from = vertices[i],
        end = record.visibleValue.map((x, j) => x + from[j]),
        active = record.fraction > 0;
      board.curve("reference-" + record.id, f, [from, vertices[i + 1]], {
        color: P.muted,
        width: 1,
        opacity: 0.25,
      });
      if (active)
        board.vector("term-" + record.id, f, from, end, {
          color: termColors[i % termColors.length],
        });
      board.circle("vertex-" + i, f.x(from[0]), f.y(from[1]), 2, P.muted);
      const x = 16 + (i % 2) * (board.width / 2),
        y =
          board.height -
          10 -
          (Math.ceil(terms.length / 2) - 1 - Math.floor(i / 2)) * 20;
      board.line(
        "key-" + i,
        x,
        y - 4,
        x + 12,
        y - 4,
        termColors[i % termColors.length],
        2.5,
      );
      label(board, "legend-" + i, String(record.label), x + 18, y, {
        maxWidth: board.width / 2 - 40,
        color: termColors[i % termColors.length],
        size: 12,
      });
    });
    const currentEndpoint = facts.visibleSum.map((v, j) => v + start[j]),
      endpoint = facts.sum.map((v, j) => v + start[j]);
    board.vector("sum", f, start, currentEndpoint, { color: P.violet });
    board.circle(
      "current-end",
      f.x(currentEndpoint[0]),
      f.y(currentEndpoint[1]),
      4,
      P.violet,
    );
    const text =
      (facts.prefix === terms.length ? String(sumLabel) : "当前合计") +
      " [" +
      facts.visibleSum.map(fmt).join(", ") +
      "]";
    label(board, "sum-value", text, f.right, f.top + 14, {
      maxWidth: f.right - f.left,
      color: P.violet,
      anchor: "end",
    });
    return {
      ...facts,
      start: start.slice(),
      vertices,
      currentEndpoint,
      endpoint,
      xDomain,
      yDomain,
    };
  }
  Object.assign(V.components, {
    contributions,
    lifetimes,
    "vector-sum": vectorSum,
  });
})(window);
