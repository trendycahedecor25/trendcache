// Line detection: a pixel is a "line" only if ALL channels are dark
const LINE_THRESHOLD = 80;
// How similar a pixel must be to the start pixel to be filled
const FILL_TOLERANCE = 50;

function isLinePx(r, g, b) {
  return r < LINE_THRESHOLD && g < LINE_THRESHOLD && b < LINE_THRESHOLD;
}

export function floodFill(imageData, startX, startY, fillColor, width, height) {
  const data = imageData.data;
  const idx = (x, y) => (y * width + x) * 4;

  const si = idx(startX, startY);
  const startR = data[si];
  const startG = data[si + 1];
  const startB = data[si + 2];

  // Don't fill if clicking on a black line
  if (isLinePx(startR, startG, startB)) return;

  // Parse fill color
  const fr = parseInt(fillColor.slice(1, 3), 16);
  const fg = parseInt(fillColor.slice(3, 5), 16);
  const fb = parseInt(fillColor.slice(5, 7), 16);

  // Don't fill if already the target color
  if (Math.abs(startR - fr) < 10 && Math.abs(startG - fg) < 10 && Math.abs(startB - fb) < 10) return;

  const canFill = (i) => {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    if (isLinePx(r, g, b)) return false;
    const dr = Math.abs(r - startR);
    const dg = Math.abs(g - startG);
    const db = Math.abs(b - startB);
    return dr < FILL_TOLERANCE && dg < FILL_TOLERANCE && db < FILL_TOLERANCE;
  };

  const visited = new Uint8Array(width * height);
  const queue = [[startX, startY]];
  visited[startY * width + startX] = 1;

  while (queue.length > 0) {
    const [x, y] = queue.shift();
    const i = idx(x, y);

    data[i] = fr;
    data[i + 1] = fg;
    data[i + 2] = fb;
    data[i + 3] = 255;

    const neighbors = [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]];
    for (const [nx, ny] of neighbors) {
      if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
      const vi = ny * width + nx;
      if (visited[vi]) continue;
      visited[vi] = 1;
      const ni = idx(nx, ny);
      if (canFill(ni)) {
        queue.push([nx, ny]);
      }
    }
  }
}
