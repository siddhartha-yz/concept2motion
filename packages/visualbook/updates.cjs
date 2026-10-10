/* Explicit gradient step over a small tensor; no optimizer state or training loop. */
(function (global) {
  function gradientStep({ values, gradient, eta = 0.1 } = {}) {
    const shape = (x) =>
      Array.isArray(x) &&
      x.length > 0 &&
      x.length <= 8 &&
      Array.isArray(x[0]) &&
      x[0].length > 0 &&
      x[0].length <= 8 &&
      x.every(
        (row) =>
          Array.isArray(row) &&
          row.length === x[0].length &&
          row.every(Number.isFinite),
      );
    if (
      !shape(values) ||
      !shape(gradient) ||
      values.length !== gradient.length ||
      values[0].length !== gradient[0].length ||
      !Number.isFinite(eta) ||
      eta < 0
    )
      throw Error(
        "Matching finite tensors up to8x8 and nonnegative finite learning rate required",
      );
    const update = gradient.map((row) => row.map((v) => eta * v)),
      after = values.map((row, r) => row.map((v, c) => v - update[r][c]));
    if ([...update.flat(), ...after.flat()].some((v) => !Number.isFinite(v)))
      throw Error("Gradient step overflow; reduce scale");
    return {
      before: values.map((row) => [...row]),
      gradient: gradient.map((row) => [...row]),
      eta,
      update,
      after,
      shape: [values.length, values[0].length],
      convention:
        "One explicit values-eta*gradient update on supplied data. No claim that this gradient belongs to a loss, that a network was trained, or that the step improves the objective.",
    };
  }
  const api = { gradientStep };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  global.VisualBookUpdates = api;
})(typeof window !== "undefined" ? window : globalThis);
