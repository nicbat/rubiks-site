// Coordinates use the shared 350-unit SVG viewBox, including its axis margins.
export function nearestChartItem(items, x) {
  if (!items.length || !Number.isFinite(x)) return null;
  return items.reduce((nearest, item) =>
    Math.abs(item.x - x) < Math.abs(nearest.x - x) ? item : nearest,
  );
}
