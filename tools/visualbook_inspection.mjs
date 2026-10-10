/* DOM geometry inspection shared by both authoring arms; no drawing or model calls. */
export function invalidGeometry(svg) {
  const attributes = new Set([
    "d",
    "points",
    "transform",
    "viewBox",
    "x",
    "y",
    "x1",
    "y1",
    "x2",
    "y2",
    "cx",
    "cy",
    "r",
    "rx",
    "ry",
    "width",
    "height",
  ]);
  const findings = [];
  for (const node of [svg, ...svg.querySelectorAll("*")])
    for (const attr of node.attributes) {
      if (
        attributes.has(attr.name) &&
        /(?:NaN|Infinity|undefined|null)/.test(attr.value)
      )
        findings.push({
          tag: node.tagName,
          key: node.dataset.vizKey ?? null,
          attribute: attr.name,
          value: attr.value.slice(0, 300),
        });
    }
  return findings;
}
