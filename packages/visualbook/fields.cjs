/* Analytic two-dimensional fields. No DOM, training or guessed gradients. */
(function (global) {
  const finite = (v) => {
    if (!Number.isFinite(v)) throw Error("Finite field input required");
    return v;
  };
  const pair = (v) => {
    if (!Array.isArray(v) || v.length !== 2 || !v.every(Number.isFinite))
      throw Error("Finite two-dimensional field point required");
    return v;
  };
  function scalarField(spec, point) {
    if (!spec || typeof spec !== "object" || Array.isArray(spec))
      throw Error("Field specification required");
    pair(point);
    let value, gradient, hessian, convention;
    if (spec.type === "quadratic") {
      if (
        Object.keys(spec).some(
          (k) => !["type", "matrix", "center", "constant"].includes(k),
        )
      )
        throw Error("Unknown quadratic field option");
      const H = spec.matrix ?? [
          [2, 0],
          [0, 2],
        ],
        center = spec.center ?? [0, 0],
        constant = spec.constant ?? 0;
      pair(center);
      finite(constant);
      if (
        !Array.isArray(H) ||
        H.length !== 2 ||
        H.some(
          (r) =>
            !Array.isArray(r) || r.length !== 2 || !r.every(Number.isFinite),
        ) ||
        H[0][1] !== H[1][0]
      )
        throw Error("Quadratic matrix must be finite symmetric 2 by 2");
      const d = point.map((v, i) => v - center[i]);
      gradient = H.map((r) => r[0] * d[0] + r[1] * d[1]);
      value = 0.5 * (d[0] * gradient[0] + d[1] * gradient[1]) + constant;
      hessian = H.map((r) => [...r]);
      convention =
        "f(p)=0.5*(p-center)^T H (p-center)+constant. H is symmetric, not necessarily positive definite. Analytic gradient; supplied coefficients, not training.";
    } else if (spec.type === "rosenbrock") {
      if (Object.keys(spec).some((k) => !["type", "a", "b"].includes(k)))
        throw Error("Unknown Rosenbrock field option");
      const a = spec.a ?? 1,
        b = spec.b ?? 100;
      finite(a);
      finite(b);
      if (b <= 0) throw Error("Rosenbrock b must be positive");
      const [x, y] = point,
        r = y - x * x;
      value = (a - x) ** 2 + b * r * r;
      gradient = [2 * (x - a) - 4 * b * x * r, 2 * b * r];
      hessian = [
        [2 - 4 * b * y + 12 * b * x * x, -4 * b * x],
        [-4 * b * x, 2 * b],
      ];
      convention =
        "f(x,y)=(a-x)^2+b*(y-x^2)^2, b>0. Analytic derivatives; a supplied test function, not a trained model.";
    } else throw Error("Field type is quadratic or rosenbrock");
    if (![value, ...gradient, ...hessian.flat()].every(Number.isFinite))
      throw Error("Field overflow; reduce input scale");
    return { spec, point: [...point], value, gradient, hessian, convention };
  }
  const api = { scalarField };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  global.VisualBookFields = api;
})(typeof window !== "undefined" ? window : globalThis);
