/* Sampled contours with exact analytic point readout. Shared state connects other views. */
(function (global) {
  const V = global.VisualBook,
    P = V.palette,
    N = global.VisualBookFields;
  function levelSet(
    board,
    {
      field,
      point = [1, 1],
      xDomain = [-3, 3],
      yDomain = [-3, 3],
      levels = [0.5, 1, 2, 4, 8],
      resolution = 61,
      direction = "gradient",
      arrowLength = 0.65,
      stateKey = null,
      title = null,
    } = {},
    context = {},
  ) {
    const facts = N.scalarField(field, point);
    if (
      !Array.isArray(levels) ||
      !levels.length ||
      levels.length > 12 ||
      !levels.every(Number.isFinite) ||
      levels.some((v, i) => i && v <= levels[i - 1])
    )
      throw Error(
        "Contour levels must be 1..12 strictly increasing finite values",
      );
    if (!Number.isInteger(resolution) || resolution < 21 || resolution > 101)
      throw Error("Contour grid resolution must be integer 21..101");
    if (!["gradient", "descent", "none"].includes(direction))
      throw Error("Contour arrow direction is gradient/descent/none");
    if (!Number.isFinite(arrowLength) || arrowLength < 0 || arrowLength > 2)
      throw Error("Direction arrow length must be 0..2 data units");
    for (const domain of [xDomain, yDomain])
      if (
        !Array.isArray(domain) ||
        domain.length !== 2 ||
        !domain.every(Number.isFinite) ||
        domain[0] >= domain[1]
      )
        throw Error("Increasing finite field domain required");
    if (
      point[0] < xDomain[0] ||
      point[0] > xDomain[1] ||
      point[1] < yDomain[0] ||
      point[1] > yDomain[1]
    )
      throw Error("Field point must stay inside contour domain");
    const f = V.plotFrame(board, "axes", {
      xDomain,
      yDomain,
      title,
      grid: false,
      equalUnits: true,
      footerHeight: 24,
    });
    const values = [],
      n = resolution;
    for (let j = 0; j < n; j++)
      for (let i = 0; i < n; i++) {
        const x = V.mix(xDomain[0], xDomain[1], (i + 0.5) / n),
          y = V.mix(yDomain[1], yDomain[0], (j + 0.5) / n);
        values.push(N.scalarField(field, [x, y]).value);
      }
    const contours = global.d3.contours().size([n, n]).thresholds(levels)(
      values,
    );
    const transform = global.d3.geoTransform({
      point(x, y) {
        this.stream.point(
          f.x(V.mix(xDomain[0], xDomain[1], x / n)),
          f.y(V.mix(yDomain[1], yDomain[0], y / n)),
        );
      },
    });
    const drawPath = global.d3.geoPath(transform),
      clip = board.clip("contours", {
        left: f.left + 1.5,
        right: f.right - 1.5,
        top: f.top + 1.5,
        bottom: f.bottom - 1.5,
      });
    contours.forEach((c, i) => {
      const d = drawPath(c);
      if (d)
        board
          .svgPath("level-" + i, d, {
            color: P.blue,
            width: 1,
            opacity: 0.45,
            fill: "none",
          })
          .setAttribute("clip-path", clip);
    });
    const norm = Math.hypot(...facts.gradient),
      sign = direction === "descent" ? -1 : 1;
    let actualLength = norm === 0 || direction === "none" ? 0 : arrowLength,
      unit = norm === 0 ? [0, 0] : facts.gradient.map((v) => (v / norm) * sign);
    // Shorten at a boundary rather than drawing an invisible off-domain direction.
    unit.forEach((v, i) => {
      const domain = i === 0 ? xDomain : yDomain;
      if (v > 0)
        actualLength = Math.min(actualLength, (domain[1] - point[i]) / v);
      else if (v < 0)
        actualLength = Math.min(actualLength, (domain[0] - point[i]) / v);
    });
    const endpoint = point.map((v, i) => v + unit[i] * actualLength);
    if (direction !== "none" && actualLength > 0)
      board.vector("direction", f, point, endpoint, { color: P.orange });
    if (stateKey)
      board.handle("point", f, point, {
        color: P.ink,
        ariaLabel: "选择函数上的位置",
        bounds: { x: xDomain, y: yDomain },
        onChange: (p) => context.controls.setState(stateKey, p),
      });
    else board.circle("point", f.x(point[0]), f.y(point[1]), 4, P.ink);
    board.text(
      "value",
      "f = " + V.formatNumber(facts.value),
      16,
      board.height - 12,
      { size: 13, color: P.ink },
    );
    board.text(
      "direction-label",
      direction === "none"
        ? "等高线：采样近似"
        : direction === "gradient"
          ? "箭头：梯度方向"
          : "箭头：负梯度方向",
      board.width - 16,
      board.height - 12,
      { size: 12, anchor: "end", color: P.muted },
    );
    return {
      ...facts,
      levels,
      resolution,
      direction,
      arrowEndpoint: endpoint,
      arrowLength: actualLength,
      gradientNorm: norm,
      contourConvention:
        "D3 contour interpolation of cell-center samples; contour geometry is approximate. Arrow direction is normalized in data coordinates and shortened at boundaries; arrow length is not gradient magnitude or an optimizer step.",
    };
  }
  V.components = Object.assign(V.components, { "level-set": levelSet });
  V.levelSet = levelSet;
})(window);
