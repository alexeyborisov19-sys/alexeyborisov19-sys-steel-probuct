/** Camera-only input helpers; never alter manufacturing geometry. */
export function clampCadZoom(zoom: number): number {
  return Math.max(0.35, Math.min(4, zoom));
}
export function pinchCadZoom(zoom: number, previousDistance: number, distance: number): number {
  if (![zoom, previousDistance, distance].every(Number.isFinite) || previousDistance <= 0 || distance <= 0) return zoom;
  return clampCadZoom(zoom * previousDistance / distance);
}
