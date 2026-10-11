/* Explicit optimizer recurrence over supplied gradients or a bounded analytic field. */
(function (global) {
  const F =
    typeof module !== "undefined" && module.exports
      ? require("./fields.cjs")
      : global.VisualBookFields;
  const vector = (v) =>
    Array.isArray(v) &&
    v.length >= 1 &&
    v.length <= 8 &&
    v.every(Number.isFinite);
  const finite = (v) => {
    if (!Number.isFinite(v))
      throw Error("Optimizer arithmetic diverged; reduce scale or steps");
    return v;
  };
  function optimizerTrace({
    kind = "adam",
    start = [1, 1],
    field = null,
    gradients = null,
    steps = 20,
    selectedStep = null,
    eta = 0.1,
    rho = 0.9,
    beta1 = 0.9,
    beta2 = 0.999,
    epsilon = 1e-8,
  } = {}) {
    if (
      !["sgd", "momentum", "adagrad", "rmsprop", "adam", "yogi"].includes(kind)
    )
      throw Error("Unknown optimizer");
    if (
      !vector(start) ||
      ![eta, rho, beta1, beta2, epsilon].every(Number.isFinite) ||
      eta < 0 ||
      epsilon <= 0 ||
      [rho, beta1, beta2].some((v) => v < 0 || v >= 1)
    )
      throw Error(
        "Finite step size, positive epsilon and decay factors in [0,1) required",
      );
    if ((field === null) === (gradients === null))
      throw Error(
        "Supply an analytic field OR explicit gradients, exactly once",
      );
    if (field !== null && start.length !== 2)
      throw Error("Analytic field optimizer needs two coordinates");
    if (gradients !== null) {
      if (
        !Array.isArray(gradients) ||
        !gradients.length ||
        gradients.length > 100 ||
        gradients.some((g) => !vector(g) || g.length !== start.length)
      )
        throw Error(
          "One to one hundred finite matching gradient vectors required",
        );
      steps = gradients.length;
    }
    if (!Number.isInteger(steps) || steps < 1 || steps > 100)
      throw Error("One to one hundred optimizer updates required");
    const pick = selectedStep ?? steps;
    if (!Number.isInteger(pick) || pick < 0 || pick > steps)
      throw Error("Selected step must index a real completed state");
    let point = [...start],
      first = start.map(() => 0),
      second = start.map(() => 0);
    const initialValue =
      field === null ? null : F.scalarField(field, point).value;
    const records = [
      {
        step: 0,
        before: [...point],
        point: [...point],
        gradient: null,
        squareGradient: null,
        correctionFirst: null,
        correctionSecond: null,
        firstMoment: [...first],
        squareMoment: [...second],
        correctedFirst: null,
        correctedSecond: null,
        update: start.map(() => 0),
        value: initialValue,
      },
    ];
    const usesCorrection = kind === "adam" || kind === "yogi";
    for (let t = 1; t <= steps; t++) {
      const before = [...point],
        g =
          field === null
            ? [...gradients[t - 1]]
            : F.scalarField(field, before).gradient;
      let correctedFirst = null,
        correctedSecond = null;
      if (kind === "momentum")
        first = first.map((m, i) => finite(rho * m + g[i]));
      if (kind === "adagrad")
        second = second.map((v, i) => finite(v + g[i] * g[i]));
      if (kind === "rmsprop")
        second = second.map((v, i) =>
          finite(rho * v + (1 - rho) * g[i] * g[i]),
        );
      if (usesCorrection) {
        first = first.map((m, i) => finite(beta1 * m + (1 - beta1) * g[i]));
        second = second.map((v, i) =>
          finite(
            kind === "yogi"
              ? v + (1 - beta2) * Math.sign(g[i] * g[i] - v) * g[i] * g[i]
              : beta2 * v + (1 - beta2) * g[i] * g[i],
          ),
        );
        correctedFirst = first.map((v) => finite(v / (1 - beta1 ** t)));
        correctedSecond = second.map((v) => finite(v / (1 - beta2 ** t)));
      }
      const update = g.map((v, i) =>
        finite(
          eta *
            (kind === "sgd"
              ? v
              : kind === "momentum"
                ? first[i]
                : usesCorrection
                  ? correctedFirst[i] /
                    (Math.sqrt(correctedSecond[i]) + epsilon)
                  : v / (Math.sqrt(second[i]) + epsilon)),
        ),
      );
      point = point.map((v, i) => finite(v - update[i]));
      const value = field === null ? null : F.scalarField(field, point).value;
      records.push({
        step: t,
        before,
        point: [...point],
        gradient: g,
        squareGradient: g.map((v) => finite(v * v)),
        correctionFirst: usesCorrection ? 1 - beta1 ** t : null,
        correctionSecond: usesCorrection ? 1 - beta2 ** t : null,
        firstMoment: [...first],
        squareMoment: [...second],
        correctedFirst,
        correctedSecond,
        update,
        value,
      });
    }
    for (const record of records) {
      record.firstMomentPoints = record.firstMoment.map((v) => [
        record.step,
        v,
      ]);
      record.squareMomentPoints = record.squareMoment.map((v) => [
        record.step,
        v,
      ]);
    }
    const firstMomentCurves = start.map((_, i) =>
      records.map((r) => r.firstMomentPoints[i]),
    );
    const squareMomentCurves = start.map((_, i) =>
      records.map((r) => r.squareMomentPoints[i]),
    );
    const selected = records[pick],
      points = records.map((r) => r.point),
      lossCurve = field === null ? null : records.map((r) => [r.step, r.value]);
    return {
      kind,
      eta,
      rho,
      beta1,
      beta2,
      epsilon,
      steps,
      selectedStep: pick,
      field,
      start: [...start],
      points,
      visiblePoints: points.slice(0, pick + 1),
      lossCurve,
      firstMomentCurves,
      squareMomentCurves,
      records,
      selected,
      convention:
        "Actual discrete updates of supplied gradients or the analytic field. Adaptive denominators use sqrt(second moment)+epsilon. Momentum uses rho*v+g without (1-rho) scaling. Adam applies bias correction at integer t>=1; Yogi uses s+(1-beta2)*sign(g²-s)*g² with the D2L PyTorch correction/denominator convention; dividing its non-EWMA state by 1-beta2^t is an algorithmic convention, not an unbiased second-moment claim; step zero has no applied gradient. Gradient belongs to before, objective to point after the update. Hand-specified conditions, not neural-network training or a guarantee of convergence.",
    };
  }
  const api = { optimizerTrace };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  global.VisualBookOptimizers = api;
})(typeof window !== "undefined" ? window : globalThis);
