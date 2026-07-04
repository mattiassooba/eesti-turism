export function flattenToRows(dataset) {
  const dims = dataset.id;
  const sizes = dataset.size;

  const dimensions = dims.map((code) => {
    const dim = dataset.dimension[code];
    const index = dim.category.index;
    const label = dim.category.label ?? {};
    const keys = index
      ? Object.entries(index)
          .sort((a, b) => a[1] - b[1])
          .map(([k]) => k)
      : Object.keys(label);
    return { code, keys, labels: label };
  });

  const total = dataset.value.length;
  const rows = [];

  for (let flatIndex = 0; flatIndex < total; flatIndex++) {
    let remainder = flatIndex;
    const coords = new Array(dims.length);
    for (let d = dims.length - 1; d >= 0; d--) {
      const size = sizes[d];
      coords[d] = remainder % size;
      remainder = Math.floor(remainder / size);
    }

    const row = {};
    dims.forEach((code, d) => {
      const dimension = dimensions[d];
      const key = dimension.keys[coords[d]];
      row[code] = key;
      row[`${code}_label`] = dimension.labels[key] ?? key;
    });
    row.value = dataset.value[flatIndex];
    rows.push(row);
  }

  return rows;
}

export function toChartData(rows, xField, groupField, valueField = "value") {
  const xOrder = [];
  const byX = new Map();
  const seriesNamesSeen = new Set();

  rows.forEach((row) => {
    const xLabel = row[`${xField}_label`] ?? row[xField];
    const seriesName = groupField
      ? row[`${groupField}_label`] ?? row[groupField]
      : "value";

    if (!byX.has(xLabel)) {
      byX.set(xLabel, { x: xLabel });
      xOrder.push(xLabel);
    }
    byX.get(xLabel)[seriesName] = row[valueField];
    seriesNamesSeen.add(seriesName);
  });

  return {
    data: xOrder.map((x) => byX.get(x)),
    seriesNames: Array.from(seriesNamesSeen),
  };
}
