// Synthetic stand-ins for useTourism().data / useCapacity().data, for tests.

export function monthPeriods(fromYear, toYear, toMonth, fromMonth = 1) {
  const out = [];
  for (let y = fromYear; y <= toYear; y++) {
    for (let m = 1; m <= 12; m++) {
      if (y === fromYear && m < fromMonth) continue;
      if (y === toYear && m > toMonth) break;
      out.push(`${y}M${String(m).padStart(2, "0")}`);
    }
  }
  return out;
}

// Spread an annual total over 12 integer months (January carries the rest).
export function spread(total) {
  const k = Math.floor(total / 24);
  return [total - 11 * k, ...new Array(11).fill(k)];
}

// annual: { [regionCode]: (year) => annual guest total | null }
export function makeFixture({ fromYear, fromMonth = 1, toYear, toMonth, annual }) {
  const periods = monthPeriods(fromYear, toYear, toMonth, fromMonth);
  const series = new Map();
  const put = (key, arr) => series.set(key, arr);
  for (const [code, byYear] of Object.entries(annual)) {
    const guests = periods.map((p) => {
      const year = +p.slice(0, 4);
      const month = +p.slice(5);
      const total = byYear(year);
      return total == null ? null : spread(total)[month - 1];
    });
    const dom = guests.map((g) => (g == null ? null : Math.round(g * 0.6)));
    const forg = guests.map((g, i) => (g == null ? null : g - dom[i]));
    put(`OCC_ARR|${code}|WORLD`, guests);
    put(`OCC_ARR|${code}|EE`, dom);
    put(`OCC_ARR|${code}|FOR`, forg);
    put(`OCC_NI|${code}|WORLD`, guests.map((g) => (g == null ? null : g * 2)));
    put(`OCC_NI|${code}|EE`, dom.map((g) => (g == null ? null : g * 2)));
    put(`OCC_NI|${code}|FOR`, forg.map((g) => (g == null ? null : g * 2)));
    put(`cap|OCC_OR_BEDR|${code}`, periods.map(() => 55.5));
    put(`cap|OCC_OR_BEDP|${code}`, periods.map(() => 40.25));
    put(`cap|CAP_ESTA|${code}`, periods.map(() => 120));
    put(`cap|CAP_BEDR|${code}`, periods.map(() => 3000));
    put(`cap|CAP_BEDP|${code}`, periods.map(() => 7000));
    put(`cap|OCC_NI_COST|${code}`, periods.map(() => 77.7));
  }
  const empty = () => new Array(periods.length).fill(null);
  const latestIdx = periods.length - 1;
  const tourism = {
    periods,
    get: (ind, region, res = "WORLD") => series.get(`${ind}|${region}|${res}`) ?? empty(),
    latestIdx,
    latest: periods[latestIdx],
  };
  const capacity = {
    periods,
    get: (ind, region) => series.get(`cap|${ind}|${region}`) ?? empty(),
    latestIdx,
    latest: periods[latestIdx],
  };
  return { tourism, capacity };
}
