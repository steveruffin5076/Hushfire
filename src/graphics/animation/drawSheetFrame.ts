/** Draw one cell from a horizontal/row strip with pivot anchored at world origin. */
export function drawSheetFrame(
  ctx: CanvasRenderingContext2D,
  image: CanvasImageSource,
  frameIndex: number,
  cellW: number,
  cellH: number,
  row: number,
  pivot: [number, number],
  drawSilhouetteWidth: number,
  referenceCellW: number,
  angle: number,
  cx: number,
  cy: number
) {
  const scale = drawSilhouetteWidth / referenceCellW;
  const sx = frameIndex * cellW;
  const sy = row * cellH;
  const dw = cellW * scale;
  const dh = cellH * scale;
  const ox = -pivot[0] * scale;
  const oy = -pivot[1] * scale;

  ctx.save();
  ctx.translate(cx, cy);
  if (angle) ctx.rotate(angle);
  ctx.drawImage(image, sx, sy, cellW, cellH, ox, oy, dw, dh);
  ctx.restore();
}
