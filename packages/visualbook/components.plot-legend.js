/* Legend glyphs are generated from the same layer descriptions as the marks. */
(function (global) {
  const V = global.VisualBook,
    P = V.palette;
  if (V.plotLegendApplied) return;
  V.plotLegendApplied = true;
  const base = V.components.plot;
  V.components.plot = function (board, options = {}, context = {}) {
    if (options.legend !== undefined && typeof options.legend !== "boolean")
      throw Error("Plot legend must be boolean");
    if (!options.legend) return base(board, options, context);
    if (options.legend !== true) throw Error("Plot legend must be boolean");
    const layers = options.layers ?? [],
      items = layers.filter((l) => l.type !== "handle");
    if (
      !items.length ||
      items.length > 6 ||
      items.some(
        (l) =>
          typeof l.label !== "string" || !l.label.trim() || l.label.length > 24,
      ) ||
      new Set(items.map((l) => l.label)).size !== items.length
    )
      throw Error(
        "Legend needs one distinct short label per data layer, at most six",
      );
    let cursor = 18,
      row = 0;
    items.forEach((item, i) => {
      const width = V.measure(item.label, 13) + 32;
      if (width > board.width - 36)
        throw Error("Shorten the layer legend label");
      if (cursor > 18 && cursor + width > board.width - 18) {
        row++;
        cursor = 18;
      }
      const y = 20 + 24 * row,
        color = P[item.color] ?? item.color ?? P.blue;
      if (item.type === "points")
        board.circle(
          "legend-mark-" + i,
          cursor + 8,
          y - 4,
          item.radius ?? 4,
          color,
        );
      else if (item.type === "area")
        board.rect("legend-mark-" + i, cursor, y - 10, 18, 10, color, {
          opacity: item.opacity ?? 0.15,
        });
      else
        board.line(
          "legend-mark-" + i,
          cursor,
          y - 4,
          cursor + 18,
          y - 4,
          color,
          item.width ?? 2.5,
        );
      board.text("legend-label-" + i, item.label, cursor + 26, y, {
        size: 13,
        color: P.muted,
      });
      cursor += width + 18;
    });
    const legendHeight = (row + 1) * 24 + 10;
    const result = board.region(
      "plot",
      {
        x: 0,
        y: legendHeight,
        width: board.width,
        height: board.height - legendHeight,
      },
      (local) => base(local, { ...options, legend: false }, context),
    );
    return {
      ...result,
      legend: items.map((l) => ({
        label: l.label,
        type: l.type,
        color: l.color ?? "blue",
      })),
    };
  };
})(window);
