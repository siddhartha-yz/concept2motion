/* Small explicit tensor calculations. Supplied weights are never called trained weights. */
(function (global) {
  const finite = (v) => {
    if (!Number.isFinite(v)) throw Error("Finite tensor values required");
    return v;
  };
  function matrix(values, name = "Tensor", limit = 4096) {
    if (
      !Array.isArray(values) ||
      !values.length ||
      !Array.isArray(values[0]) ||
      !values[0].length ||
      values.length * values[0].length > limit ||
      values.some(
        (row) =>
          !Array.isArray(row) ||
          row.length !== values[0].length ||
          !row.every(Number.isFinite),
      )
    )
      throw Error(name + " needs a nonempty finite rectangular matrix");
    return [values.length, values[0].length];
  }
  function matmul(a, b) {
    const [m, k] = matrix(a, "A"),
      [kb, n] = matrix(b, "B");
    if (k !== kb)
      throw Error("Matrix multiplication inner dimensions disagree");
    if (m * n * k > 262144)
      throw Error("Educational matrix product is too large");
    return Array.from({ length: m }, (_, r) =>
      Array.from({ length: n }, (_, c) =>
        finite(a[r].reduce((sum, x, i) => sum + x * b[i][c], 0)),
      ),
    );
  }
  function softmax(values, temperature = 1, mask = null) {
    if (
      !Array.isArray(values) ||
      !values.length ||
      values.length > 256 ||
      !values.every(Number.isFinite)
    )
      throw Error("Softmax needs 1..256 finite scores");
    if (!Number.isFinite(temperature) || temperature <= 0)
      throw Error("Positive finite softmax temperature required");
    if (
      mask !== null &&
      (!Array.isArray(mask) ||
        mask.length !== values.length ||
        mask.some((v) => typeof v !== "boolean"))
    )
      throw Error(
        "Softmax mask must contain one boolean per score; true means allowed",
      );
    const allowed = values.filter((_, i) => mask === null || mask[i]);
    if (!allowed.length)
      throw Error("All-masked softmax has no probability distribution");
    const maximum = Math.max(...allowed);
    // Subtract before dividing, so a common large offset cannot overflow x/T.
    const terms = values.map((v, i) =>
      mask !== null && !mask[i] ? 0 : Math.exp((v - maximum) / temperature),
    );
    const denominator = terms.reduce((s, v) => s + v, 0);
    return terms.map((v) => v / denominator);
  }
  function attention(
    queries,
    keys,
    values,
    { temperature = 1, scaled = true, mask = null } = {},
  ) {
    const [nq, d] = matrix(queries, "Queries"),
      [nk, dk] = matrix(keys, "Keys"),
      [nv, dv] = matrix(values, "Values");
    if (d !== dk || nk !== nv)
      throw Error(
        "Attention needs matching query/key dimensions and key/value counts",
      );
    if (nq * nk > 1024)
      throw Error("Educational attention matrix is too large");
    if (typeof scaled !== "boolean") throw Error("scaled must be boolean");
    if (
      mask !== null &&
      (!Array.isArray(mask) ||
        mask.length !== nq ||
        mask.some(
          (row) =>
            !Array.isArray(row) ||
            row.length !== nk ||
            row.some((v) => typeof v !== "boolean"),
        ))
    )
      throw Error(
        "Attention mask shape must be [queries,keys], true means allowed",
      );
    const scale = scaled ? Math.sqrt(d) : 1;
    const scores = queries.map((q) =>
      keys.map((k) => finite(q.reduce((s, v, i) => s + v * k[i], 0) / scale)),
    );
    const weights = scores.map((row, r) =>
      softmax(row, temperature, mask?.[r] ?? null),
    );
    const output = matmul(weights, values);
    return {
      queries,
      keys,
      values,
      queryShape: [nq, d],
      keyShape: [nk, d],
      valueShape: [nk, dv],
      scores,
      weights,
      output,
      scale,
      temperature,
      mask,
      convention:
        "Scaled dot-product attention from supplied Q,K,V; true mask entries participate; no learned projections or heads are implied",
    };
  }
  function normalize(
    data,
    {
      axis = 0,
      epsilon = 1e-5,
      gamma = 1,
      beta = 0,
      mode = "batch",
      runningMean = null,
      runningVariance = null,
    } = {},
  ) {
    const [rows, cols] = matrix(data);
    if (![0, 1].includes(axis))
      throw Error(
        "Normalization axis is 0 (over examples) or 1 (over features)",
      );
    if (!Number.isFinite(epsilon) || epsilon <= 0)
      throw Error("Positive finite normalization epsilon required");
    if (!["batch", "running"].includes(mode))
      throw Error("Normalization mode is batch or running");
    if (mode === "running" && axis !== 0)
      throw Error(
        "Running statistics apply to per-feature normalization over examples",
      );
    const groups = axis === 0 ? cols : rows,
      size = axis === 0 ? rows : cols;
    const read = (group, index) =>
      axis === 0 ? data[index][group] : data[group][index];
    const batchMean = Array.from({ length: groups }, (_, g) =>
      finite(
        Array.from({ length: size }, (_, i) => read(g, i)).reduce(
          (s, v) => s + v / size,
          0,
        ),
      ),
    );
    const batchVariance = Array.from({ length: groups }, (_, g) =>
      finite(
        Array.from(
          { length: size },
          (_, i) => (read(g, i) - batchMean[g]) ** 2 / size,
        ).reduce((s, v) => s + v, 0),
      ),
    );
    const vector = (v, name, count = groups) => {
      if (typeof v === "number") return Array(count).fill(finite(v));
      if (!Array.isArray(v) || v.length !== count || !v.every(Number.isFinite))
        throw Error(name + " needs a scalar or " + count + " finite values");
      return v;
    };
    const mean =
      mode === "batch" ? batchMean : vector(runningMean, "Running mean");
    const variance =
      mode === "batch"
        ? batchVariance
        : vector(runningVariance, "Running variance");
    if (variance.some((v) => v < 0))
      throw Error("Running variances must be nonnegative");
    // Affine parameters attach to features in both batch and layer views.
    const gain = vector(gamma, "Gamma", cols),
      offset = vector(beta, "Beta", cols);
    const centered = data.map((row, r) =>
      row.map((x, c) => finite(x - mean[axis === 0 ? c : r])),
    );
    const standardized = centered.map((row, r) =>
      row.map((x, c) =>
        finite(x / Math.sqrt(variance[axis === 0 ? c : r] + epsilon)),
      ),
    );
    const output = standardized.map((row, r) =>
      row.map((x, c) => finite(x * gain[c] + offset[c])),
    );
    return {
      input: data,
      shape: [rows, cols],
      axis,
      mode,
      mean,
      variance,
      batchMean,
      batchVariance,
      centered,
      standardized,
      output,
      epsilon,
      gamma: gain,
      beta: offset,
      convention:
        "Population variance divides by group size; epsilon is inside sqrt; gamma/beta attach to features; running values are supplied, not learned or updated",
    };
  }
  function dense(input, weights, { bias = 0, activation = "linear" } = {}) {
    const linear = matmul(input, weights),
      channels = weights[0].length;
    const b =
      typeof bias === "number" ? Array(channels).fill(finite(bias)) : bias;
    if (!Array.isArray(b) || b.length !== channels || !b.every(Number.isFinite))
      throw Error("Dense bias shape must match output channels");
    const activate = {
      linear: (x) => x,
      relu: (x) => Math.max(0, x),
      sigmoid: (x) =>
        x >= 0 ? 1 / (1 + Math.exp(-x)) : Math.exp(x) / (1 + Math.exp(x)),
      tanh: (x) => Math.tanh(x),
    }[activation];
    if (!activate) throw Error("Dense activation is linear/relu/sigmoid/tanh");
    const preactivation = linear.map((row) =>
        row.map((v, i) => finite(v + b[i])),
      ),
      output = preactivation.map((row) => row.map(activate));
    return {
      input,
      weights,
      bias: b,
      activation,
      preactivation,
      output,
      inputShape: [input.length, input[0].length],
      weightShape: [weights.length, channels],
      outputShape: [input.length, channels],
      convention: "One supplied dense layer; no training or optimizer state",
    };
  }
  function dropout(data, mask, { rate = 0.5, training = true } = {}) {
    const shape = matrix(data);
    if (typeof training !== "boolean") throw Error("training must be boolean");
    if (!Number.isFinite(rate) || rate < 0 || rate >= 1)
      throw Error("Dropout rate must be in [0,1)");
    if (
      !Array.isArray(mask) ||
      mask.length !== shape[0] ||
      mask.some(
        (row) =>
          !Array.isArray(row) ||
          row.length !== shape[1] ||
          row.some((v) => typeof v !== "boolean"),
      )
    )
      throw Error(
        "Dropout requires explicit boolean mask matching input; true means kept",
      );
    const output = data.map((row, r) =>
      row.map((v, c) =>
        training ? (mask[r][c] ? finite(v / (1 - rate)) : 0) : v,
      ),
    );
    return {
      input: data,
      mask,
      rate,
      training,
      output,
      scale: training ? 1 / (1 - rate) : 1,
      convention:
        "Explicit illustrative mask, inverted dropout; no random sampling claim; evaluation is identity",
    };
  }
  function denseBackward(
    input,
    weights,
    { bias = 0, activation = "linear", seeds = null } = {},
  ) {
    const facts = dense(input, weights, { bias, activation }),
      [rows, channels] = facts.outputShape;
    const outputGradient =
      seeds ?? Array.from({ length: rows }, () => Array(channels).fill(1));
    const shape = matrix(outputGradient, "Backward seeds");
    if (shape[0] !== rows || shape[1] !== channels)
      throw Error("Backward seed shape must match dense output");
    const derivative = {
      linear: () => 1,
      relu: (z) => (z > 0 ? 1 : 0),
      sigmoid: (_, y) => y * (1 - y),
      tanh: (_, y) => 1 - y * y,
    }[activation];
    const preactivationGradient = facts.preactivation.map((row, r) =>
      row.map((z, c) =>
        finite(outputGradient[r][c] * derivative(z, facts.output[r][c])),
      ),
    );
    const inputGradient = input.map((row) => row.map(() => 0)),
      weightGradient = weights.map((row) => row.map(() => 0)),
      biasGradient = Array(channels).fill(0);
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < channels; c++) {
        const delta = preactivationGradient[r][c];
        biasGradient[c] = finite(biasGradient[c] + delta);
        for (let i = 0; i < weights.length; i++) {
          inputGradient[r][i] = finite(
            inputGradient[r][i] + weights[i][c] * delta,
          );
          weightGradient[i][c] = finite(
            weightGradient[i][c] + input[r][i] * delta,
          );
        }
      }
    const seededValue = finite(
      facts.output.reduce(
        (sum, row, r) =>
          sum + row.reduce((s, y, c) => s + y * outputGradient[r][c], 0),
        0,
      ),
    );
    return {
      ...facts,
      outputGradient,
      preactivationGradient,
      inputGradient,
      weightGradient,
      biasGradient,
      seededValue,
      convention:
        facts.convention +
        "; gradient of sum(output*seeds), no implicit batch averaging; ReLU at zero uses chosen subgradient 0",
    };
  }
  function squaredLoss(prediction, target, { reduction = "mean" } = {}) {
    const a = matrix(prediction, "Prediction"),
      b = matrix(target, "Target");
    if (a[0] !== b[0] || a[1] !== b[1])
      throw Error("Squared loss tensor shapes must match");
    if (!["mean", "sum"].includes(reduction))
      throw Error("Loss reduction is mean or sum");
    const denominator = reduction === "mean" ? a[0] * a[1] : 1,
      residuals = prediction.map((row, r) =>
        row.map((v, c) => finite(v - target[r][c])),
      );
    const loss = finite(
      residuals.flat().reduce((s, v) => s + (v * v) / (2 * denominator), 0),
    );
    return {
      prediction,
      target,
      residuals,
      loss,
      gradient: residuals.map((row) => row.map((v) => v / denominator)),
      denominator,
      reduction,
      convention:
        "Half squared error; mean divides by every scalar entry, sum does not average",
    };
  }
  function softmaxLoss(logits, labels, { reduction = "mean" } = {}) {
    const [rows, classes] = matrix(logits, "Logits");
    if (
      !Array.isArray(labels) ||
      labels.length !== rows ||
      labels.some((v) => !Number.isInteger(v) || v < 0 || v >= classes)
    )
      throw Error("One integer class label per logit row required");
    if (!["mean", "sum"].includes(reduction))
      throw Error("Loss reduction is mean or sum");
    const probabilities = logits.map((row) => softmax(row));
    const losses = logits.map((row, r) => {
      const m = Math.max(...row);
      return finite(
        m -
          row[labels[r]] +
          Math.log(row.reduce((s, v) => s + Math.exp(v - m), 0)),
      );
    });
    const denominator = reduction === "mean" ? rows : 1,
      loss = finite(losses.reduce((s, v) => s + v / denominator, 0));
    const gradient = probabilities.map((row, r) =>
      row.map((p, c) => (p - (labels[r] === c ? 1 : 0)) / denominator),
    );
    return {
      logits,
      labels,
      probabilities,
      losses,
      loss,
      gradient,
      denominator,
      reduction,
      convention:
        "Cross entropy from unnormalized logits; mean divides by sample count; stable logsumexp, not log of an underflowed probability",
    };
  }
  function transpose(input, { index = [0, 0] } = {}) {
    const [rows, cols] = matrix(input);
    if (
      !Array.isArray(index) ||
      index.length !== 2 ||
      !index.every(Number.isInteger) ||
      index[0] < 0 ||
      index[0] >= rows ||
      index[1] < 0 ||
      index[1] >= cols
    )
      throw Error("Transpose input index outside shape");
    return {
      input,
      output: Array.from({ length: cols }, (_, c) =>
        input.map((row) => row[c]),
      ),
      inputShape: [rows, cols],
      outputShape: [cols, rows],
      selectedInput: [...index],
      selectedOutput: [index[1], index[0]],
      selectedValue: input[index[0]][index[1]],
      convention:
        "Numeric transpose output, not a framework storage/view or physical copying measurement.",
    };
  }
  const api = {
    matrix,
    transpose,
    matmul,
    softmax,
    attention,
    normalize,
    dense,
    denseBackward,
    dropout,
    squaredLoss,
    softmaxLoss,
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  global.VisualBookNeural = api;
})(typeof window !== "undefined" ? window : globalThis);
