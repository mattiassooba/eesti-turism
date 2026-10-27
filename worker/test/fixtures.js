import { RANGE_COLUMNS } from "../../src/lib/askShape.js";

// A small, valid request body shaped like the browser's packet.
export const region = () => ({
  names: ["Hiiu maakond", "Hiiumaa", "Hiiu", "Hiiu County"],
  years: [
    [2024, 40000, 90000, 30000, 10000, 3.2, 1.1, 4.4, 51.5, 38.2],
    [2025, 41000, null, 30500, 10500, 2.5, null, 5, 52, 39],
  ],
  latest: [5000, 4.9, 9000, 6.4, 3500, 1500, -2.1],
  months: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
  busiestMonth: 7,
  quietestMonth: 1,
  summerSharePct: 45.5,
  capacity: [40, 600, 1500],
});

export const validBody = () => ({
  question: "  Milline   on Hiiumaa trend? ",
  locale: "et",
  selected: { region: "hiiu", compare: null },
  packet: {
    v: 1,
    latest: "2026M08",
    lastFullYear: 2025,
    partialYear: { year: 2026, months: 8 },
    regions: { ee: region(), hiiu: region() },
    rankings: { year: 2025, byGuests: [["hiiu", 41000]], byGrowthPct: [["hiiu", 2.5]], bySummerSharePct: [["hiiu", 45.5]] },
    range: {
      from: 2015,
      to: 2025,
      requested: [1950, 2025],
      missing: [1950],
      rows: { hiiu: RANGE_COLUMNS.map((_, i) => (i === 1 ? null : 100 + i)) },
    },
  },
});
