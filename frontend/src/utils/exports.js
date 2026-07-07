import { jsPDF } from 'jspdf';
import { drawArrowhead } from './geometry';

/**
 * Draws a single element onto a 2D canvas context.
 * Shared by both the main rendering canvas and the PNG/PDF exporters.
 */
export function drawCanvasElement(ctx, element) {
  const { type, x, y, width, height, points, color, fillColor, size, text, imageUrl } = element;

  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = fillColor || 'transparent';
  ctx.lineWidth = size;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  switch (type) {
    case 'pencil':
      if (!points || points.length === 0) break;
      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      for (let i = 1; i < points.length; i++) {
        ctx.lineTo(points[i].x, points[i].y);
      }
      ctx.stroke();
      break;

    case 'highlighter':
      if (!points || points.length === 0) break;
      ctx.save();
      ctx.globalAlpha = 0.4;
      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      for (let i = 1; i < points.length; i++) {
        ctx.lineTo(points[i].x, points[i].y);
      }
      ctx.stroke();
      ctx.restore();
      break;

    case 'eraser':
      if (!points || points.length === 0) break;
      ctx.save();
      // On collaborative boards with an infinite canvas, we use destination-out
      // to cut holes in whatever lies underneath (making them transparent)
      ctx.globalCompositeOperation = 'destination-out';
      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      for (let i = 1; i < points.length; i++) {
        ctx.lineTo(points[i].x, points[i].y);
      }
      ctx.stroke();
      ctx.restore();
      break;

    case 'rectangle':
      ctx.beginPath();
      ctx.rect(x, y, width, height);
      if (fillColor && fillColor !== 'transparent') {
        ctx.fill();
      }
      ctx.stroke();
      break;

    case 'circle': {
      ctx.beginPath();
      const radius = Math.min(Math.abs(width), Math.abs(height)) / 2;
      const cx = x + width / 2;
      const cy = y + height / 2;
      ctx.arc(cx, cy, radius, 0, 2 * Math.PI);
      if (fillColor && fillColor !== 'transparent') {
        ctx.fill();
      }
      ctx.stroke();
      break;
    }

    case 'triangle':
      ctx.beginPath();
      ctx.moveTo(x + width / 2, y); // Top peak
      ctx.lineTo(x + width, y + height); // Bottom right
      ctx.lineTo(x, y + height); // Bottom left
      ctx.closePath();
      if (fillColor && fillColor !== 'transparent') {
        ctx.fill();
      }
      ctx.stroke();
      break;

    case 'diamond':
      ctx.beginPath();
      ctx.moveTo(x + width / 2, y); // Top peak
      ctx.lineTo(x + width, y + height / 2); // Right corner
      ctx.lineTo(x + width / 2, y + height); // Bottom peak
      ctx.lineTo(x, y + height / 2); // Left corner
      ctx.closePath();
      if (fillColor && fillColor !== 'transparent') {
        ctx.fill();
      }
      ctx.stroke();
      break;

    case 'sticky': {
      ctx.save();
      // Draw sticky note body
      ctx.beginPath();
      ctx.rect(x, y, width, height);
      // Soft sticky note background matching the fillColor, defaulting to warm yellow (#FEF08A)
      const noteColor = (fillColor && fillColor !== 'transparent') ? fillColor : '#FEF08A';
      ctx.fillStyle = noteColor;
      // Slight shadow
      ctx.shadowColor = 'rgba(0, 0, 0, 0.15)';
      ctx.shadowBlur = 8;
      ctx.shadowOffsetX = 3;
      ctx.shadowOffsetY = 3;
      ctx.fill();
      ctx.restore();
      
      // Draw note border
      ctx.save();
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.12)';
      ctx.lineWidth = 1;
      ctx.strokeRect(x, y, width, height);
      ctx.restore();

      // Render text inside sticky note centered
      if (text) {
        ctx.save();
        ctx.fillStyle = '#1E293B'; // Dark slate text for note
        ctx.font = `bold ${Math.max(12, size * 3.5 + 11)}px Inter, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        const lines = text.split('\n');
        const fontSize = Math.max(12, size * 3.5 + 11);
        const lineHeight = fontSize + 4;
        const totalHeight = lines.length * lineHeight;
        const startY = y + height / 2 - totalHeight / 2 + lineHeight / 2;
        
        for (let i = 0; i < lines.length; i++) {
          // Clip text horizontally to fit width
          let renderText = lines[i];
          const textWidth = ctx.measureText(renderText).width;
          if (textWidth > width - 16) {
            // Truncate text if it overflows sticky note width
            while (renderText.length > 0 && ctx.measureText(renderText + '...').width > width - 16) {
              renderText = renderText.slice(0, -1);
            }
            renderText += '...';
          }
          ctx.fillText(renderText, x + width / 2, startY + i * lineHeight);
        }
        ctx.restore();
      }
      break;
    }

    case 'line':
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + width, y + height);
      ctx.stroke();
      break;

    case 'arrow':
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + width, y + height);
      ctx.stroke();
      // Draw arrowhead at the end (toX, toY)
      drawArrowhead(ctx, x, y, x + width, y + height, size * 5 + 6, color, size);
      break;

    case 'text':
      if (!text) break;
      ctx.save();
      ctx.fillStyle = color;
      ctx.font = `${size * 4 + 14}px Inter, sans-serif`;
      ctx.textBaseline = 'top';
      
      // Handle multi-line texts
      const lines = text.split('\n');
      const lineHeight = size * 4 + 20;
      for (let i = 0; i < lines.length; i++) {
        ctx.fillText(lines[i], x, y + i * lineHeight);
      }
      ctx.restore();
      break;

    case 'image':
      if (!imageUrl) break;
      ctx.save();
      try {
        const img = new Image();
        img.src = imageUrl;
        if (img.complete) {
          ctx.drawImage(img, x, y, width, height);
        } else {
          // If image is still loading asynchronously, bind draw to onload
          img.onload = () => {
            // Need a way to redraw, which happens naturally on cursor moves or subsequent paints.
            // But we draw it immediately if it loads in time.
          };
        }
      } catch (err) {
        console.error('Error drawing image element:', err);
      }
      ctx.restore();
      break;
  }

  ctx.restore();
}

/**
 * Calculates the bounding box of a list of canvas elements.
 */
function getCanvasBoundingBox(elements, padding = 50) {
  if (!elements || elements.length === 0) {
    return { minX: 0, minY: 0, maxX: 800, maxY: 600, width: 800, height: 600 };
  }

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

  elements.forEach(el => {
    if (el.type === 'pencil' || el.type === 'highlighter' || el.type === 'eraser') {
      el.points.forEach(p => {
        if (p.x < minX) minX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.x > maxX) maxX = p.x;
        if (p.y > maxY) maxY = p.y;
      });
    } else {
      const x1 = el.x;
      const y1 = el.y;
      const x2 = el.x + el.width;
      const y2 = el.y + el.height;

      const left = Math.min(x1, x2);
      const right = Math.max(x1, x2);
      const top = Math.min(y1, y2);
      const bottom = Math.max(y1, y2);

      if (left < minX) minX = left;
      if (top < minY) minY = top;
      if (right > maxX) maxX = right;
      if (bottom > maxY) maxY = bottom;
    }
  });

  // Apply padding
  minX -= padding;
  minY -= padding;
  maxX += padding;
  maxY += padding;

  return {
    minX,
    minY,
    maxX,
    maxY,
    width: maxX - minX,
    height: maxY - minY
  };
}

/**
 * Generates PNG data URL of current whiteboard elements.
 */
export function getPNGDataUrl(elements, isDarkMode = false, padding = 40) {
  const { minX, minY, width, height } = getCanvasBoundingBox(elements, padding);
  
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  if (!ctx) return null;

  // Background fill
  ctx.fillStyle = isDarkMode ? '#0f172a' : '#ffffff';
  ctx.fillRect(0, 0, width, height);

  // Set drawing context origin
  ctx.save();
  ctx.translate(-minX, -minY);

  // Render elements in order
  elements.forEach(el => {
    // Treat eraser as background color stroke during static PNG export
    if (el.type === 'eraser') {
      const origColor = el.color;
      el.color = isDarkMode ? '#0f172a' : '#ffffff';
      drawCanvasElement(ctx, el);
      el.color = origColor;
    } else {
      drawCanvasElement(ctx, el);
    }
  });

  ctx.restore();
  return canvas.toDataURL('image/png');
}

/**
 * Triggers a PNG download of the canvas.
 */
export function exportToPNG(elements, roomId, isDarkMode = false) {
  const dataUrl = getPNGDataUrl(elements, isDarkMode);
  if (!dataUrl) return;

  const link = document.createElement('a');
  link.download = `whiteboard-${roomId || 'default'}-${Date.now()}.png`;
  link.href = dataUrl;
  link.click();
}

/**
 * Exports elements as vector SVG file.
 */
export function exportToSVG(elements, roomId, isDarkMode = false) {
  const padding = 40;
  const { minX, minY, width, height } = getCanvasBoundingBox(elements, padding);
  
  let svgContent = `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="${minX} ${minY} ${width} ${height}" width="${width}" height="${height}">
  <!-- Background -->
  <rect x="${minX}" y="${minY}" width="${width}" height="${height}" fill="${isDarkMode ? '#0f172a' : '#ffffff'}" />
  
  <g>
`;

  elements.forEach(el => {
    const strokeColor = el.type === 'eraser' ? (isDarkMode ? '#0f172a' : '#ffffff') : el.color;
    const strokeWidth = el.size;
    const fill = el.fillColor || 'transparent';

    switch (el.type) {
      case 'pencil':
      case 'highlighter':
      case 'eraser': {
        if (!el.points || el.points.length === 0) break;
        let d = `M ${el.points[0].x} ${el.points[0].y}`;
        for (let i = 1; i < el.points.length; i++) {
          d += ` L ${el.points[i].x} ${el.points[i].y}`;
        }
        const opacity = el.type === 'highlighter' ? '0.4' : '1.0';
        svgContent += `    <path d="${d}" stroke="${strokeColor}" stroke-width="${strokeWidth}" fill="none" stroke-linecap="round" stroke-linejoin="round" opacity="${opacity}" />\n`;
        break;
      }
      case 'rectangle': {
        svgContent += `    <rect x="${el.x}" y="${el.y}" width="${el.width}" height="${el.height}" stroke="${strokeColor}" stroke-width="${strokeWidth}" fill="${fill}" stroke-linecap="round" stroke-linejoin="round" />\n`;
        break;
      }
      case 'circle': {
        const radius = Math.min(Math.abs(el.width), Math.abs(el.height)) / 2;
        const cx = el.x + el.width / 2;
        const cy = el.y + el.height / 2;
        svgContent += `    <circle cx="${cx}" cy="${cy}" r="${radius}" stroke="${strokeColor}" stroke-width="${strokeWidth}" fill="${fill}" />\n`;
        break;
      }
      case 'triangle': {
        const x1 = el.x + el.width / 2;
        const y1 = el.y;
        const x2 = el.x + el.width;
        const y2 = el.y + el.height;
        const x3 = el.x;
        const y3 = el.y + el.height;
        svgContent += `    <polygon points="${x1},${y1} ${x2},${y2} ${x3},${y3}" stroke="${strokeColor}" stroke-width="${strokeWidth}" fill="${fill}" stroke-linecap="round" stroke-linejoin="round" />\n`;
        break;
      }
      case 'diamond': {
        const x1 = el.x + el.width / 2;
        const y1 = el.y;
        const x2 = el.x + el.width;
        const y2 = el.y + el.height / 2;
        const x3 = el.x + el.width / 2;
        const y3 = el.y + el.height;
        const x4 = el.x;
        const y4 = el.y + el.height / 2;
        svgContent += `    <polygon points="${x1},${y1} ${x2},${y2} ${x3},${y3} ${x4},${y4}" stroke="${strokeColor}" stroke-width="${strokeWidth}" fill="${fill}" stroke-linecap="round" stroke-linejoin="round" />\n`;
        break;
      }
      case 'sticky': {
        const noteColor = (el.fillColor && el.fillColor !== 'transparent') ? el.fillColor : '#FEF08A';
        svgContent += `    <rect x="${el.x}" y="${el.y}" width="${el.width}" height="${el.height}" stroke="rgba(0, 0, 0, 0.12)" stroke-width="1" fill="${noteColor}" rx="4" />\n`;
        if (el.text) {
          const lines = el.text.split('\n');
          const fontSize = Math.max(12, el.size * 3.5 + 11);
          const lineHeight = fontSize + 4;
          const totalHeight = lines.length * lineHeight;
          const startY = el.y + el.height / 2 - totalHeight / 2 + lineHeight / 2;
          
          lines.forEach((lineText, index) => {
            const escapedText = lineText
              .replace(/&/g, '&amp;')
              .replace(/</g, '&lt;')
              .replace(/>/g, '&gt;')
              .replace(/"/g, '&quot;')
              .replace(/'/g, '&apos;');
            svgContent += `    <text x="${el.x + el.width / 2}" y="${startY + index * lineHeight + fontSize / 2}" font-family="Inter, sans-serif" font-size="${fontSize}" font-weight="bold" fill="#1E293B" text-anchor="middle" dominant-baseline="middle">${escapedText}</text>\n`;
          });
        }
        break;
      }
      case 'line': {
        svgContent += `    <line x1="${el.x}" y1="${el.y}" x2="${el.x + el.width}" y2="${el.y + el.height}" stroke="${strokeColor}" stroke-width="${strokeWidth}" stroke-linecap="round" />\n`;
        break;
      }
      case 'arrow': {
        // Draw main line
        svgContent += `    <line x1="${el.x}" y1="${el.y}" x2="${el.x + el.width}" y2="${el.y + el.height}" stroke="${strokeColor}" stroke-width="${strokeWidth}" stroke-linecap="round" />\n`;
        
        // Draw SVG arrowhead polygon
        const toX = el.x + el.width;
        const toY = el.y + el.height;
        const angle = Math.atan2(el.height, el.width);
        const headSize = el.size * 5 + 6;
        
        // Vertices relative to end point
        const p1x = toX - headSize * Math.cos(angle - Math.PI / 6);
        const p1y = toY - headSize * Math.sin(angle - Math.PI / 6);
        const p2x = toX - headSize * Math.cos(angle + Math.PI / 6);
        const p2y = toY - headSize * Math.sin(angle + Math.PI / 6);
        
        svgContent += `    <polygon points="${toX},${toY} ${p1x},${p1y} ${p2x},${p2y}" fill="${strokeColor}" stroke="${strokeColor}" stroke-width="1" />\n`;
        break;
      }
      case 'text': {
        if (!el.text) break;
        const lines = el.text.split('\n');
        const fontSize = el.size * 4 + 14;
        const lineHeight = fontSize + 6;
        lines.forEach((lineText, index) => {
          // Escape HTML characters
          const escapedText = lineText
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&apos;');
          svgContent += `    <text x="${el.x}" y="${el.y + index * lineHeight + fontSize}" font-family="Inter, sans-serif" font-size="${fontSize}" fill="${strokeColor}">${escapedText}</text>\n`;
        });
        break;
      }
      case 'image': {
        if (!el.imageUrl) break;
        svgContent += `    <image href="${el.imageUrl}" x="${el.x}" y="${el.y}" width="${el.width}" height="${el.height}" />\n`;
        break;
      }
    }
  });

  svgContent += `  </g>
</svg>`;

  const blob = new Blob([svgContent], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.download = `whiteboard-${roomId || 'default'}-${Date.now()}.svg`;
  link.href = url;
  link.click();
  URL.revokeObjectURL(url);
}

/**
 * Exports whiteboard to print-ready PDF using jsPDF.
 */
export function exportToPDF(elements, roomId, isDarkMode = false) {
  const padding = 40;
  const { width, height } = getCanvasBoundingBox(elements, padding);
  const pngDataUrl = getPNGDataUrl(elements, isDarkMode, padding);

  if (!pngDataUrl) return;

  // Determine optimal layout based on drawing dimensions
  const orientation = width > height ? 'landscape' : 'portrait';
  
  // A4 dimensions: portrait: 210 x 297 mm, landscape: 297 x 210 mm
  const pdf = new jsPDF({
    orientation: orientation,
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();

  // Fit image to page scale maintaining aspect ratio
  const imgRatio = width / height;
  const pageRatio = pageWidth / pageHeight;

  let printWidth = pageWidth - 20; // 10mm margins
  let printHeight = printWidth / imgRatio;

  if (printHeight > pageHeight - 20) {
    printHeight = pageHeight - 20;
    printWidth = printHeight * imgRatio;
  }

  const posX = (pageWidth - printWidth) / 2;
  const posY = (pageHeight - printHeight) / 2;

  pdf.addImage(pngDataUrl, 'PNG', posX, posY, printWidth, printHeight);
  pdf.save(`whiteboard-${roomId || 'default'}-${Date.now()}.pdf`);
}

/**
 * Downloads elements as JSON file (Backup).
 */
export function exportToJSON(elements, roomId) {
  const backup = {
    app: 'CoDraw Whiteboard',
    version: '1.0.0',
    roomId: roomId || 'default',
    exportedAt: new Date().toISOString(),
    elements: elements
  };

  const jsonStr = JSON.stringify(backup, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.download = `whiteboard-${roomId || 'default'}-${Date.now()}.json`;
  link.href = url;
  link.click();
  URL.revokeObjectURL(url);
}

/**
 * Reads elements from a local JSON backup file.
 */
export function importFromJSON(file) {
  return new Promise((resolve, reject) => {
    if (!file.name.endsWith('.json')) {
      return reject(new Error('Invalid file format. Please select a .json backup file.'));
    }

    const reader = new FileReader();
    reader.readAsText(file);
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target.result);
        if (!data.elements || !Array.isArray(data.elements)) {
          return reject(new Error('Invalid whiteboard backup file structure. Missing "elements" array.'));
        }
        resolve(data.elements);
      } catch (err) {
        reject(new Error('Failed to parse whiteboard backup JSON file.'));
      }
    };
    reader.onerror = () => {
      reject(new Error('Failed to read file.'));
    };
  });
}
