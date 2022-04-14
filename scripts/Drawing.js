// test polygon intersection

export const COLORS = {
  orange: 0xFFA500,
  yellow: 0xFFFF00,
  greenyellow: 0xADFF2F,
  green:0x00FF00,
  blue: 0x0000FF,
  lightblue: 0xADD8E6,
  red: 0xFF0000,
  gray: 0x808080,
  black: 0x000000,
  white: 0xFFFFFF
}

export function drawVertex(v, color = COLORS.red, alpha = 1, radius = 5) {
  canvas.controls.debug
      .beginFill(color, alpha)
      .drawCircle(v.x, v.y, radius)
      .endFill();
}

export function drawEdge(e, color = COLORS.blue, alpha = 1, width = 1) {
  canvas.controls.debug.lineStyle(width, color, alpha).
      moveTo(e.A.x, e.A.y).
      lineTo(e.B.x, e.B.y);
}

export function labelVertex(v, text) {
  if(!canvas.controls.debug.polygonText) {
    canvas.controls.debug.polygonText = canvas.controls.addChild(new PIXI.Container());
  }
  const polygonText = canvas.controls.debug.polygonText;

  // update existing label if it exists at or very near Poly endpoint
  const idx = polygonText.children.findIndex(c => v.x.almostEqual(c.position.x) && v.y.almostEqual(c.position.y));
  if(idx !== -1) { canvas.controls.debug.polygonText.removeChildAt(idx); }

  const t = polygonText.addChild(new PIXI.Text(String(text), CONFIG.canvasTextStyle));
  t.position.set(v.x, v.y);
}

export function clearLabels() { if(canvas.controls.debug.polygonText) { canvas.controls.debug.polygonText.removeChildren(); } }
export function clearDrawings() { canvas.controls.debug.clear(); }

export function drawPolygon(poly, color = COLORS.black) {
  canvas.controls.debug.lineStyle(1, color).drawShape(poly);
}