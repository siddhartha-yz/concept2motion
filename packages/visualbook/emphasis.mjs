/* Render-only normalization of emphasis adjacent to CJK text and inline math/code. */
export function normalizeEmphasis(raw) {
  const adjust = (s) =>
    s
      .replace(/([^\s\p{P}])\*\*(?=\$|`)/gu, "$1 **")
      .replace(/(?<=\$)\*\*(?=[\p{L}\p{N}])/gu, "** ");
  let result = "",
    cursor = 0;
  const pattern = /(`+)([\s\S]*?)\1/g;
  let match;
  while ((match = pattern.exec(raw))) {
    const prefix = adjust(raw.slice(cursor, match.index)).replace(
      /([^\s\p{P}])\*\*$/gu,
      "$1 **",
    );
    result += prefix + match[0];
    cursor = match.index + match[0].length;
  }
  result += adjust(raw.slice(cursor));
  // A bold opener immediately before a code span lives in the preceding text.
  return result;
}
