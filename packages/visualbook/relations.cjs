/* Shared contributions and intervals, independent of any particular chapter. */
(function (global) {
  const finite = (v) => {
    if (!Number.isFinite(v)) throw Error("Finite relation input required");
    return v;
  };
  const identifier = (v) => {
    if (typeof v !== "string" || !/^[a-zA-Z][a-zA-Z0-9_-]{0,30}$/.test(v))
      throw Error("Short relation identifier required");
    return v;
  };
  function contributions(terms, { prefix = terms?.length } = {}) {
    if (!Array.isArray(terms) || !terms.length || terms.length > 32)
      throw Error("1..32 contribution terms required");
    const records = terms.map((term) => {
      const value = typeof term.value === "number" ? [term.value] : term.value;
      if (
        !Array.isArray(value) ||
        !value.length ||
        value.length > 8 ||
        !value.every(Number.isFinite)
      )
        throw Error(
          "Contribution needs a finite scalar or vector of size 1..8",
        );
      const weight = finite(term.weight ?? 1);
      return {
        id: identifier(term.id),
        label: term.label ?? term.id,
        input: value.slice(),
        weight,
        value: value.map((v) => v * weight),
      };
    });
    if (new Set(records.map((r) => r.id)).size !== records.length)
      throw Error("Unique contribution ids required");
    const dimension = records[0].value.length;
    if (records.some((r) => r.value.length !== dimension))
      throw Error("Contribution dimensions must agree");
    finite(prefix);
    if (prefix < 0 || prefix > records.length)
      throw Error("Contribution prefix outside term count");
    const sum = Array(dimension).fill(0),
      visibleSum = sum.slice(),
      partialSums = [sum.slice()];
    for (let i = 0; i < records.length; i++) {
      const record = records[i],
        fraction = Math.max(0, Math.min(1, prefix - i));
      record.fraction = fraction;
      record.visibleValue = record.value.map((v) => v * fraction);
      for (let j = 0; j < dimension; j++) {
        sum[j] += record.value[j];
        visibleSum[j] += record.visibleValue[j];
      }
      partialSums.push(sum.slice());
    }
    return {
      records,
      dimension,
      prefix,
      sum,
      visibleSum,
      partialSums,
      convention:
        "Weighted scalar/vector sum. Fractional prefix is an explanatory construction, not measured execution or a separately derived gradient.",
    };
  }
  function lifetimes(intervals, { time = 0 } = {}) {
    if (!Array.isArray(intervals) || !intervals.length || intervals.length > 32)
      throw Error("1..32 lifetime intervals required");
    finite(time);
    const records = intervals.map((interval) => {
      const { start, end } = interval,
        size = interval.size ?? 1;
      [start, end, size].forEach(finite);
      if (start < 0 || end <= start || size < 0)
        throw Error("Lifetime needs 0≤start<end and nonnegative size");
      return {
        id: identifier(interval.id),
        label: interval.label ?? interval.id,
        start,
        end,
        size,
        active: start <= time && time < end,
      };
    });
    if (new Set(records.map((r) => r.id)).size !== records.length)
      throw Error("Unique lifetime ids required");
    const eventTimes = [
      ...new Set(records.flatMap((r) => [r.start, r.end])),
    ].sort((a, b) => a - b);
    const series = eventTimes.map((at) => {
      const alive = records.filter((r) => r.start <= at && at < r.end);
      return {
        time: at,
        count: alive.length,
        size: alive.reduce((sum, r) => sum + r.size, 0),
      };
    });
    const active = records.filter((r) => r.active).map((r) => r.id);
    return {
      records,
      time,
      start: Math.min(...eventTimes),
      end: Math.max(...eventTimes),
      active,
      activeCount: active.length,
      activeSize: records.reduce((sum, r) => sum + (r.active ? r.size : 0), 0),
      peakSize: Math.max(...series.map((s) => s.size)),
      peakCount: Math.max(...series.map((s) => s.count)),
      eventTimes,
      series,
      convention:
        "Supplied half-open intervals [start,end); simultaneous releases happen before allocations. Sizes and lifetimes are declared illustrative data, not allocator or hardware measurements.",
    };
  }
  const api = { contributions, lifetimes };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  global.VisualBookRelations = api;
})(typeof window !== "undefined" ? window : globalThis);
