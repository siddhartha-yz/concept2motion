/* Calculus and function blocks. Analytic functions are data, never eval strings. */
(function (global) {
  const V = global.VisualBook,
    P = V.palette;
  const finite = (v) => {
    if (!Number.isFinite(v)) throw Error("Function value must be finite");
    return v;
  };
  function scalar(spec = { kind: "polynomial", coefficients: [0, 0, 1] }) {
    let f,
      df,
      primitive = null,
      convention = null;
    const sigmoid = (x) =>
      x >= 0 ? 1 / (1 + Math.exp(-x)) : Math.exp(x) / (1 + Math.exp(x));
    switch (spec.kind) {
      case "polynomial": {
        const c = spec.coefficients ?? [0, 0, 1];
        if (
          !Array.isArray(c) ||
          !c.length ||
          c.length > 12 ||
          !c.every(Number.isFinite)
        )
          throw Error(
            "Polynomial needs 1..12 finite coefficients in ascending power order",
          );
        const evaluate = (coeff, x) =>
          coeff.reduceRight((a, b) => a * x + b, 0);
        f = (x) => evaluate(c, x);
        df = (x) =>
          evaluate(
            c.slice(1).map((v, i) => v * (i + 1)),
            x,
          );
        primitive = (x) => evaluate([0, ...c.map((v, i) => v / (i + 1))], x);
        break;
      }
      case "sin":
        f = Math.sin;
        df = Math.cos;
        primitive = (x) => -Math.cos(x);
        break;
      case "cos":
        f = Math.cos;
        df = (x) => -Math.sin(x);
        primitive = Math.sin;
        break;
      case "exp":
        f = Math.exp;
        df = Math.exp;
        primitive = Math.exp;
        break;
      case "log":
        f = (x) => {
          if (x <= 0) throw Error("Log input must be positive");
          return Math.log(x);
        };
        df = (x) => {
          f(x);
          return 1 / x;
        };
        primitive = (x) => {
          f(x);
          return x * Math.log(x) - x;
        };
        break;
      case "sigmoid":
        f = sigmoid;
        df = (x) => {
          const y = f(x);
          return y * (1 - y);
        };
        break;
      case "tanh":
        f = Math.tanh;
        df = (x) => 1 - Math.tanh(x) ** 2;
        break;
      case "relu":
        f = (x) => Math.max(0, x);
        df = (x) => (x > 0 ? 1 : 0);
        primitive = (x) => (x > 0 ? (x * x) / 2 : 0);
        convention =
          "Derivative at zero is undefined; displayed 0 is a chosen subgradient";
        break;
      case "gaussian": {
        const mean = finite(spec.mean ?? 0),
          sigma = finite(spec.sigma ?? 1);
        if (sigma <= 0) throw Error("Gaussian sigma must be positive");
        f = (x) =>
          Math.exp(-0.5 * ((x - mean) / sigma) ** 2) /
          (sigma * Math.sqrt(2 * Math.PI));
        df = (x) => (-(x - mean) / (sigma * sigma)) * f(x);
        break;
      }
      default:
        throw Error("Unknown scalar function " + spec.kind);
    }
    return {
      f: (x) => finite(f(finite(x))),
      df: (x) => finite(df(finite(x))),
      primitive: primitive ? (x) => finite(primitive(finite(x))) : null,
      convention,
    };
  }
  function samples(f, domain, count = 201) {
    return Array.from({ length: count }, (_, i) => {
      const x = V.mix(...domain, i / (count - 1));
      return [x, f(x)];
    });
  }
  function integral(spec, a, b, { count = 24, rule = "midpoint" } = {}) {
    finite(a);
    finite(b);
    if (b <= a) throw Error("Integral interval must increase");
    if (
      !Number.isInteger(count) ||
      count < 1 ||
      count > 10000 ||
      !["left", "right", "midpoint"].includes(rule)
    )
      throw Error("Invalid Riemann sum");
    const functionValue = scalar(spec),
      dx = (b - a) / count,
      offset = { left: 0, right: 1, midpoint: 0.5 }[rule];
    const bins = Array.from({ length: count }, (_, i) => {
      const x = a + i * dx,
        sample = x + offset * dx,
        value = functionValue.f(sample);
      return { x, sample, width: dx, value, area: value * dx };
    });
    return {
      bins,
      sum: bins.reduce((s, b) => s + b.area, 0),
      exact: functionValue.primitive
        ? functionValue.primitive(b) - functionValue.primitive(a)
        : null,
      a,
      b,
      count,
      rule,
    };
  }
  function drawFunction(
    board,
    {
      function: spec = { kind: "polynomial", coefficients: [0, 0, 1] },
      xDomain = [-2, 2],
      yDomain = [-1, 4],
      x = 0,
      derivative = false,
      title = null,
      stateKey = null,
    } = {},
    context = {},
  ) {
    const model = scalar(spec),
      f = V.plotFrame(board, "axes", { xDomain, yDomain, title });
    board.curve("function", f, samples(model.f, xDomain), { color: P.blue });
    if (derivative)
      board.curve("derivative", f, samples(model.df, xDomain), {
        color: P.orange,
        width: 2,
      });
    const y = model.f(x),
      slope = model.df(x);
    board.line("guide-x", f.x(x), f.y(y), f.x(x), f.y(0), P.faint, 1.5);
    board.circle("point", f.x(x), f.y(y), 5, P.blue);
    if (stateKey)
      board.handle("point", f, [x, y], {
        color: P.blue,
        axis: "x",
        label: "x",
        onChange: (p) => context.controls.setState(stateKey, p[0]),
        constrain: (p) => [p[0], model.f(p[0])],
      });
    return {
      function: spec,
      x,
      value: y,
      derivative: slope,
      convention: model.convention,
    };
  }
  function drawDerivative(
    board,
    {
      function: spec = { kind: "polynomial", coefficients: [0, 0, 1] },
      x = 1,
      h = 1,
      xDomain = [-2, 3],
      yDomain = [-1, 9],
      title = null,
      stateKey = null,
    } = {},
    context = {},
  ) {
    finite(x);
    finite(h);
    const model = scalar(spec),
      y = model.f(x),
      next = [x + h, model.f(x + h)],
      slope = h === 0 ? model.df(x) : (next[1] - y) / h,
      f = V.plotFrame(board, "axes", { xDomain, yDomain, title });
    board.curve("function", f, samples(model.f, xDomain), { color: P.blue });
    board.curve(
      "tangent",
      f,
      xDomain.map((v) => [v, y + model.df(x) * (v - x)]),
      { color: P.muted, width: 1.6, opacity: 0.6 },
    );
    board.curve(
      "secant",
      f,
      xDomain.map((v) => [v, y + slope * (v - x)]),
      { color: P.orange, width: 2.5 },
    );
    board.circle("first", f.x(x), f.y(y), 5, P.blue);
    board.circle("next", f.x(next[0]), f.y(next[1]), 5, P.orange);
    board.mark("step", "path", {
      d: `M${f.x(x)},${f.y(y)}L${f.x(next[0])},${f.y(y)}L${f.x(next[0])},${f.y(next[1])}`,
      fill: "none",
      stroke: P.orange,
      "stroke-width": 1.2,
      "stroke-dasharray": "4 4",
      "clip-path": f.clip,
    });
    if (stateKey)
      board.handle("first", f, [x, y], {
        color: P.blue,
        axis: "x",
        onChange: (p) => context.controls.setState(stateKey, p[0]),
        constrain: (p) => [p[0], model.f(p[0])],
      });
    return {
      function: spec,
      x,
      h,
      value: y,
      next,
      secantSlope: slope,
      derivative: model.df(x),
      convention:
        h === 0
          ? "h=0 displays the analytic derivative, not 0/0"
          : model.convention,
    };
  }
  function drawIntegral(
    board,
    {
      function: spec = { kind: "polynomial", coefficients: [0, 0, 1] },
      a = 0,
      b = 2,
      count = 12,
      rule = "midpoint",
      progress = 1,
      xDomain = [-0.2, 2.2],
      yDomain = [-0.2, 4.5],
      title = null,
    } = {},
  ) {
    if (count > 48)
      throw Error("Integral drawing supports at most 48 rectangles");
    const facts = integral(spec, a, b, { count, rule }),
      model = scalar(spec),
      f = V.plotFrame(board, "axes", { xDomain, yDomain, title }),
      p = V.clamp(progress, 0, 1);
    facts.bins.forEach((bin, i) => {
      const shown = V.clamp(p * count - i, 0, 1),
        top = Math.min(f.y(bin.value), f.y(0));
      board.rect(
        "bin-" + i,
        f.x(bin.x),
        top,
        (f.x(bin.x + bin.width) - f.x(bin.x)) * shown,
        Math.abs(f.y(bin.value) - f.y(0)),
        P.blue,
        {
          opacity: 0.16,
          rx: 0,
          stroke: P.blue,
          "stroke-width": 0.7,
          "clip-path": f.clip,
        },
      );
    });
    board.curve("function", f, samples(model.f, xDomain), {
      color: P.blue,
      width: 2.5,
    });
    return {
      ...facts,
      visibleArea: facts.bins.reduce(
        (s, b, i) => s + b.area * V.clamp(p * count - i, 0, 1),
        0,
      ),
      constructionProgress: p,
    };
  }
  function drawCircle(board, { angle = Math.PI / 3, title = null } = {}) {
    finite(angle);
    const f = V.plotFrame(board, "axes", {
        title,
        xDomain: [-1.4, 1.4],
        yDomain: [-1.4, 1.4],
        equalUnits: true,
      }),
      x = Math.cos(angle),
      y = Math.sin(angle);
    board.curve(
      "circle",
      f,
      Array.from({ length: 121 }, (_, i) => {
        const a = (i / 120) * Math.PI * 2;
        return [Math.cos(a), Math.sin(a)];
      }),
      { color: P.faint, width: 2 },
    );
    board.vector("radius", f, [0, 0], [x, y], { color: P.blue });
    board.line("cosine", f.x(0), f.y(0), f.x(x), f.y(0), P.orange, 3);
    board.line("sine", f.x(x), f.y(0), f.x(x), f.y(y), P.green, 3);
    board.circle("point", f.x(x), f.y(y), 5, P.blue);
    const a = Math.min(Math.abs(angle), Math.PI * 2),
      sign = Math.sign(angle) || 1;
    board.curve(
      "angle",
      f,
      Array.from({ length: 40 }, (_, i) => {
        const v = (sign * a * i) / 39;
        return [0.22 * Math.cos(v), 0.22 * Math.sin(v)];
      }),
      { color: P.muted, width: 1.5 },
    );
    return { angle, cos: x, sin: y, norm: x * x + y * y };
  }
  V.scalarFunction = scalar;
  V.riemannSum = integral;
  Object.assign(V.components, {
    "function-plot": drawFunction,
    derivative: drawDerivative,
    integral: drawIntegral,
    "unit-circle": drawCircle,
  });
})(window);
