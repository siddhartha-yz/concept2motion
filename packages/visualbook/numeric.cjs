/* Shared probability and learning numerics. No DOM, model calls or rendering. */
(function (global) {
  const finite = (value) => {
    if (!Number.isFinite(value)) throw Error("Finite numeric input required");
    return value;
  };
  const probability = (value) => {
    finite(value);
    if (value < 0 || value > 1) throw Error("Probability must be in [0,1]");
    return value;
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
  const V = { dot: (a, b) => a.reduce((sum, v, i) => sum + v * b[i], 0) };
  function normalCDF(x) {
    finite(x);
    // Abramowitz-Stegun 7.1.26; absolute erf error <= 1.5e-7.
    const z = Math.abs(x) / Math.SQRT2,
      t = 1 / (1 + 0.3275911 * z);
    const erf =
      1 -
      ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) *
        t +
        0.254829592) *
        t *
        Math.exp(-z * z);
    return 0.5 * (1 + Math.sign(x) * erf);
  }
  function binomial(n, p) {
    if (!Number.isInteger(n) || n < 0 || n > 100)
      throw Error("Binomial n must be an integer 0..100");
    probability(p);
    let choose = 1;
    const probabilities = Array.from({ length: n + 1 }, (_, k) => {
      if (k) choose *= (n - k + 1) / k;
      return choose * p ** k * (1 - p) ** (n - k);
    });
    return {
      n,
      p,
      probabilities,
      mean: n * p,
      variance: n * p * (1 - p),
      sum: probabilities.reduce((a, b) => a + b, 0),
    };
  }
  function histogram(samples, domain, count = 12) {
    if (
      !Array.isArray(samples) ||
      !samples.length ||
      samples.length > 10000 ||
      !samples.every(Number.isFinite)
    )
      throw Error("Histogram needs 1..10000 finite samples");
    if (
      !Array.isArray(domain) ||
      domain.length !== 2 ||
      !domain.every(Number.isFinite) ||
      domain[1] <= domain[0]
    )
      throw Error("Increasing finite histogram domain required");
    if (!Number.isInteger(count) || count < 1 || count > 80)
      throw Error("Histogram bin count must be 1..80");
    const width = (domain[1] - domain[0]) / count,
      bins = Array(count).fill(0);
    finite(width);
    if (width <= 0 || !Number.isFinite(1 / width))
      throw Error("Histogram domain scale is too extreme");
    let outside = 0;
    for (const x of samples) {
      if (x < domain[0] || x > domain[1]) {
        outside++;
        continue;
      }
      bins[Math.min(count - 1, Math.floor((x - domain[0]) / width))]++;
    }
    return {
      bins: bins.map((n, i) => ({
        left: domain[0] + i * width,
        right: domain[0] + (i + 1) * width,
        count: n,
        probability: n / samples.length,
        density: n / samples.length / width,
      })),
      outside,
      total: samples.length,
      inRange: samples.length - outside,
    };
  }
  function bayes(prior, sensitivity, falsePositive) {
    [prior, sensitivity, falsePositive].forEach(probability);
    const truePositive = prior * sensitivity,
      falsePositiveMass = (1 - prior) * falsePositive;
    const evidence = truePositive + falsePositiveMass;
    return {
      prior,
      sensitivity,
      falsePositive,
      truePositive,
      falsePositiveMass,
      evidence,
      posterior: evidence === 0 ? null : truePositive / evidence,
      negative: 1 - evidence,
      convention:
        "Exact area proportions; zero-probability evidence has no defined conditional probability",
    };
  }
  function regression(data, weight = 1, bias = 0, lambda = 0) {
    points(data);
    [weight, bias, lambda].forEach(finite);
    if (lambda < 0) throw Error("Regularization must be nonnegative");
    const predictions = data.map(([x]) => weight * x + bias),
      residuals = data.map(([, y], i) => predictions[i] - y);
    const dataLoss =
        residuals.reduce((a, r) => a + r * r, 0) / (2 * data.length),
      penalty = (lambda * weight * weight) / 2;
    const weightGradient =
      data.reduce((sum, [x], i) => sum + residuals[i] * x, 0) / data.length +
      lambda * weight;
    const biasGradient = residuals.reduce((a, b) => a + b, 0) / data.length;
    [
      ...predictions,
      ...residuals,
      dataLoss,
      penalty,
      weightGradient,
      biasGradient,
    ].forEach(finite);
    return {
      data,
      weight,
      bias,
      lambda,
      predictions,
      residuals,
      dataLoss,
      penalty,
      loss: dataLoss + penalty,
      weightGradient,
      biasGradient,
      convention:
        "Half mean squared error plus lambda*w²/2; bias is not regularized",
    };
  }
  function optimum(data, lambda = 0) {
    points(data);
    finite(lambda);
    if (lambda < 0) throw Error("Regularization must be nonnegative");
    const n = data.length,
      mx = data.reduce((s, p) => s + p[0], 0) / n,
      my = data.reduce((s, p) => s + p[1], 0) / n;
    const variance = data.reduce((s, p) => s + (p[0] - mx) ** 2, 0) / n,
      covariance = data.reduce((s, p) => s + (p[0] - mx) * (p[1] - my), 0) / n;
    const weight =
        variance + lambda === 0 ? 0 : covariance / (variance + lambda),
      bias = my - weight * mx;
    [mx, my, variance, covariance, weight, bias].forEach(finite);
    return {
      weight,
      bias,
      meanX: mx,
      meanY: my,
      variance,
      covariance,
      identifiable: variance + lambda > 0,
    };
  }
  function pca2d(data) {
    points(data);
    const n = data.length,
      mean = [0, 1].map((j) => data.reduce((s, p) => s + p[j], 0) / n);
    const centered = data.map((p) => p.map((v, j) => v - mean[j]));
    const a = centered.reduce((s, p) => s + p[0] * p[0], 0) / n,
      b = centered.reduce((s, p) => s + p[0] * p[1], 0) / n,
      d = centered.reduce((s, p) => s + p[1] * p[1], 0) / n;
    [...mean, a, b, d].forEach(finite);
    const delta = Math.hypot(a - d, 2 * b),
      values = [(a + d + delta) / 2, Math.max(0, (a + d - delta) / 2)],
      angle = 0.5 * Math.atan2(2 * b, a - d),
      axis = [Math.cos(angle), Math.sin(angle)];
    values.forEach(finite);
    const projections = centered.map((p) => V.dot(p, axis)),
      reconstructed = projections.map((t) => [
        mean[0] + t * axis[0],
        mean[1] + t * axis[1],
      ]);
    const total = values[0] + values[1];
    return {
      mean,
      covariance: [
        [a, b],
        [b, d],
      ],
      eigenvalues: values,
      axis,
      projections,
      reconstructed,
      explained: total === 0 ? null : values[0] / total,
      degenerate: delta < 1e-12,
      convention:
        "Population covariance divides by N; repeated eigenvalues do not identify a unique principal direction",
    };
  }
  const numeric = {
    normalCDF,
    binomial,
    histogram,
    bayes,
    regression,
    regressionOptimum: optimum,
    pca2d,
  };
  if (typeof module !== "undefined" && module.exports) module.exports = numeric;
  global.VisualBookNumeric = numeric;
})(typeof window !== "undefined" ? window : globalThis);
