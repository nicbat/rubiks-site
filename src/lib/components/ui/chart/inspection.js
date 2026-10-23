// Domain paths use logical 350-unit coordinates, including their axis margins.
export function nearestChartItem(items, x) {
  if (!items.length || !Number.isFinite(x)) return null;
  return items.reduce((nearest, item) =>
    Math.abs(item.x - x) < Math.abs(nearest.x - x) ? item : nearest,
  );
}

// Fixed pixel axis margins keep labels readable while the plot fills its panel.
export const chartX = (x, width) => 44 + ((x - 35) / 280) * (width - 60);
export const chartCoordinate = (x, width) =>
  35 + ((x - 44) / (width - 60)) * 280;

export function chartPath(path, width) {
  return path.replace(
    /([ML])([\d.]+),/g,
    (_, command, value) => `${command}${chartX(Number(value), width)},`,
  );
}
