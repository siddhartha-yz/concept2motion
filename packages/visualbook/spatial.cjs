/* Structural receptive fields and Gaussian distance weighting. No trained weights. */
(function (global) {
  const integer = (v, lo, hi, label) => {
    if (!Number.isSafeInteger(v) || v < lo || v > hi)
      throw Error(label + " outside integer limits");
    return v;
  };
  function receptiveField(inputLength, layers, { index = 0 } = {}) {
    integer(inputLength, 1, 64, "Input length");
    if (!Array.isArray(layers) || !layers.length || layers.length > 6)
      throw Error("1..6 local layers required");
    let previous = {
      length: inputLength,
      support: Array.from({ length: inputLength }, (_, i) => [i]),
      jump: 1,
      span: 1,
      center: 0,
    };
    const records = [];
    for (const [level, layer] of layers.entries()) {
      if (
        !layer ||
        typeof layer !== "object" ||
        Object.keys(layer).some(
          (k) =>
            !["kernel", "stride", "dilation", "padding", "label"].includes(k),
        )
      )
        throw Error("Unknown local-layer field");
      if (
        layer.label !== undefined &&
        (typeof layer.label !== "string" || layer.label.length > 80)
      )
        throw Error("Short string layer label required");
      const kernel = integer(layer.kernel, 1, 7, "Kernel"),
        stride = integer(layer.stride ?? 1, 1, 4, "Stride"),
        dilation = integer(layer.dilation ?? 1, 1, 4, "Dilation"),
        effectiveKernel = dilation * (kernel - 1) + 1;
      let padding = layer.padding ?? "valid";
      if (padding === "valid") padding = [0, 0];
      else if (padding === "same") {
        const out = Math.ceil(previous.length / stride),
          total = Math.max(
            0,
            (out - 1) * stride + effectiveKernel - previous.length,
          );
        padding = [Math.floor(total / 2), total - Math.floor(total / 2)];
      }
      if (!Array.isArray(padding) || padding.length !== 2)
        throw Error("Padding is valid, same or [left,right]");
      padding.forEach((p) => integer(p, 0, 24, "Padding"));
      const length =
        Math.floor(
          (previous.length + padding[0] + padding[1] - effectiveKernel) /
            stride,
        ) + 1;
      integer(length, 1, 64, "Output length");
      const sources = Array.from({ length }, (_, output) =>
        Array.from(
          { length: kernel },
          (_, k) => output * stride - padding[0] + k * dilation,
        ),
      );
      const support = sources.map((ix) =>
        [
          ...new Set(
            ix
              .filter((i) => i >= 0 && i < previous.length)
              .flatMap((i) => previous.support[i]),
          ),
        ].sort((a, b) => a - b),
      );
      const jump = previous.jump * stride,
        span = previous.span + (effectiveKernel - 1) * previous.jump,
        center =
          previous.center +
          ((effectiveKernel - 1) / 2 - padding[0]) * previous.jump;
      const record = {
        level: level + 1,
        label: layer.label ?? "L" + (level + 1),
        inputLength: previous.length,
        length,
        kernel,
        stride,
        dilation,
        effectiveKernel,
        padding,
        sources,
        support,
        jump,
        span,
        center,
      };
      records.push(record);
      previous = record;
    }
    integer(index, 0, previous.length - 1, "Selected output");
    const selectedByLayer = Array(records.length + 1);
    selectedByLayer[records.length] = [index];
    for (let level = records.length - 1; level >= 0; level--) {
      const record = records[level];
      selectedByLayer[level] = [
        ...new Set(
          selectedByLayer[level + 1]
            .flatMap((i) => record.sources[i])
            .filter((i) => i >= 0 && i < record.inputLength),
        ),
      ].sort((a, b) => a - b);
    }
    const center = previous.center + index * previous.jump,
      extent = [
        center - (previous.span - 1) / 2,
        center + (previous.span - 1) / 2,
      ];
    return {
      inputLength,
      layers: records,
      index,
      outputLength: previous.length,
      selectedByLayer,
      inputIndices: previous.support[index].slice(),
      span: previous.span,
      jump: previous.jump,
      center,
      extent,
      convention:
        "Single path of local kernels, including dilation. Structural influence only; zero weights, nonlinear gates and multipath graphs are not evaluated. Span includes virtual padded positions and may include holes. same chooses ceil(N/stride), extra padding on the right.",
    };
  }
  function gaussianWeights(query, keys, values, { bandwidth = 1 } = {}) {
    if (
      !Array.isArray(query) ||
      !query.length ||
      query.length > 8 ||
      !query.every(Number.isFinite) ||
      !Array.isArray(keys) ||
      !keys.length ||
      keys.length > 256 ||
      keys.some(
        (k) =>
          !Array.isArray(k) ||
          k.length !== query.length ||
          !k.every(Number.isFinite),
      )
    )
      throw Error("Finite query/key vectors of matching dimension required");
    if (!Number.isFinite(bandwidth) || bandwidth < 1e-6)
      throw Error("Gaussian bandwidth must be at least 1e-6");
    if (!Array.isArray(values))
      throw Error("One finite same-size scalar/vector value per key");
    const vectors = values.map((v) => (typeof v === "number" ? [v] : v));
    if (
      !Array.isArray(vectors) ||
      vectors.length !== keys.length ||
      !Array.isArray(vectors[0]) ||
      !vectors[0].length ||
      vectors[0].length > 8 ||
      vectors.some(
        (v) =>
          !Array.isArray(v) ||
          v.length !== vectors[0].length ||
          !v.every(Number.isFinite),
      )
    )
      throw Error("One finite same-size scalar/vector value per key");
    const squaredDistances = keys.map((k) =>
      k.reduce((sum, x, i) => sum + (x - query[i]) ** 2, 0),
    );
    if (!squaredDistances.every(Number.isFinite))
      throw Error("Gaussian distance overflow");
    const nearest = Math.min(...squaredDistances),
      scores = squaredDistances.map(
        (d) => -(d - nearest) / (2 * bandwidth ** 2),
      );
    if (!scores.every(Number.isFinite))
      throw Error("Gaussian score overflow; increase bandwidth");
    const exp = scores.map(Math.exp),
      denominator = exp.reduce((a, b) => a + b, 0),
      weights = exp.map((v) => v / denominator),
      output = vectors[0].map((_, j) =>
        weights.reduce((sum, w, i) => sum + w * vectors[i][j], 0),
      );
    return {
      query: query.slice(),
      keys: keys.map((k) => k.slice()),
      values: vectors.map((v) => v.slice()),
      bandwidth,
      squaredDistances,
      relativeScores: scores,
      weights,
      output,
      weightSum: weights.reduce((a, b) => a + b, 0),
      convention:
        "Normalized Gaussian distance weights; relative scores subtract the nearest distance for stability. Supplied observations, no training. A convex combination, not a probability density or dot-product attention.",
    };
  }
  const api = { receptiveField, gaussianWeights };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  global.VisualBookSpatial = api;
})(typeof window !== "undefined" ? window : globalThis);
