/* Deterministic cell-centre grids for independently supplied scalar responses. */
(function (global) {
  const domain = (d) => {
    if (
      !Array.isArray(d) ||
      d.length !== 2 ||
      !d.every(Number.isFinite) ||
      d[0] >= d[1] ||
      !Number.isFinite(d[1] - d[0])
    )
      throw Error("Increasing finite sampling domain required");
    return d;
  };
  function sampleGrid({
    xDomain = [-2, 2],
    yDomain = [-2, 2],
    resolution = 21,
    field = null,
  } = {}) {
    domain(xDomain);
    domain(yDomain);
    if (!Number.isInteger(resolution) || resolution < 5 || resolution > 31)
      throw Error("Sampling resolution must be integer 5..31");
    const points = [];
    for (let r = 0; r < resolution; r++)
      for (let c = 0; c < resolution; c++)
        points.push([
          xDomain[0] + ((xDomain[1] - xDomain[0]) * (c + 0.5)) / resolution,
          yDomain[1] - ((yDomain[1] - yDomain[0]) * (r + 0.5)) / resolution,
        ]);
    const F =
      typeof module !== "undefined" && module.exports
        ? require("./fields.cjs")
        : global.VisualBookFields;
    const values =
      field === null
        ? null
        : points.map((point) => [F.scalarField(field, point).value]);
    const grid = {
      points,
      shape: [resolution, resolution],
      xDomain: [...xDomain],
      yDomain: [...yDomain],
    };
    return {
      grid,
      points,
      values,
      field,
      shape: [resolution, resolution],
      xDomain: [...xDomain],
      yDomain: [...yDomain],
      convention:
        "Row-major cell centres; top row has largest y. Values are grid samples, not exact values between cells.",
    };
  }
  function sampleIndex(grid, point) {
    const { shape, xDomain, yDomain, points } = grid ?? {};
    domain(xDomain);
    domain(yDomain);
    if (!Array.isArray(shape) || shape.length !== 2 || shape[0] !== shape[1])
      throw Error("Square cell-centre sampling grid required");
    const expected = sampleGrid({ xDomain, yDomain, resolution: shape[0] });
    if (
      !Array.isArray(points) ||
      points.length !== expected.points.length ||
      points.some(
        (p, i) =>
          !Array.isArray(p) ||
          p.length !== 2 ||
          p.some((v, j) => v !== expected.points[i][j]),
      )
    )
      throw Error("Sampling coordinates do not match the grid");
    if (
      !Array.isArray(point) ||
      point.length !== 2 ||
      !point.every(Number.isFinite) ||
      point[0] < xDomain[0] ||
      point[0] > xDomain[1] ||
      point[1] < yDomain[0] ||
      point[1] > yDomain[1]
    )
      throw Error("Probe must stay inside sampling domain");
    const n = shape[0],
      column = Math.min(
        n - 1,
        Math.floor((n * (point[0] - xDomain[0])) / (xDomain[1] - xDomain[0])),
      ),
      row = Math.min(
        n - 1,
        Math.floor((n * (yDomain[1] - point[1])) / (yDomain[1] - yDomain[0])),
      ),
      index = row * n + column;
    return {
      row,
      column,
      index,
      sampledPoint: [...points[index]],
      probePoint: [...point],
    };
  }
  const api = { sampleGrid, sampleIndex };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  global.VisualBookSampling = api;
})(typeof window !== "undefined" ? window : globalThis);
