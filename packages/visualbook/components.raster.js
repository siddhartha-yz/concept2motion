/* Canvas produces sampled colours; SVG retains axes, labels and real shared handles. */
(function (global) {
  const V = global.VisualBook,
    P = V.palette,
    N = global.VisualBookSampling;
  function scalarMap(
    board,
    {
      grid,
      values,
      channel = 0,
      colorDomain,
      point = [0, 0],
      stateKey = null,
      title = "采样响应",
      colorMode = "diverging",
    } = {},
    context = {},
  ) {
    const selected = N.sampleIndex(grid, point),
      shape = global.VisualBookNeural.matrix(values, "Sampled responses");
    if (
      shape[0] !== grid.points.length ||
      !Number.isInteger(channel) ||
      channel < 0 ||
      channel >= shape[1]
    )
      throw Error(
        "One response row per grid point and a valid channel required",
      );
    if (
      !Array.isArray(colorDomain) ||
      colorDomain.length !== 2 ||
      !colorDomain.every(Number.isFinite) ||
      colorDomain[0] >= colorDomain[1] ||
      !Number.isFinite(colorDomain[1] - colorDomain[0])
    )
      throw Error("Explicit finite increasing colour domain required");
    if (
      !["diverging", "sequential"].includes(colorMode) ||
      (colorMode === "diverging" && !(colorDomain[0] < 0 && colorDomain[1] > 0))
    )
      throw Error("Diverging colour needs a negative and positive domain");
    if (
      values.some(
        (row) => row[channel] < colorDomain[0] || row[channel] > colorDomain[1],
      )
    )
      throw Error(
        "Colour domain must include every displayed sample; no silent clipping",
      );
    if (board.width < 260 || board.height < 240)
      throw Error("Scalar map needs 260px width and 240px height");
    if (typeof title !== "string" || !title || title.length > 24)
      throw Error("Use a short map title");
    const color = (value) =>
      colorMode === "sequential"
        ? global.d3.interpolateRgb(
            P.paper,
            P.blue,
          )((value - colorDomain[0]) / (colorDomain[1] - colorDomain[0]))
        : value < 0
          ? global.d3.interpolateRgb(P.paper, P.orange)(value / colorDomain[0])
          : global.d3.interpolateRgb(P.paper, P.blue)(value / colorDomain[1]);
    const n = grid.shape[0],
      canvas = document.createElement("canvas");
    canvas.width = n;
    canvas.height = n;
    const ctx = canvas.getContext("2d");
    values.forEach((row, i) => {
      ctx.fillStyle = color(row[channel]);
      ctx.fillRect(i % n, Math.floor(i / n), 1, 1);
    });
    const f = board.axes("axes", {
      xDomain: grid.xDomain,
      yDomain: grid.yDomain,
      equalUnits: true,
      grid: false,
      xLabel: "",
      yLabel: "",
      box: [42, 66, board.width - 18, board.height - 36],
    });
    const raster = board.mark("raster", "image", {
      x: f.left,
      y: f.top,
      width: f.right - f.left,
      height: f.bottom - f.top,
      href: canvas.toDataURL("image/png"),
      preserveAspectRatio: "none",
      style: "image-rendering:pixelated;pointer-events:none",
    });
    raster.parentElement.prepend(raster);
    board.label("title", title, 16, 20, {
      size: 14,
      maxWidth: board.width - 32,
    });
    board.text(
      "value",
      "采样值 " + V.formatNumber(values[selected.index][channel]),
      16,
      45,
      { size: 12 },
    );
    const key = document.createElement("canvas");
    key.width = 96;
    key.height = 1;
    const keyCtx = key.getContext("2d");
    for (let i = 0; i < 96; i++) {
      keyCtx.fillStyle = color(
        colorDomain[0] + ((colorDomain[1] - colorDomain[0]) * i) / 95,
      );
      keyCtx.fillRect(i, 0, 1, 1);
    }
    const keyX = board.width - 118;
    board.mark("colour-key", "image", {
      x: keyX,
      y: 41,
      width: 96,
      height: 5,
      href: key.toDataURL("image/png"),
      preserveAspectRatio: "none",
    });
    for (const [i, value] of colorDomain.entries()) {
      const label = V.fitNumber(value, { maxWidth: 42, size: 12, minSize: 12 });
      board.text("colour-number-" + i, label.text, keyX + i * 96, 35, {
        size: 12,
        anchor: i ? "end" : "start",
      });
    }
    if (stateKey)
      board.handle("probe", f, point, {
        ariaLabel: "选择响应图中的输入位置",
        step:
          Math.min(
            grid.xDomain[1] - grid.xDomain[0],
            grid.yDomain[1] - grid.yDomain[0],
          ) / n,
        bounds: { x: grid.xDomain, y: grid.yDomain },
        color: P.ink,
        onChange: (p) => context.controls.setState(stateKey, p),
      });
    else board.circle("probe", f.x(point[0]), f.y(point[1]), 4, P.ink);
    return {
      ...selected,
      value: values[selected.index][channel],
      channel,
      shape: grid.shape,
      colorDomain: [...colorDomain],
      colorMode,
      convention:
        "Colours and readout are values sampled at the enclosing grid cell centre; pointer coordinates may lie between samples. Supplied responses do not establish training or probability calibration.",
    };
  }
  global.VisualBookScalarMap = scalarMap;
  V.components = Object.assign(V.components, { "scalar-map": scalarMap });
})(window);
