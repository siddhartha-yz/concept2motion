/* Optional reusable tensor and convolution designs; depends on VisualBook. */
(function (global) {
  const V = global.VisualBook,
    P = V.palette,
    B = V.Board;
  const shape = (values, name) => {
    if (
      !Array.isArray(values) ||
      !values.length ||
      !Array.isArray(values[0]) ||
      !values[0].length ||
      values.some(
        (r) =>
          !Array.isArray(r) ||
          r.length !== values[0].length ||
          r.some((v) => !Number.isFinite(v)),
      )
    )
      throw Error(name + " must be a finite rectangular matrix");
    return [values.length, values[0].length];
  };
  function correlate2d(input, kernel, { stride = 1, padding = 0 } = {}) {
    const [h, w] = shape(input, "Input"),
      [kh, kw] = shape(kernel, "Kernel");
    if (
      !Number.isInteger(stride) ||
      stride < 1 ||
      !Number.isInteger(padding) ||
      padding < 0
    )
      throw Error("Integer positive stride and nonnegative padding required");
    const oh = Math.floor((h + 2 * padding - kh) / stride) + 1,
      ow = Math.floor((w + 2 * padding - kw) / stride) + 1;
    if (oh < 1 || ow < 1) throw Error("Kernel does not fit padded input");
    return Array.from({ length: oh }, (_, r) =>
      Array.from({ length: ow }, (_, c) =>
        kernel.reduce(
          (s, row, kr) =>
            s +
            row.reduce(
              (v, k, kc) =>
                v +
                k *
                  (input[r * stride + kr - padding]?.[
                    c * stride + kc - padding
                  ] ?? 0),
              0,
            ),
          0,
        ),
      ),
    );
  }
  B.prototype.reshape = function (id, values, rows, { progress = 0 } = {}) {
    const [oldRows, oldCols] = shape(values, "Tensor"),
      flat = values.flat(),
      n = flat.length;
    if (!Number.isInteger(rows) || rows < 1 || n % rows)
      throw Error("Reshape must preserve element count");
    const cols = n / rows;
    if (n > 36 || Math.max(oldRows, oldCols, rows, cols) > 8)
      throw Error(
        "Reshape design supports at most 36 values and 8 per dimension",
      );
    const cell = Math.min(
      46,
      (this.width - 40) / Math.max(oldCols, cols),
      (this.height - 115) / Math.max(oldRows, rows),
    );
    if (cell < 30) throw Error("Tensor too dense; choose a smaller example");
    const left0 = (this.width - oldCols * cell) / 2,
      left1 = (this.width - cols * cell) / 2,
      top = 65,
      p = V.clamp(progress, 0, 1);
    flat.forEach((v, i) => {
      const x = V.mix(
          left0 + (i % oldCols) * cell,
          left1 + (i % cols) * cell,
          p,
        ),
        y = V.mix(
          top + Math.floor(i / oldCols) * cell,
          top + Math.floor(i / cols) * cell,
          p,
        );
      this.rect(
        id + "-cell-" + i,
        x,
        y,
        cell - 3,
        cell - 3,
        i % 2 ? "#e0edf0" : "#eef0e8",
        { stroke: P.faint },
      );
      this.text(
        id + "-value-" + i,
        v,
        x + (cell - 3) / 2,
        y + (cell - 3) / 2 + 5,
        { size: 15, anchor: "middle" },
      );
    });
    this.text(id + "-before", `(${oldRows}, ${oldCols})`, 24, 28, {
      size: 17,
      color: P.muted,
    });
    this.text(id + "-after", `(${rows}, ${cols})`, this.width - 24, 28, {
      size: 17,
      color: P.blue,
      anchor: "end",
    });
    this.label(
      id + "-condition",
      "元素顺序与数量保持不变",
      this.width / 2,
      this.height - 22,
      { anchor: "middle", maxWidth: this.width - 32, size: 14, avoid: false },
    );
    return {
      values,
      output: Array.from({ length: rows }, (_, r) =>
        flat.slice(r * cols, (r + 1) * cols),
      ),
      inputShape: [oldRows, oldCols],
      outputShape: [rows, cols],
      count: n,
      progress: p,
      order: "row-major; positions during interpolation are explanatory",
    };
  };
  B.prototype.convolution = function (
    id,
    input,
    kernel,
    { stride = 1, padding = 0, progress = 0 } = {},
  ) {
    const [h, w] = shape(input, "Input"),
      [kh, kw] = shape(kernel, "Kernel"),
      output = correlate2d(input, kernel, { stride, padding }),
      oh = output.length,
      ow = output[0].length;
    if (Math.max(h, w) > 6 || Math.max(kh, kw) > 3 || padding > 1)
      throw Error(
        "Convolution design supports input <=6, kernel <=3, padding <=1",
      );
    const mobile = this.width < 500,
      cell = Math.min(
        40,
        (this.width - 48) /
          (mobile
            ? Math.max(w + 2 * padding + ow + 1, kw + 1)
            : w + 2 * padding + ow + kw + 3),
      );
    if (cell < 28)
      throw Error("Convolution layout too dense; choose a smaller example");
    const ix = 16,
      iy = 56,
      ox = mobile
        ? ix + (w + 2 * padding + 1) * cell
        : ix + (w + 2 * padding + kw + 2) * cell,
      oy = iy,
      kx = mobile ? 24 : ix + (w + 2 * padding + 1) * cell,
      ky = mobile ? iy + (h + 2 * padding) * cell + 66 : iy;
    const padded = Array.from({ length: h + 2 * padding }, (_, r) =>
      Array.from(
        { length: w + 2 * padding },
        (_, c) => input[r - padding]?.[c - padding] ?? 0,
      ),
    );
    this.matrix(id + "-input", padded, {
      x: ix,
      y: iy,
      cell,
      label: padding ? "输入 · 含零填充" : "输入",
      precision: 1,
    });
    this.matrix(id + "-kernel", kernel, {
      x: kx,
      y: ky,
      cell,
      label: "核",
      color: P.orange,
      precision: 1,
    });
    const at = V.clamp(progress, 0, 1) * (oh * ow - 1),
      index = Math.floor(at),
      next = Math.min(oh * ow - 1, index + 1),
      phase = at - index,
      r = Math.floor(index / ow),
      c = index % ow,
      nr = Math.floor(next / ow),
      nc = next % ow;
    this.matrix(id + "-output", output, {
      x: ox,
      y: oy,
      cell,
      label: "输出",
      activeCell: [r, c],
      precision: 1,
    });
    const x = ix + V.mix(c, nc, phase) * stride * cell,
      y = iy + V.mix(r, nr, phase) * stride * cell;
    this.rect(
      id + "-window",
      x - 2,
      y - 2,
      kw * cell + 1,
      kh * cell + 1,
      "none",
      { stroke: P.orange, "stroke-width": 2.5 },
    );
    const terms = kernel.flatMap((row, kr) =>
        row.map((k, kc) => ({
          input: padded[r * stride + kr][c * stride + kc],
          kernel: k,
          product: padded[r * stride + kr][c * stride + kc] * k,
        })),
      ),
      sum = terms.reduce((s, t) => s + t.product, 0);
    const tx = mobile ? kx + (kw + 1) * cell : 24,
      ty = mobile ? ky + 18 : this.height - 50;
    this.label(
      id + "-value",
      `输出[${r}, ${c}] = ${V.formatNumber(sum, { precision: 2 })}`,
      tx,
      ty,
      {
        maxWidth: mobile ? this.width - tx - 18 : this.width - 40,
        size: 16,
        color: P.orange,
        avoid: false,
      },
    );
    this.label(
      id + "-terms",
      terms.map((t) => `${t.input}×${t.kernel}`).join(" + "),
      mobile ? 24 : this.width / 2,
      mobile ? this.height - 44 : this.height - 78,
      {
        maxWidth: this.width - 48,
        anchor: mobile ? "start" : "middle",
        size: 13,
        avoid: false,
      },
    );
    this.label(
      id + "-shape",
      `${h}×${w} → ${oh}×${ow} · 步幅 ${stride}`,
      mobile ? tx : this.width / 2,
      mobile ? ty + 48 : this.height - 20,
      {
        maxWidth: mobile ? this.width - tx - 18 : this.width - 32,
        anchor: mobile ? "start" : "middle",
        size: 13,
        avoid: false,
      },
    );
    return {
      input,
      kernel,
      output,
      stride,
      padding,
      inputShape: [h, w],
      outputShape: [oh, ow],
      row: r,
      col: c,
      terms,
      sum,
      window: { x, y },
      progress: at,
      convention:
        "cross-correlation as used in deep learning; fractional window movement is explanatory, output values are discrete",
    };
  };
  V.correlate2d = correlate2d;
})(window);
