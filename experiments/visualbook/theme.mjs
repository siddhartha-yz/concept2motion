// Presentation only: raw generated code and numerical facts remain intact.
export function themeSvg(svg) {
  const colors = {
    "#faf8f2": "#faf9f5",
    "#fbf8f1": "#faf9f5",
    "#292824": "#283c49",
    "#272b2e": "#283c49",
    "#252a2d": "#283c49",
    "#292722": "#283c49",
    "#356d9b": "#2d6c8c",
    "#356f9f": "#2d6c8c",
    "#356b91": "#2d6c8c",
    "#356c98": "#2d6c8c",
    "#b96a27": "#9c5128",
    "#c87532": "#9c5128",
    "#bd6935": "#9c5128",
    "#ba682e": "#9c5128",
    "#cb702c": "#9c5128",
    "#286c9c": "#2d6c8c",
    "#252521": "#283c49",
    "#3176a6": "#2d6c8c",
    "#bb702e": "#9c5128",
    "#a9a69e": "#6f716e",
  };
  return svg.replace(
    /#[0-9a-f]{6}\b/gi,
    (color) => colors[color.toLowerCase()] ?? color,
  );
}
export function contrast(foreground, background) {
  function luminance(hex) {
    const rgb = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
    const linear = rgb.map((v) =>
      v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4,
    );
    return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
  }
  const a = luminance(foreground),
    b = luminance(background);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}
