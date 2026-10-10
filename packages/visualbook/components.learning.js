/* Small data-driven learning examples. No invented training or hardware measurements. */
(function (global) {
  const V = global.VisualBook,
    P = V.palette;
  const finite = (v) => {
    if (!Number.isFinite(v)) throw Error("Finite learning input required");
    return v;
  };
  const points = (data) => {
    if (
      !Array.isArray(data) ||
      !data.length ||
      data.length > 200 ||
      data.some(
        (p) => !Array.isArray(p) || p.length !== 2 || !p.every(Number.isFinite),
      )
    )
      throw Error("Learning data needs 1..200 finite 2D points");
    return data;
  };
  const fmt = (v) => Number(v.toFixed(3));
  const {
    regression,
    regressionOptimum: optimum,
    pca2d,
  } = global.VisualBookNumeric;
  function drawRegression(
    board,
    {
      data,
      weight = 1,
      bias = 0,
      lambda = 0,
      xDomain = [-3, 3],
      yDomain = [-3, 3],
      progress = 1,
      squares = false,
      draggable = false,
      stateKey = null,
      title = null,
    } = {},
    context = {},
  ) {
    const facts = regression(data, weight, bias, lambda);
    if (data.length > 60)
      throw Error("Drawn regression supports at most 60 points");
    const legendH = V.legend(
      board,
      "legend",
      [
        { label: "数据", color: "blue" },
        { label: "预测", color: "orange" },
        { label: squares ? "残差²" : "残差", color: "violet" },
      ],
      { y: 23 },
    );
    // Reserve actual legend rows so small screens do not collide with the plot.
    const area = board.region(
      "plot",
      {
        x: 0,
        y: legendH + 10,
        width: board.width,
        height: board.height - legendH - 10,
      },
      (b) => {
        const g = V.plotFrame(b, "axes", {
          xDomain,
          yDomain,
          title,
          grid: false,
        });
        b.curve(
          "fit",
          g,
          xDomain.map((x) => [x, weight * x + bias]),
          { color: P.orange, width: 2.5 },
        );
        data.forEach(([x, y], i) => {
          const predicted = facts.predictions[i],
            phase = V.clamp(progress, 0, 1),
            current = V.mix(y, predicted, phase);
          const line = b.line(
            "residual-" + i,
            g.x(x),
            g.y(y),
            g.x(x),
            g.y(current),
            P.violet,
            1.5,
            0.65,
          );
          line.setAttribute("clip-path", g.clip);
          b.circle("data-" + i, g.x(x), g.y(y), 4, P.blue);
          b.mark("prediction-" + i, "circle", {
            cx: g.x(x),
            cy: g.y(current),
            r: 3,
            fill: P.paper,
            stroke: P.orange,
            "stroke-width": 1.5,
            opacity: phase,
            "clip-path": g.clip,
          });
          if (squares) {
            const size = Math.abs(current - y) * g.unitY;
            b.rect(
              "square-" + i,
              g.x(x),
              Math.min(g.y(y), g.y(current)),
              size,
              size,
              P.violet,
              { opacity: 0.12, "clip-path": g.clip },
            );
          }
        });
        if (draggable) {
          if (!stateKey)
            throw Error(
              "Regression drag needs a state key storing [weight,bias]",
            );
          const x = xDomain[1] * 0.7 || 1;
          b.handle("weight-handle", g, [x, weight * x + bias], {
            axis: "y",
            color: P.orange,
            label: "改变拟合直线的斜率",
            onChange: (p) =>
              context.controls.setState(stateKey, [(p[1] - bias) / x, bias]),
          });
        }
        return { frame: { xDomain, yDomain } };
      },
    );
    return { ...facts, plot: area };
  }
  function drawLossCurve(
    board,
    {
      data,
      bias = 0,
      lambda = 0,
      weight = 1,
      xDomain = [-2, 3],
      yDomain = null,
      progress = 1,
      title = null,
    } = {},
  ) {
    points(data);
    const samples = Array.from({ length: 201 }, (_, i) => {
      const w = V.mix(...xDomain, i / 200);
      return [w, regression(data, w, bias, lambda).loss];
    });
    const f = V.plotFrame(board, "axes", {
      xDomain,
      yDomain: yDomain ?? [
        0,
        Math.max(...samples.map((p) => p[1])) * 1.05 || 1,
      ],
      grid: false,
      title,
    });
    board.curve("loss", f, samples, { color: P.blue, width: 2.5 });
    const current = regression(data, weight, bias, lambda),
      at = V.clamp(progress, 0, 1);
    board.line(
      "guide",
      f.x(weight),
      f.y(0),
      f.x(weight),
      f.y(current.loss),
      P.orange,
      1,
      0.45 * at,
    );
    board.circle("current", f.x(weight), f.y(current.loss), 5, P.orange);
    return { ...current, samples };
  }
  function clipHalfPlane(polygon, w, bias) {
    const result = [];
    polygon.forEach((p, i) => {
      const q = polygon[(i + 1) % polygon.length],
        a = V.dot(w, p) + bias,
        b = V.dot(w, q) + bias;
      if (a >= 0) result.push(p);
      if (a >= 0 !== b >= 0) {
        const t = a / (a - b);
        result.push([V.mix(p[0], q[0], t), V.mix(p[1], q[1], t)]);
      }
    });
    return result;
  }
  function drawBoundary(
    board,
    {
      data = [],
      labels = [],
      weights = [1, 1],
      bias = 0,
      xDomain = [-3, 3],
      yDomain = [-3, 3],
      selected = null,
      stateKey = null,
      title = null,
    } = {},
    context = {},
  ) {
    if (
      !Array.isArray(weights) ||
      weights.length !== 2 ||
      !weights.every(Number.isFinite)
    )
      throw Error("Boundary needs finite 2D weights");
    finite(bias);
    if (data.length) {
      points(data);
      if (
        data.length > 80 ||
        labels.length !== data.length ||
        labels.some((v) => v !== 0 && v !== 1)
      )
        throw Error("Boundary needs <=80 points and binary labels");
    }
    if (
      selected !== null &&
      (!Number.isInteger(selected) || selected < 0 || selected >= data.length)
    )
      throw Error("Selected data point is out of range");
    const f = V.plotFrame(board, "axes", {
        xDomain,
        yDomain,
        title,
        grid: false,
      }),
      rectangle = [
        [xDomain[0], yDomain[0]],
        [xDomain[1], yDomain[0]],
        [xDomain[1], yDomain[1]],
        [xDomain[0], yDomain[1]],
      ];
    for (const [id, w, b, c] of [
      ["positive", weights, bias, P.orange],
      ["negative", weights.map((v) => -v), -bias, P.blue],
    ]) {
      const polygon = weights.every((v) => v === 0)
        ? bias >= 0 === (id === "positive")
          ? rectangle
          : []
        : clipHalfPlane(rectangle, w, b);
      if (polygon.length) {
        const shape = board.path(
          id,
          polygon.map(([x, y]) => [f.x(x), f.y(y)]),
          { color: c, width: 0, closed: true, opacity: 0.08 },
        );
        shape.setAttribute("clip-path", f.clip);
      }
    }
    const crossings = [];
    rectangle.forEach((p, i) => {
      const q = rectangle[(i + 1) % 4],
        a = V.dot(weights, p) + bias,
        b = V.dot(weights, q) + bias;
      if (a === 0) crossings.push(p);
      if (a * b < 0) {
        const t = a / (a - b);
        crossings.push([V.mix(p[0], q[0], t), V.mix(p[1], q[1], t)]);
      }
    });
    if (crossings.length >= 2 && !weights.every((v) => v === 0))
      board.curve("boundary", f, [crossings[0], crossings.at(-1)], {
        color: P.ink,
        width: 2,
      });
    const scores = data.map((p) => V.dot(weights, p) + bias),
      probabilities = scores.map((x) =>
        V.scalarFunction({ kind: "sigmoid" }).f(x),
      ),
      predictions = scores.map((x) => (x >= 0 ? 1 : 0));
    data.forEach((p, i) => {
      const shape = board.mark("point-" + i, "circle", {
        cx: f.x(p[0]),
        cy: f.y(p[1]),
        r: selected === i ? 7 : 4.5,
        fill: labels[i] ? P.orange : P.blue,
        stroke: predictions[i] === labels[i] ? P.paper : P.ink,
        "stroke-width": predictions[i] === labels[i] ? 1 : 2,
      });
      if (stateKey)
        board.selectable(shape, {
          label: "数据点 " + (i + 1),
          selected: selected === i,
          onSelect: () => context.controls.setState(stateKey, i),
        });
    });
    return {
      weights,
      bias,
      scores,
      probabilities,
      predictions,
      correct: predictions.filter((v, i) => v === labels[i]).length,
      total: data.length,
      selected:
        selected === null
          ? null
          : {
              index: selected,
              point: data[selected],
              probability: probabilities[selected],
              label: labels[selected],
            },
      convention:
        "Supplied linear classifier; colors encode supplied labels; outlined points are misclassified; no weights were trained",
    };
  }
  function drawPCA(
    board,
    {
      data,
      progress = 0,
      xDomain = [-3, 3],
      yDomain = [-3, 3],
      draggable = false,
      stateKey = null,
      title = null,
      view = "projection",
      pointColors = null,
    } = {},
    context = {},
  ) {
    points(data);
    if (data.length > 60) throw Error("Drawn PCA supports at most 60 points");
    if (!["projection", "coordinates"].includes(view))
      throw Error("PCA view is projection or coordinates");
    if (view === "coordinates" && draggable)
      throw Error(
        "Drag original points, then share data with a PCA coordinate view",
      );
    if (
      pointColors !== null &&
      (!Array.isArray(pointColors) ||
        pointColors.length !== data.length ||
        pointColors.some((c) => !Object.hasOwn(P, c)))
    )
      throw Error("One known palette color per PCA point required");
    const facts = pca2d(data),
      f = V.plotFrame(board, "axes", {
        xDomain,
        yDomain,
        equalUnits: true,
        title,
        grid: false,
      }),
      phase = V.clamp(progress, 0, 1),
      axis = facts.axis;
    const length = Math.sqrt(facts.eigenvalues[0]) * 2;
    board.curve(
      "principal",
      f,
      [-1, 1].map((t) =>
        view === "coordinates"
          ? [t * length, 0]
          : facts.mean.map((v, j) => v + t * length * axis[j]),
      ),
      { color: P.orange, width: 2.5 },
    );
    const mean = view === "coordinates" ? [0, 0] : facts.mean;
    board.circle("mean", f.x(mean[0]), f.y(mean[1]), 4, P.ink);
    data.forEach((p, i) => {
      const q =
          view === "coordinates"
            ? facts.coordinates[i]
            : facts.reconstructed[i],
        at = p.map((v, j) => V.mix(v, q[j], phase));
      const line = board.line(
        "residual-" + i,
        f.x(p[0]),
        f.y(p[1]),
        f.x(q[0]),
        f.y(q[1]),
        P.muted,
        1,
        view === "projection" ? 0.25 : 0,
      );
      line.setAttribute("clip-path", f.clip);
      const color = pointColors ? P[pointColors[i]] : P.blue;
      board.circle("point-" + i, f.x(at[0]), f.y(at[1]), 4, color);
      if (draggable) {
        if (!stateKey) throw Error("PCA dragging needs shared data state");
        board.handle("handle-" + i, f, p, {
          color,
          ariaLabel: "移动数据点 " + (i + 1),
          onChange: (value) =>
            context.controls.setState(
              stateKey,
              data.map((p, j) => (j === i ? value : p)),
            ),
        });
      }
    });
    return facts;
  }
  V.regression = regression;
  V.regressionOptimum = optimum;
  V.pca2d = pca2d;
  Object.assign(V.components, {
    regression: drawRegression,
    "loss-curve": drawLossCurve,
    "decision-boundary": drawBoundary,
    pca: drawPCA,
  });
})(window);
