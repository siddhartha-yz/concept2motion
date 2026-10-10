/* Exact logical tensor permutation and reshape; no storage-copy claim. */
(function (global) {
  const product = (s) => s.reduce((a, b) => a * b, 1),
    shape = (s) =>
      Array.isArray(s) &&
      s.length >= 1 &&
      s.length <= 4 &&
      s.every((n) => Number.isSafeInteger(n) && n >= 1 && n <= 8) &&
      product(s) <= 64;
  const strides = (s) => s.map((_, i) => product(s.slice(i + 1))),
    coords = (i, s) => s.map((n, a) => Math.floor(i / strides(s)[a]) % n);
  function tensorReindex({
    values,
    shape: inputShape,
    order,
    reshape = null,
    inputColumns = null,
    outputColumns = null,
    inputCell = [0, 0],
  } = {}) {
    if (
      !shape(inputShape) ||
      !Array.isArray(values) ||
      values.length !== product(inputShape) ||
      !values.every(Number.isFinite)
    )
      throw Error(
        "One to four axes, sizes1..8, at most64 finite values matching shape",
      );
    if (
      !Array.isArray(order) ||
      order.length !== inputShape.length ||
      !order.every(Number.isInteger) ||
      new Set(order).size !== order.length ||
      order.some((n) => n < 0 || n >= order.length)
    )
      throw Error("Order must permute every input axis exactly once");
    const permutedShape = order.map((a) => inputShape[a]),
      outputShape = reshape ?? permutedShape;
    if (!shape(outputShape) || product(outputShape) !== values.length)
      throw Error("Reshape must preserve element count");
    const inCols = inputColumns ?? inputShape.at(-1),
      outCols = outputColumns ?? outputShape.at(-1);
    for (const columns of [inCols, outCols])
      if (
        !Number.isSafeInteger(columns) ||
        columns < 1 ||
        columns > 8 ||
        values.length % columns ||
        values.length / columns > 8
      )
        throw Error("Display matrices must fit8x8 and preserve all values");
    if (
      !Array.isArray(inputCell) ||
      inputCell.length !== 2 ||
      !inputCell.every(Number.isInteger) ||
      inputCell[0] < 0 ||
      inputCell[0] >= values.length / inCols ||
      inputCell[1] < 0 ||
      inputCell[1] >= inCols
    )
      throw Error("Selected input cell is outside the display matrix");
    const permStrides = strides(permutedShape),
      mapping = values.map((value, inputFlat) => {
        const inputIndex = coords(inputFlat, inputShape),
          permutedIndex = order.map((a) => inputIndex[a]),
          outputFlat = permutedIndex.reduce(
            (s, v, a) => s + v * permStrides[a],
            0,
          );
        return {
          value,
          inputFlat,
          inputIndex,
          permutedIndex,
          outputFlat,
          outputIndex: coords(outputFlat, outputShape),
          inputCell: [Math.floor(inputFlat / inCols), inputFlat % inCols],
          outputCell: [Math.floor(outputFlat / outCols), outputFlat % outCols],
        };
      });
    const output = Array(values.length);
    mapping.forEach((m) => (output[m.outputFlat] = m.value));
    const matrix = (flat, columns) =>
      Array.from({ length: flat.length / columns }, (_, r) =>
        flat.slice(r * columns, (r + 1) * columns),
      );
    return {
      values: [...values],
      inputShape: [...inputShape],
      order: [...order],
      permutedShape,
      outputShape: [...outputShape],
      output,
      inputMatrix: matrix(values, inCols),
      outputMatrix: matrix(output, outCols),
      mapping,
      selected: mapping[inputCell[0] * inCols + inputCell[1]],
      convention:
        "Exact logical row-major permutation, followed by a count-preserving logical reshape. Display grouping is explicit. No GPU execution, measured memory or assertion that a real tensor operation is zero-copy.",
    };
  }
  const api = { tensorReindex };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  global.VisualBookReindex = api;
})(typeof window !== "undefined" ? window : globalThis);
