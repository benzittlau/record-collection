// Estimate only the untraced sleeves. Real photographic outlines and folded
// edges take precedence, while every sleeve retains its physical box position.
export function layoutSpines(
  records,
  face,
  traced = new Map(),
  foldedPositions = () => [],
) {
  const [topLeft, topRight, bottomRight, bottomLeft] = face;
  const interpolate = (start, end, fraction) => [
    start[0] + (end[0] - start[0]) * fraction,
    start[1] + (end[1] - start[1]) * fraction,
  ];
  const compartmentCount = records[0]?.compartmentCount || 3;
  const compartmentOf = (record) =>
    (record.compartment ||
      Math.min(
        compartmentCount,
        Math.floor(
          (record.position - 1) / (records.length / compartmentCount),
        ) + 1,
      )) - 1;
  const weightOf = (record) =>
    record.spineWidth || (record.kind === "book" ? 4 : 1);
  const weights = Array(compartmentCount).fill(0);
  const offsets = Array(compartmentCount).fill(0);
  for (const record of records)
    weights[compartmentOf(record)] += weightOf(record);

  return records.map((record) => {
    const compartment = compartmentOf(record);
    const offset = offsets[compartment];
    const weight = weightOf(record);
    const totalWeight = weights[compartment] || 1;
    offsets[compartment] += weight;
    const compartmentStart = compartment / compartmentCount + 0.009;
    const availableWidth = 1 / compartmentCount - 0.018;
    const left = compartmentStart + (offset / totalWeight) * availableWidth;
    const right =
      compartmentStart + ((offset + weight) / totalWeight) * availableWidth;
    const outline = traced.get(record.id);
    const polygon = outline?.polygon ?? [
      interpolate(topLeft, topRight, left),
      interpolate(topLeft, topRight, right),
      interpolate(bottomLeft, bottomRight, right),
      interpolate(bottomLeft, bottomRight, left),
    ];
    const anchor = outline?.anchor ?? [
      (polygon[2][0] + polygon[3][0]) / 2,
      (polygon[2][1] + polygon[3][1]) / 2,
    ];
    const folds = foldedPositions(record.id)
      .map((source) => traced.get(source.id)?.polygon)
      .filter(Boolean);
    return {
      record,
      polygons: [polygon, ...folds],
      anchor,
      source: outline ? "photo" : "estimated",
    };
  });
}
