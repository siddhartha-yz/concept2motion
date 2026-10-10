/* Probability blocks with deterministic inputs and explicit approximations. */
(function (global) {
  const V = global.VisualBook,
    P = V.palette;
  const finite = (value) => {
    if (!Number.isFinite(value))
      throw Error("Finite probability input required");
    return value;
  };
  const probability = (value) => {
    finite(value);
    if (value < 0 || value > 1) throw Error("Probability must be in [0,1]");
    return value;
  };
  const fmt = (value) => V.formatNumber(value);
  const { normalCDF, binomial, histogram, bayes } = global.VisualBookNumeric;
  function legend(
    board,
    id,
    items,
    { x = 18, y = 20, maxWidth = board.width - 36, size = 13, gap = 18 } = {},
  ) {
    let cursor = x,
      row = 0;
    for (let i = 0; i < items.length; i++) {
      const item = items[i],
        w = V.measure(item.label, size) + 22;
      if (w > maxWidth) throw Error("Legend label is too long; shorten it");
      if (cursor > x && cursor + w > x + maxWidth) {
        row++;
        cursor = x;
      }
      board.circle(
        id + "-dot-" + i,
        cursor + 4,
        y + row * 24 - 4,
        4,
        P[item.color] ?? item.color ?? P.blue,
      );
      board.text(id + "-label-" + i, item.label, cursor + 15, y + row * 24, {
        size,
        color: P.muted,
      });
      cursor += w + gap;
    }
    return (row + 1) * 24;
  }
  function drawDistribution(
    board,
    {
      kind = "normal",
      mean = 0,
      sigma = 1,
      n = 12,
      p = 0.4,
      interval = null,
      progress = 1,
      xDomain = null,
      yDomain = null,
      title = null,
    } = {},
  ) {
    const phase = V.clamp(progress, 0, 1);
    if (kind === "binomial") {
      const data = binomial(n, p);
      if (n > 40)
        throw Error(
          "Drawn binomial supports n<=40; use numeric helper up to 100",
        );
      const f = V.plotFrame(board, "axes", {
        xDomain: [-0.5, n + 0.5],
        yDomain: yDomain ?? [0, Math.max(...data.probabilities) * 1.2],
        title,
        grid: false,
      });
      const chosen = interval ?? [0, n];
      chosen.forEach(finite);
      const selected = data.probabilities.reduce(
        (sum, v, k) => sum + (k >= chosen[0] && k <= chosen[1] ? v : 0),
        0,
      );
      data.probabilities.forEach((v, k) =>
        board.rect(
          "bar-" + k,
          f.x(k - 0.38),
          f.y(v),
          f.unitX * 0.76,
          f.y(0) - f.y(v),
          k >= chosen[0] && k <= chosen[1] ? P.orange : P.blue,
          { opacity: 0.25 + 0.75 * phase, "clip-path": f.clip },
        ),
      );
      return { ...data, selected, interval: chosen };
    }
    if (kind !== "normal")
      throw Error("Distribution supports normal or binomial");
    finite(mean);
    finite(sigma);
    if (sigma <= 0) throw Error("Normal sigma must be positive");
    const pdf = V.scalarFunction({ kind: "gaussian", mean, sigma }).f,
      domain = xDomain ?? [mean - 4 * sigma, mean + 4 * sigma];
    const f = V.plotFrame(board, "axes", {
      xDomain: domain,
      yDomain: yDomain ?? [0, (1 / (sigma * Math.sqrt(2 * Math.PI))) * 1.15],
      title,
      grid: false,
    });
    const range = interval ?? [mean - sigma, mean + sigma];
    if (
      !Array.isArray(range) ||
      range.length !== 2 ||
      !range.every(Number.isFinite) ||
      range[1] < range[0]
    )
      throw Error("Increasing interval required");
    const a = Math.max(domain[0], range[0]),
      b = Math.min(domain[1], range[1]),
      end = V.mix(a, b, phase);
    if (b >= a) {
      const area = [
        [a, 0],
        ...Array.from({ length: 121 }, (_, i) => {
          const x = V.mix(a, end, i / 120);
          return [x, pdf(x)];
        }),
        [end, 0],
      ];
      const shape = board.path(
        "area",
        area.map(([x, y]) => [f.x(x), f.y(y)]),
        { color: P.orange, closed: true, width: 0, opacity: 0.24 },
      );
      shape.setAttribute("clip-path", f.clip);
    }
    board.curve(
      "density",
      f,
      Array.from({ length: 241 }, (_, i) => {
        const x = V.mix(...domain, i / 240);
        return [x, pdf(x)];
      }),
      { color: P.blue, width: 2.5 },
    );
    return {
      mean,
      sigma,
      variance: sigma * sigma,
      interval: range,
      probability:
        normalCDF((range[1] - mean) / sigma) -
        normalCDF((range[0] - mean) / sigma),
      visibleProbability:
        b >= a
          ? normalCDF((end - mean) / sigma) - normalCDF((a - mean) / sigma)
          : 0,
      convention:
        "Normal CDF uses an erf approximation, absolute probability error bounded by 1.5e-7; shaded interval is clipped to the displayed domain",
    };
  }
  function drawHistogram(
    board,
    {
      samples,
      domain = [-3, 3],
      count = 12,
      density = true,
      progress = 1,
      title = null,
    } = {},
  ) {
    const data = histogram(samples, domain, count);
    if (count > 40) throw Error("Drawn histogram supports at most 40 bins");
    const key = density ? "density" : "count",
      peak = Math.max(...data.bins.map((b) => b[key]), 1e-9);
    const f = V.plotFrame(board, "axes", {
      xDomain: domain,
      yDomain: [0, peak * 1.15],
      title,
      grid: false,
    });
    data.bins.forEach((b, i) => {
      const y = b[key] * V.clamp(progress, 0, 1);
      board.rect(
        "bin-" + i,
        f.x(b.left) + 1,
        f.y(y),
        Math.max(0, f.x(b.right) - f.x(b.left) - 2),
        f.y(0) - f.y(y),
        P.blue,
        { opacity: 0.65, "clip-path": f.clip },
      );
    });
    return {
      ...data,
      density,
      convention:
        "Every supplied sample contributes exactly once or is reported outside; last bin includes its right endpoint",
    };
  }
  function drawBayes(
    board,
    {
      prior = 0.2,
      sensitivity = 0.8,
      falsePositive = 0.15,
      progress = 0,
      title = null,
    } = {},
  ) {
    const data = bayes(prior, sensitivity, falsePositive),
      phase = V.clamp(progress, 0, 1);
    if (board.width < 240 || board.height < 200)
      throw Error("Bayes area needs at least 240×200");
    const top = 50,
      bottom = board.height - 55,
      left = 24,
      width = board.width - 48,
      height = bottom - top;
    legend(
      board,
      "legend",
      [
        { label: "目标人群", color: "orange" },
        { label: "其他人群", color: "blue" },
      ],
      { y: 24 },
    );
    if (title)
      board.label("title", title, left, top - 5, {
        maxWidth: width,
        avoid: false,
        size: 13,
      });
    const split = V.mix(prior, data.posterior ?? prior, phase);
    const columns = [
      {
        id: "target",
        x: 0,
        w: split,
        hit: V.mix(sensitivity, 1, phase),
        color: P.orange,
      },
      {
        id: "other",
        x: split,
        w: 1 - split,
        hit: V.mix(falsePositive, 1, phase),
        color: P.blue,
      },
    ];
    // Both parts of each column share boundaries at every pose: no overlapping cells.
    columns.forEach((c) => {
      board.rect(
        c.id + "-positive",
        left + c.x * width,
        top,
        c.w * width,
        c.hit * height,
        c.color,
        { opacity: 0.85, stroke: P.paper, "stroke-width": 2 },
      );
      board.rect(
        c.id + "-negative",
        left + c.x * width,
        top + c.hit * height,
        c.w * width,
        (1 - c.hit) * height,
        c.color,
        { opacity: 0.18, stroke: P.paper, "stroke-width": 2 },
      );
    });
    const label =
      data.evidence === 0 && phase === 1
        ? "观察概率为 0：条件概率未定义"
        : phase === 0
          ? "全体人群 = 1"
          : phase === 1
            ? "只看选中结果的人群"
            : "全体 → 选中结果的范围";
    board.text("mass-label", label, left, bottom + 27, {
      size: 13,
      color: P.muted,
    });
    return {
      ...data,
      progress: phase,
      convention:
        data.convention +
        "; during layout interpolation rectangle area is not itself a probability measure",
    };
  }
  V.normalCDF = normalCDF;
  V.binomial = binomial;
  V.histogram = histogram;
  V.bayes = bayes;
  V.legend = legend;
  V.Board.prototype.legend = function (id, items, options) {
    return legend(this, id, items, options);
  };
  Object.assign(V.components, {
    distribution: drawDistribution,
    histogram: drawHistogram,
    bayes: drawBayes,
  });
})(window);
