/* Attention, normalization and layer views from explicit small tensors. */
(function (global) {
  const V = global.VisualBook,
    P = V.palette,
    N = global.VisualBookNeural;
  const fmt = (v) => Number(v.toFixed(3));
  function attention(
    board,
    {
      queries,
      keys,
      values,
      temperature = 1,
      scaled = true,
      mask = null,
      selected = 0,
      title = null,
      view = "weights",
    } = {},
  ) {
    const facts = N.attention(queries, keys, values, {
      temperature,
      scaled,
      mask,
    });
    if (
      facts.queryShape[0] > 6 ||
      facts.keyShape[0] > 6 ||
      facts.valueShape[1] > 4
    )
      throw Error(
        "Drawn attention supports at most six queries/keys and four value dimensions",
      );
    if (
      !Number.isInteger(selected) ||
      selected < 0 ||
      selected >= queries.length
    )
      throw Error("Selected query is out of range");
    if (!["weights", "summary"].includes(view))
      throw Error("Attention view is weights or summary");
    const boxes =
      view === "weights"
        ? [{ x: 0, y: 0, width: board.width, height: board.height }]
        : board.layout(2, {
            kind: "columns",
            gap: 24,
            minColumnWidth: 220,
            weights: [1.25, 1],
          });
    board.region("weights", boxes[0], (b) =>
      V.tensor(b, {
        values: facts.weights,
        title: title ?? "每行是一组注意力权重",
        encoding: "sequential",
        domain: [0, 1],
        rowLabels: queries.map((_, i) => "q" + i),
        columnLabels: keys.map((_, i) => "k" + i),
        selected: [selected, 0],
        stateKey: null,
      }),
    );
    if (view === "summary")
      board.region("output", boxes[1], (b) => {
        const weights = facts.weights[selected],
          rowH = Math.min(38, (b.height - 90) / (keys.length + 1)),
          top = 36,
          left = 26,
          right = b.width - 24;
        b.text("query", "q" + selected + " 的加权汇总", left, 20, {
          size: 14,
          color: P.ink,
        });
        weights.forEach((weight, i) => {
          const y = top + i * rowH;
          b.text("label-" + i, "k" + i, left, y + 17, {
            size: 12,
            color: P.muted,
          });
          b.rect(
            "bar-" + i,
            left + 32,
            y + 3,
            Math.max(1, (right - left - 32) * weight),
            20,
            P.blue,
            { opacity: 0.18 + weight * 0.7, rx: 2 },
          );
          b.text("weight-" + i, fmt(weight), right, y + 17, {
            anchor: "end",
            size: 12,
            color: P.ink,
          });
        });
        b.label(
          "result",
          "输出 " + facts.output[selected].map(fmt).join(", "),
          left,
          Math.min(b.height - 14, top + keys.length * rowH + 26),
          { maxWidth: b.width - 48, color: P.orange, size: 15, avoid: false },
        );
      });
    return {
      ...facts,
      selected,
      selectedWeights: facts.weights[selected],
      selectedOutput: facts.output[selected],
    };
  }
  function normalization(
    board,
    {
      data,
      axis = 0,
      epsilon = 1e-5,
      gamma = 1,
      beta = 0,
      mode = "batch",
      runningMean = null,
      runningVariance = null,
      progress = 1,
      valueDomain = null,
      title = null,
    } = {},
  ) {
    const facts = N.normalize(data, {
        axis,
        epsilon,
        gamma,
        beta,
        mode,
        runningMean,
        runningVariance,
      }),
      [rows, cols] = facts.shape;
    if (rows > 8 || cols > 6)
      throw Error(
        "Drawn normalization supports at most eight examples and six features",
      );
    const p = V.clamp(progress, 0, 1),
      current = data.map((row, r) =>
        row.map((v, c) =>
          p < 0.5
            ? V.mix(v, facts.centered[r][c], p * 2)
            : V.mix(facts.centered[r][c], facts.output[r][c], (p - 0.5) * 2),
        ),
      );
    const all = [
        ...data.flat(),
        ...facts.centered.flat(),
        ...facts.output.flat(),
      ],
      extent = Math.max(...all.map(Math.abs), 1);
    const bounds = valueDomain ?? [-extent * 1.12, extent * 1.12];
    const groups = axis === 0 ? cols : rows,
      laneH = (board.height - 84) / groups;
    if (laneH < 42)
      throw Error("Normalization lanes need 42px each; choose fewer groups");
    const left = 48,
      right = board.width - 22;
    const scale = global.d3.scaleLinear().domain(bounds).range([left, right]);
    if (
      !Array.isArray(bounds) ||
      bounds.length !== 2 ||
      !bounds.every(Number.isFinite) ||
      bounds[1] <= bounds[0]
    )
      throw Error("Increasing finite normalization value domain required");
    board.label(
      "title",
      title ?? (axis === 0 ? "每个特征，跨样本统计" : "每个样本，跨特征统计"),
      board.width / 2,
      20,
      { anchor: "middle", maxWidth: board.width - 32, avoid: false, size: 14 },
    );
    for (let g = 0; g < groups; g++) {
      const y = 58 + g * laneH;
      board.text("group-" + g, (axis === 0 ? "特征" : "样本") + g, 8, y + 4, {
        size: 12,
        color: P.muted,
      });
      board.line("lane-" + g, left, y, right, y, P.faint, 1);
      if (bounds[0] <= 0 && bounds[1] >= 0)
        board.line(
          "zero-" + g,
          scale(0),
          y - 15,
          scale(0),
          y + 15,
          P.muted,
          1,
          0.35,
        );
      const values = axis === 0 ? current.map((row) => row[g]) : current[g];
      values.forEach((v, i) => {
        const original = axis === 0 ? data[i][g] : data[g][i];
        board.circle(
          "original-" + g + "-" + i,
          scale(original),
          y,
          3,
          P.muted,
          0.22,
        );
        board.circle(
          "value-" + g + "-" + i,
          scale(v),
          y + (i % 2 ? 5 : -5),
          4,
          axis === 0 ? P.blue : P.orange,
        );
      });
    }
    for (const value of [bounds[0], 0, bounds[1]].filter(
      (v, i, a) => a.indexOf(v) === i,
    ))
      board.text("tick-" + value, fmt(value), scale(value), board.height - 16, {
        anchor:
          value === bounds[0]
            ? "start"
            : value === bounds[1]
              ? "end"
              : "middle",
        size: 12,
        color: P.muted,
      });
    return {
      ...facts,
      current,
      progress: p,
      stage:
        p === 0
          ? "input"
          : p < 0.5
            ? "centering"
            : p === 0.5
              ? "centered"
              : p < 1
                ? "scaling"
                : "output",
      convention:
        facts.convention +
        "; intermediate positions explain centering/scaling, not another normalization algorithm",
    };
  }
  function denseLayer(
    board,
    {
      input,
      weights,
      bias = 0,
      activation = "linear",
      selected = 0,
      progress = 1,
      title = null,
      stateKey = null,
      mode = "forward",
      seeds = null,
    } = {},
    context = {},
  ) {
    if (!["forward", "backward"].includes(mode))
      throw Error("Dense layer mode is forward or backward");
    const facts = N.denseBackward(input, weights, {
      bias,
      activation,
      seeds: seeds ?? [weights[0].map((_, i) => (i === selected ? 1 : 0))],
    });
    if (input.length !== 1 || weights.length > 6 || weights[0].length > 6)
      throw Error(
        "Drawn dense layer needs one sample and at most six inputs/outputs",
      );
    if (
      !Number.isInteger(selected) ||
      selected < 0 ||
      selected >= weights[0].length
    )
      throw Error("Selected output is out of range");
    const p = V.clamp(progress, 0, 1),
      left = 54,
      right = board.width - 54,
      top = 60,
      height = board.height - 112,
      n = input[0].length,
      m = weights[0].length;
    const at = (i, count) => top + ((i + 0.5) * height) / count;
    if (Math.min(height / n, height / m) < 35 || right - left < 150)
      throw Error("Dense layer diagram is too small");
    board.text(
      "input-title",
      mode === "forward" ? "输入" : "输入梯度 g",
      left,
      23,
      {
        anchor: "middle",
        size: 13,
        color: P.blue,
      },
    );
    board.text(
      "output-title",
      title ?? (mode === "forward" ? "输出" : "反传种子 g"),
      right,
      23,
      {
        anchor: "middle",
        size: 13,
        color: P.orange,
      },
    );
    const displayedWeights =
      mode === "forward" ? weights : facts.weightGradient;
    const maximum = Math.max(...displayedWeights.flat().map(Math.abs), 1e-12);
    weights.forEach((row, i) =>
      row.forEach((w, j) => {
        const shown = displayedWeights[i][j];
        const active = j === selected;
        board.line(
          "edge-" + i + "-" + j,
          left + 18,
          at(i, n),
          right - 18,
          at(j, m),
          shown < 0 ? P.blue : P.orange,
          active ? 1 + (2.5 * Math.abs(shown)) / maximum : 1,
          active ? 0.35 + 0.6 * p : 0.12,
        );
        if (
          active &&
          mode === "backward" &&
          facts.preactivationGradient[0][j] !== 0
        )
          board.circle(
            "pulse-" + i + "-" + j,
            V.mix(right - 18, left + 18, p),
            V.mix(at(j, m), at(i, n), p),
            3,
            P.orange,
          );
      }),
    );
    input[0].forEach((v, i) => {
      board.circle("in-" + i, left, at(i, n), 18, P.paper);
      board.mark("ring-in-" + i, "circle", {
        cx: left,
        cy: at(i, n),
        r: 18,
        fill: "none",
        stroke: P.blue,
        "stroke-width": 1.5,
      });
      board.text(
        "in-val-" + i,
        fmt(mode === "forward" ? v : facts.inputGradient[0][i]),
        left,
        at(i, n) + 4,
        {
          anchor: "middle",
          size: 13,
        },
      );
    });
    facts.output[0].forEach((v, i) => {
      board.circle(
        "out-" + i,
        right,
        at(i, m),
        18,
        i === selected ? P.orange : P.faint,
      );
      board.text(
        "out-val-" + i,
        fmt(mode === "forward" ? v : facts.outputGradient[0][i]),
        right,
        at(i, m) + 4,
        {
          anchor: "middle",
          size: 13,
          color: i === selected ? "#fff" : P.ink,
          halo: false,
        },
      );
      if (stateKey) {
        const hit = board.mark("select-" + i, "circle", {
          cx: right,
          cy: at(i, m),
          r: 23,
          fill: "transparent",
          "aria-label": "选择输出 " + i,
        });
        board.selectable(hit, {
          label: "选择输出 " + i,
          selected: i === selected,
          onSelect: () => context.controls.setState(stateKey, i),
        });
      }
    });
    const terms = input[0].map((v, i) => v * weights[i][selected]);
    const expression = [...terms, facts.bias[selected]]
      .map(
        (v, i) =>
          (i ? (v < 0 ? " − " : " + ") : v < 0 ? "−" : "") + fmt(Math.abs(v)),
      )
      .join("");
    board.label(
      "dot",
      mode === "forward"
        ? expression + " = " + fmt(facts.preactivation[0][selected])
        : "g 是 seed 加权目标的导数；线宽与颜色显示权重梯度",
      board.width / 2,
      board.height - 24,
      { maxWidth: board.width - 28, anchor: "middle", avoid: false, size: 13 },
    );
    return {
      ...facts,
      selected,
      terms,
      preactivationSelected: facts.preactivation[0][selected],
      outputSelected: facts.output[0][selected],
    };
  }
  function dropout(
    board,
    {
      data,
      mask,
      rate = 0.5,
      training = true,
      progress = 1,
      title = null,
    } = {},
  ) {
    const facts = N.dropout(data, mask, { rate, training }),
      p = V.clamp(progress, 0, 1),
      current = data.map((row, r) =>
        row.map((v, c) => V.mix(v, facts.output[r][c], p)),
      );
    const extent = Math.max(
      ...data.flat().map(Math.abs),
      ...facts.output.flat().map(Math.abs),
      1,
    );
    V.tensor(board, {
      values: current,
      title:
        title ??
        (training ? "固定掩码：保留项按比例放大" : "推理：直接保留输入"),
      encoding: "diverging",
      domain: [-extent, extent],
    });
    return {
      ...facts,
      current,
      progress: p,
      convention:
        facts.convention +
        "; intermediate values are illustrative interpolation",
    };
  }
  Object.assign(V.components, {
    attention,
    normalization,
    "dense-layer": denseLayer,
    dropout,
  });
})(window);
