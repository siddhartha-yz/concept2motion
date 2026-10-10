/* Explicit small-data least squares by column-pivoted Householder QR. */
(function (global) {
  const finite = (v) => {
    if (!Number.isFinite(v))
      throw Error("Polynomial arithmetic overflow; reduce data scale");
    return v;
  };
  function qrSolve(input, target) {
    const A = input.map((r) => [...r]),
      b = [...target],
      m = A.length,
      n = A[0].length,
      permutation = Array.from({ length: n }, (_, i) => i);
    let largest = 0;
    const diagonal = [];
    for (let k = 0; k < n; k++) {
      let pivot = k,
        best = -1;
      for (let j = k; j < n; j++) {
        const norm = Math.hypot(...A.slice(k).map((r) => r[j]));
        if (norm > best) {
          best = norm;
          pivot = j;
        }
      }
      if (k === 0) largest = best;
      if (
        !Number.isFinite(best) ||
        best <= largest * Number.EPSILON * Math.max(m, n) * 32
      )
        throw Error(
          "Polynomial basis lacks reliable full column rank; lower degree, change samples or use positive regularization",
        );
      if (pivot !== k) {
        for (const row of A) [row[k], row[pivot]] = [row[pivot], row[k]];
        [permutation[k], permutation[pivot]] = [
          permutation[pivot],
          permutation[k],
        ];
      }
      const sign = A[k][k] < 0 ? -1 : 1,
        v = A.slice(k).map((r) => r[k] / best);
      v[0] += sign;
      const norm = Math.hypot(...v);
      for (let i = 0; i < v.length; i++) v[i] /= norm;
      for (let j = k; j < n; j++) {
        const dot = finite(v.reduce((s, t, i) => s + t * A[k + i][j], 0));
        for (let i = 0; i < v.length; i++)
          A[k + i][j] = finite(A[k + i][j] - 2 * v[i] * dot);
      }
      const dot = finite(v.reduce((s, t, i) => s + t * b[k + i], 0));
      for (let i = 0; i < v.length; i++)
        b[k + i] = finite(b[k + i] - 2 * v[i] * dot);
      A[k][k] = -sign * best;
      for (let i = k + 1; i < m; i++) A[i][k] = 0;
      diagonal.push(Math.abs(A[k][k]));
    }
    const solution = Array(n).fill(0);
    for (let i = n - 1; i >= 0; i--)
      solution[i] = finite(
        (b[i] -
          A[i]
            .slice(i + 1)
            .reduce((s, v, j) => s + v * solution[i + 1 + j], 0)) /
          A[i][i],
      );
    const coefficients = Array(n);
    solution.forEach((v, i) => (coefficients[permutation[i]] = v));
    return {
      coefficients,
      rank: n,
      diagonalRatio: Math.max(...diagonal) / Math.min(...diagonal),
    };
  }
  function polynomialFit({
    data,
    degree = 3,
    lambda = 0,
    center = 0,
    scale = 1,
    xDomain = null,
    samples = 201,
  } = {}) {
    if (
      !Array.isArray(data) ||
      data.length < 2 ||
      data.length > 40 ||
      data.some(
        (p) => !Array.isArray(p) || p.length !== 2 || !p.every(Number.isFinite),
      )
    )
      throw Error("Polynomial fit needs 2..40 finite [x,y] observations");
    if (!Number.isInteger(degree) || degree < 0 || degree > 12)
      throw Error("Polynomial degree must be integer 0..12");
    if (
      ![lambda, center, scale].every(Number.isFinite) ||
      lambda < 0 ||
      scale <= 0
    )
      throw Error(
        "Finite nonnegative regularization and positive basis scale required",
      );
    if (!Number.isInteger(samples) || samples < 21 || samples > 401)
      throw Error("Curve samples must be integer 21..401");
    const basis = (x) =>
        Array.from({ length: degree + 1 }, (_, j) =>
          finite(((x - center) / scale) ** j),
        ),
      X = data.map((p) => basis(p[0])),
      y = data.map((p) => p[1]),
      A = X.map((r) => [...r]),
      b = [...y],
      penalty = Math.sqrt(data.length * lambda);
    if (lambda > 0)
      for (let i = 1; i <= degree; i++) {
        A.push(
          Array.from({ length: degree + 1 }, (_, j) => (j === i ? penalty : 0)),
        );
        b.push(0);
      }
    if (A.length < degree + 1)
      throw Error(
        "Unregularized polynomial fit is underdetermined; reduce degree or use positive regularization",
      );
    const solved = qrSolve(A, b),
      c = solved.coefficients,
      predict = (x) => finite(basis(x).reduce((s, v, j) => s + v * c[j], 0)),
      predictions = data.map((p) => predict(p[0])),
      residuals = predictions.map((v, i) => finite(v - y[i])),
      trainingMSE = finite(
        residuals.reduce((s, v) => s + (v * v) / data.length, 0),
      ),
      regularization = finite(
        lambda * c.slice(1).reduce((s, v) => s + (v * v) / 2, 0),
      );
    const domain = xDomain ?? [
      Math.min(...data.map((p) => p[0])),
      Math.max(...data.map((p) => p[0])),
    ];
    if (
      !Array.isArray(domain) ||
      domain.length !== 2 ||
      !domain.every(Number.isFinite) ||
      domain[0] >= domain[1] ||
      !Number.isFinite(domain[1] - domain[0])
    )
      throw Error("Increasing finite polynomial curve domain required");
    const curve = Array.from({ length: samples }, (_, i) => {
        const x = domain[0] + ((domain[1] - domain[0]) * i) / (samples - 1);
        return [x, predict(x)];
      }),
      gradient = c.map((v, j) =>
        finite(
          residuals.reduce((s, r, i) => s + (r * X[i][j]) / data.length, 0) +
            (j ? lambda * v : 0),
        ),
      );
    return {
      data,
      degree,
      lambda,
      center,
      scale,
      coefficients: c,
      predictions,
      residuals,
      trainingMSE,
      regularization,
      objective: trainingMSE / 2 + regularization,
      gradient,
      curve,
      xDomain: [...domain],
      rank: solved.rank,
      diagonalRatio: solved.diagonalRatio,
      convention:
        "Direct QR least-squares fit in powers of (x-center)/scale; not SGD. Objective is mean half squared error plus lambda/2 times squared non-intercept basis coefficients. QR diagonal ratio is a diagnostic, not the matrix condition number. Training error alone does not establish generalization.",
    };
  }
  const api = { polynomialFit };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  global.VisualBookPolynomial = api;
})(typeof window !== "undefined" ? window : globalThis);
