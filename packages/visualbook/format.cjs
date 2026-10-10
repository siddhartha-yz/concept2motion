/* Display formatting only. Exact numerical results stay unchanged in facts. */
(function (global) {
  function formatNumber(value, { precision = 3 } = {}) {
    if (!Number.isFinite(value)) throw Error("Finite display number required");
    if (!Number.isInteger(precision) || precision < 0 || precision > 6)
      throw Error("Display precision must be integer 0..6");
    if (value === 0) return "0";
    const magnitude = Math.abs(value),
      rounded = Number(value.toFixed(precision));
    if (magnitude < 0.01 || magnitude >= 1e4 || rounded === 0) {
      const [mantissa, exponent] = value.toExponential(precision).split("e");
      return String(Number(mantissa)) + "e" + String(Number(exponent));
    }
    return String(rounded);
  }
  const api = { formatNumber };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  global.VisualBookFormat = api;
})(typeof window !== "undefined" ? window : globalThis);
