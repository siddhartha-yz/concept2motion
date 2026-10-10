/* Bounded numerical operations shared by the CLI, MCP and composed scenes. */
(function (global) {
  const N =
    typeof module !== "undefined" && module.exports
      ? require("./numeric.cjs")
      : global.VisualBookNumeric;
  const T =
    typeof module !== "undefined" && module.exports
      ? require("./neural.cjs")
      : global.VisualBookNeural;
  const R =
    typeof module !== "undefined" && module.exports
      ? require("./program.cjs")
      : global.VisualBookProgram;
  const L =
    typeof module !== "undefined" && module.exports
      ? require("./relations.cjs")
      : global.VisualBookRelations;
  const S =
    typeof module !== "undefined" && module.exports
      ? require("./spatial.cjs")
      : global.VisualBookSpatial;
  const F =
    typeof module !== "undefined" && module.exports
      ? require("./fields.cjs")
      : global.VisualBookFields;
  const G =
    typeof module !== "undefined" && module.exports
      ? require("./sampling.cjs")
      : global.VisualBookSampling;
  const Q =
    typeof module !== "undefined" && module.exports
      ? require("./polynomial.cjs")
      : global.VisualBookPolynomial;
  const operations = {
    "sample-grid": {
      keys: ["xDomain", "yDomain", "resolution", "field"],
      required: [],
      outputs: [
        "grid",
        "points",
        "values",
        "field",
        "shape",
        "xDomain",
        "yDomain",
        "convention",
      ],
      run: G.sampleGrid,
    },
    "polynomial-fit": {
      keys: [
        "data",
        "degree",
        "lambda",
        "center",
        "scale",
        "xDomain",
        "samples",
      ],
      required: ["data"],
      outputs: [
        "data",
        "degree",
        "lambda",
        "center",
        "scale",
        "coefficients",
        "predictions",
        "residuals",
        "trainingMSE",
        "regularization",
        "objective",
        "gradient",
        "curve",
        "xDomain",
        "rank",
        "diagonalRatio",
        "convention",
      ],
      run: Q.polynomialFit,
    },
    transpose: {
      keys: ["input", "index"],
      required: ["input"],
      outputs: [
        "input",
        "output",
        "inputShape",
        "outputShape",
        "selectedInput",
        "selectedOutput",
        "selectedValue",
        "convention",
      ],
      run: ({ input, ...options }) => T.transpose(input, options),
    },
    "scalar-field": {
      keys: ["spec", "point"],
      required: ["spec", "point"],
      outputs: ["spec", "point", "value", "gradient", "hessian", "convention"],
      run: ({ spec, point }) => F.scalarField(spec, point),
    },
    "receptive-field": {
      keys: ["inputLength", "layers", "index"],
      required: ["inputLength", "layers"],
      outputs: [
        "inputLength",
        "layers",
        "index",
        "outputLength",
        "selectedByLayer",
        "inputIndices",
        "span",
        "jump",
        "center",
        "extent",
        "convention",
      ],
      run: ({ inputLength, layers, ...options }) =>
        S.receptiveField(inputLength, layers, options),
    },
    "gaussian-weights": {
      keys: ["query", "keys", "values", "bandwidth"],
      required: ["query", "keys", "values"],
      outputs: [
        "query",
        "keys",
        "values",
        "bandwidth",
        "squaredDistances",
        "relativeScores",
        "weights",
        "output",
        "weightSum",
        "convention",
      ],
      run: ({ query, keys, values, ...options }) =>
        S.gaussianWeights(query, keys, values, options),
    },
    contributions: {
      keys: ["terms", "prefix"],
      required: ["terms"],
      outputs: [
        "records",
        "dimension",
        "prefix",
        "sum",
        "visibleSum",
        "partialSums",
        "convention",
      ],
      run: ({ terms, ...options }) => L.contributions(terms, options),
    },
    lifetimes: {
      keys: ["intervals", "time"],
      required: ["intervals"],
      outputs: [
        "records",
        "time",
        "start",
        "end",
        "active",
        "activeCount",
        "activeSize",
        "peakSize",
        "peakCount",
        "eventTimes",
        "series",
        "convention",
      ],
      run: ({ intervals, ...options }) => L.lifetimes(intervals, options),
    },
    "array-view": {
      keys: [
        "buffer",
        "shape",
        "elementStrides",
        "offset",
        "itemSize",
        "index",
      ],
      required: ["buffer", "shape"],
      outputs: [
        "shape",
        "elementStrides",
        "byteStrides",
        "offset",
        "itemSize",
        "indices",
        "addresses",
        "byteOffsets",
        "flat",
        "matrix",
        "selectedAddress",
        "selectedValue",
        "aliases",
        "logicalBytes",
        "bufferBytes",
        "convention",
      ],
      run: ({ buffer, shape, ...options }) =>
        R.arrayView(buffer, shape, options),
    },
    broadcast: {
      keys: [
        "leftValues",
        "leftShape",
        "rightValues",
        "rightShape",
        "operation",
      ],
      required: ["leftValues", "leftShape", "rightValues", "rightShape"],
      outputs: [
        "shape",
        "values",
        "matrix",
        "indices",
        "leftIndexMap",
        "rightIndexMap",
        "leftAlignedShape",
        "rightAlignedShape",
        "operation",
        "convention",
      ],
      run: ({ leftValues, leftShape, rightValues, rightShape, ...options }) =>
        R.broadcast(leftValues, leftShape, rightValues, rightShape, options),
    },
    "task-schedule": {
      keys: ["tasks"],
      required: ["tasks"],
      outputs: ["records", "lanes", "span", "busy", "idle", "convention"],
      run: ({ tasks }) => R.schedule(tasks),
    },
    "memory-trace": {
      keys: ["instructions"],
      required: ["instructions"],
      outputs: [
        "history",
        "locals",
        "objects",
        "objectIds",
        "variableIds",
        "steps",
        "convention",
      ],
      run: ({ instructions }) => R.memoryTrace(instructions),
    },
    "normal-cdf": {
      outputs: ["value", "absoluteErrorBound"],
      keys: ["x"],
      required: ["x"],
      run: (i) => ({ value: N.normalCDF(i.x), absoluteErrorBound: 7.5e-8 }),
    },
    binomial: {
      outputs: ["n", "p", "probabilities", "mean", "variance", "sum"],
      keys: ["n", "p"],
      required: ["n", "p"],
      run: (i) => N.binomial(i.n, i.p),
    },
    histogram: {
      outputs: ["bins", "outside", "total", "inRange"],
      keys: ["samples", "domain", "count"],
      required: ["samples", "domain"],
      run: (i) => N.histogram(i.samples, i.domain, i.count),
    },
    bayes: {
      outputs: [
        "prior",
        "sensitivity",
        "falsePositive",
        "truePositive",
        "falsePositiveMass",
        "evidence",
        "posterior",
        "negative",
        "convention",
      ],
      keys: ["prior", "sensitivity", "falsePositive"],
      required: ["prior", "sensitivity", "falsePositive"],
      run: (i) => N.bayes(i.prior, i.sensitivity, i.falsePositive),
    },
    regression: {
      outputs: [
        "data",
        "weight",
        "bias",
        "lambda",
        "predictions",
        "residuals",
        "dataLoss",
        "penalty",
        "loss",
        "weightGradient",
        "biasGradient",
        "convention",
      ],
      keys: ["data", "weight", "bias", "lambda"],
      required: ["data"],
      run: (i) => N.regression(i.data, i.weight, i.bias, i.lambda),
    },
    "regression-optimum": {
      outputs: [
        "weight",
        "bias",
        "meanX",
        "meanY",
        "variance",
        "covariance",
        "identifiable",
      ],
      keys: ["data", "lambda"],
      required: ["data"],
      run: (i) => N.regressionOptimum(i.data, i.lambda),
    },
    pca: {
      outputs: [
        "mean",
        "covariance",
        "eigenvalues",
        "axis",
        "secondAxis",
        "coordinates",
        "projections",
        "reconstructed",
        "explained",
        "degenerate",
        "convention",
      ],
      keys: ["data"],
      required: ["data"],
      run: (i) => N.pca2d(i.data),
    },
    matmul: {
      outputs: ["output"],
      keys: ["a", "b"],
      required: ["a", "b"],
      run: (i) => ({ output: T.matmul(i.a, i.b) }),
    },
    softmax: {
      outputs: ["weights"],
      keys: ["scores", "temperature", "mask"],
      required: ["scores"],
      run: (i) => ({ weights: T.softmax(i.scores, i.temperature, i.mask) }),
    },
    attention: {
      outputs: [
        "queries",
        "keys",
        "values",
        "queryShape",
        "keyShape",
        "valueShape",
        "scores",
        "weights",
        "output",
        "scale",
        "temperature",
        "mask",
        "convention",
      ],
      keys: ["queries", "keys", "values", "temperature", "scaled", "mask"],
      required: ["queries", "keys", "values"],
      run: ({ queries, keys, values, ...options }) =>
        T.attention(queries, keys, values, options),
    },
    normalization: {
      outputs: [
        "input",
        "shape",
        "axis",
        "mode",
        "mean",
        "variance",
        "batchMean",
        "batchVariance",
        "centered",
        "standardized",
        "output",
        "epsilon",
        "gamma",
        "beta",
        "convention",
      ],
      keys: [
        "data",
        "axis",
        "epsilon",
        "gamma",
        "beta",
        "mode",
        "runningMean",
        "runningVariance",
      ],
      required: ["data"],
      run: ({ data, ...options }) => T.normalize(data, options),
    },
    dense: {
      outputs: [
        "input",
        "weights",
        "bias",
        "activation",
        "preactivation",
        "output",
        "inputShape",
        "weightShape",
        "outputShape",
        "convention",
      ],
      keys: ["input", "weights", "bias", "activation"],
      required: ["input", "weights"],
      run: ({ input, weights, ...options }) => T.dense(input, weights, options),
    },
    "dense-backward": {
      outputs: [
        "input",
        "weights",
        "bias",
        "activation",
        "preactivation",
        "output",
        "inputShape",
        "weightShape",
        "outputShape",
        "outputGradient",
        "preactivationGradient",
        "inputGradient",
        "weightGradient",
        "biasGradient",
        "seededValue",
        "convention",
      ],
      keys: ["input", "weights", "bias", "activation", "seeds"],
      required: ["input", "weights"],
      run: ({ input, weights, ...options }) =>
        T.denseBackward(input, weights, options),
    },
    "squared-loss": {
      keys: ["prediction", "target", "reduction"],
      required: ["prediction", "target"],
      outputs: [
        "prediction",
        "target",
        "residuals",
        "loss",
        "gradient",
        "denominator",
        "reduction",
        "convention",
      ],
      run: ({ prediction, target, ...options }) =>
        T.squaredLoss(prediction, target, options),
    },
    "softmax-loss": {
      keys: ["logits", "labels", "reduction"],
      required: ["logits", "labels"],
      outputs: [
        "logits",
        "labels",
        "probabilities",
        "losses",
        "loss",
        "gradient",
        "denominator",
        "reduction",
        "convention",
      ],
      run: ({ logits, labels, ...options }) =>
        T.softmaxLoss(logits, labels, options),
    },
    dropout: {
      outputs: [
        "input",
        "mask",
        "rate",
        "training",
        "output",
        "scale",
        "convention",
      ],
      keys: ["data", "mask", "rate", "training"],
      required: ["data", "mask"],
      run: ({ data, mask, ...options }) => T.dropout(data, mask, options),
    },
  };
  function computeMath(operation, input) {
    const spec = operations[operation];
    if (!spec) throw Error("Unknown numeric operation");
    if (!input || typeof input !== "object" || Array.isArray(input))
      throw Error("Numeric input must be an object");
    if (Object.keys(input).some((k) => !spec.keys.includes(k)))
      throw Error("Unknown input field; allowed: " + spec.keys.join(", "));
    if (spec.required.some((k) => input[k] === undefined))
      throw Error("Required numeric inputs: " + spec.required.join(", "));
    const result = spec.run(input);
    function check(v) {
      if (typeof v === "number" && !Number.isFinite(v))
        throw Error("Calculation overflowed; reduce the input scale");
      if (v && typeof v === "object") Object.values(v).forEach(check);
    }
    check(result);
    return {
      operation,
      inputs: input,
      result,
      scope:
        "Canonical calculation only; not independent math review, rendering or a model result",
    };
  }
  const api = { operations, compute: computeMath };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  global.VisualBookCalculations = api;
})(typeof window !== "undefined" ? window : globalThis);
