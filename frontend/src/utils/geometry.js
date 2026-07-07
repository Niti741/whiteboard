/**
 * Generates an RFC 9562 compliant UUIDv7 string.
 * This is a timestamp-sortable UUID which provides better database index performance.
 */
export function uuidv7() {
  const now = Date.now(); // 48-bit Unix timestamp in ms
  const timeHex = now.toString(16).padStart(12, '0');
  
  // 12-bit random for the "7xxx" section
  const r1 = Math.floor(Math.random() * 0x1000).toString(16).padStart(3, '0');
  
  // 62-bit random (variant + randomness)
  const variant = (8 + Math.floor(Math.random() * 4)).toString(16); // Must start with 8, 9, a, or b
  const r2 = Math.floor(Math.random() * 0x1000).toString(16).padStart(3, '0');
  const r3 = Math.floor(Math.random() * 0x100000000).toString(16).padStart(8, '0');
  
  return `${timeHex.slice(0, 8)}-${timeHex.slice(8, 12)}-7${r1}-${variant}${r2}-${r3}`;
}

/**
 * Calculates Euclidean distance between two points.
 */
export function getDistance(p1, p2) {
  return Math.hypot(p2.x - p1.x, p2.y - p1.y);
}

/**
 * Checks if point (px, py) is within `maxDistance` of a line segment from (x1, y1) to (x2, y2).
 */
export function isPointNearLine(px, py, x1, y1, x2, y2, maxDistance = 6) {
  const A = px - x1;
  const B = py - y1;
  const C = x2 - x1;
  const D = y2 - y1;

  const dot = A * C + B * D;
  const lenSq = C * C + D * D;
  let param = -1;

  if (lenSq !== 0) {
    param = dot / lenSq;
  }

  let xx, yy;

  if (param < 0) {
    xx = x1;
    yy = y1;
  } else if (param > 1) {
    xx = x2;
    yy = y2;
  } else {
    xx = x1 + param * C;
    yy = y1 + param * D;
  }

  const dx = px - xx;
  const dy = py - yy;
  return Math.hypot(dx, dy) < maxDistance;
}

/**
 * Checks if point (px, py) is inside a rectangle.
 */
export function isPointInRect(px, py, rx, ry, rw, rh) {
  const left = Math.min(rx, rx + rw);
  const right = Math.max(rx, rx + rw);
  const top = Math.min(ry, ry + rh);
  const bottom = Math.max(ry, ry + rh);
  return px >= left && px <= right && py >= top && py <= bottom;
}

/**
 * Checks if point (px, py) is near the border of a rectangle.
 */
export function isPointNearRectBorder(px, py, rx, ry, rw, rh, maxDistance = 6) {
  const left = Math.min(rx, rx + rw);
  const right = Math.max(rx, rx + rw);
  const top = Math.min(ry, ry + rh);
  const bottom = Math.max(ry, ry + rh);

  // Check proximity to all 4 edges
  const nearLeft = isPointNearLine(px, py, left, top, left, bottom, maxDistance);
  const nearRight = isPointNearLine(px, py, right, top, right, bottom, maxDistance);
  const nearTop = isPointNearLine(px, py, left, top, right, top, maxDistance);
  const nearBottom = isPointNearLine(px, py, left, bottom, right, bottom, maxDistance);

  return nearLeft || nearRight || nearTop || nearBottom;
}

/**
 * Checks if point (px, py) is near/inside a circle.
 */
export function isPointNearCircle(px, py, cx, cy, r, maxDistance = 6) {
  const dist = Math.hypot(px - cx, py - cy);
  return Math.abs(dist - r) < maxDistance || dist < r;
}

/**
 * Checks if point (px, py) is near a freehand stroke path.
 */
export function isPointNearPath(px, py, points, maxDistance = 6) {
  if (points.length < 2) return false;
  for (let i = 0; i < points.length - 1; i++) {
    if (isPointNearLine(px, py, points[i].x, points[i].y, points[i + 1].x, points[i + 1].y, maxDistance)) {
      return true;
    }
  }
  return false;
}

/**
 * Determines if point (px, py) intersects with a given element.
 */
export function isPointNearElement(px, py, element, maxDistance = 6) {
  const { type, x, y, width, height, points, size } = element;
  const hoverDist = maxDistance + size / 2;

  switch (type) {
    case 'pencil':
    case 'highlighter':
    case 'eraser':
      return isPointNearPath(px, py, points, hoverDist);
    case 'rectangle':
    case 'triangle':
    case 'diamond':
      // If it's filled, clicking inside counts. Otherwise, only near border.
      if (element.fillColor && element.fillColor !== 'transparent') {
        return isPointInRect(px, py, x, y, width, height);
      }
      return isPointNearRectBorder(px, py, x, y, width, height, hoverDist);
    case 'sticky':
      return isPointInRect(px, py, x, y, width, height);
    case 'circle': {
      const radius = Math.min(Math.abs(width), Math.abs(height)) / 2;
      const cx = x + width / 2;
      const cy = y + height / 2;
      if (element.fillColor && element.fillColor !== 'transparent') {
        return Math.hypot(px - cx, py - cy) <= radius;
      }
      return isPointNearCircle(px, py, cx, cy, radius, hoverDist);
    }
    case 'line':
      return isPointNearLine(px, py, x, y, x + width, y + height, hoverDist);
    case 'arrow':
      return isPointNearLine(px, py, x, y, x + width, y + height, hoverDist);
    case 'text':
    case 'image':
      return isPointInRect(px, py, x, y, width, height);
    default:
      return false;
  }
}

/**
 * Helper to check if an element is visible in the current viewport bounds.
 * Views represent bounding boxes: minX, minY, maxX, maxY.
 */
export function isElementInViewport(element, minX, minY, maxX, maxY) {
  const { type, x, y, width, height, points } = element;
  
  if (type === 'freehand' || type === 'highlighter' || type === 'eraser') {
    if (!points || points.length === 0) return false;
    // Calculate bounding box of path
    let pMinX = Infinity, pMinY = Infinity, pMaxX = -Infinity, pMaxY = -Infinity;
    for (const p of points) {
      if (p.x < pMinX) pMinX = p.x;
      if (p.y < pMinY) pMinY = p.y;
      if (p.x > pMaxX) pMaxX = p.x;
      if (p.y > pMaxY) pMaxY = p.y;
    }
    return !(pMaxX < minX || pMinX > maxX || pMaxY < minY || pMinY > maxY);
  }
  
  // Bounding box for shapes/elements
  const elMinX = Math.min(x, x + width);
  const elMaxX = Math.max(x, x + width);
  const elMinY = Math.min(y, y + height);
  const elMaxY = Math.max(y, y + height);
  
  return !(elMaxX < minX || elMinX > maxX || elMaxY < minY || elMinY > maxY);
}

/**
 * Draws an arrowhead on a canvas.
 */
export function drawArrowhead(ctx, fromX, fromY, toX, toY, size = 12, color = '#000000', strokeWidth = 2) {
  const angle = Math.atan2(toY - fromY, toX - fromX);
  
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = strokeWidth;
  ctx.lineJoin = 'miter';
  
  // Translate to end of line
  ctx.translate(toX, toY);
  ctx.rotate(angle);
  
  // Draw arrow shape
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(-size, -size / 2);
  ctx.lineTo(-size * 0.7, 0); // Subtle curve inwards
  ctx.lineTo(-size, size / 2);
  ctx.closePath();
  
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}
