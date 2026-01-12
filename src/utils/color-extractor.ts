// Color extractor - Extract dominant color from image for auto background

/**
 * Extract the dominant/average color from an image URL
 * Samples pixels from the edges of the image for better background matching
 */
export async function extractDominantColor(imageUrl: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve('#808080'); // Fallback gray
          return;
        }

        // Use a small sample size for performance
        const sampleSize = Math.min(img.width, img.height, 100);
        canvas.width = sampleSize;
        canvas.height = sampleSize;

        // Draw scaled image
        ctx.drawImage(img, 0, 0, sampleSize, sampleSize);

        // Sample pixels from edges (top, bottom, left, right borders)
        const edgeWidth = Math.max(1, Math.floor(sampleSize * 0.1)); // 10% border
        const pixels: { r: number; g: number; b: number }[] = [];

        const imageData = ctx.getImageData(0, 0, sampleSize, sampleSize);
        const data = imageData.data;

        // Sample from top edge
        for (let y = 0; y < edgeWidth; y++) {
          for (let x = 0; x < sampleSize; x++) {
            const i = (y * sampleSize + x) * 4;
            pixels.push({ r: data[i], g: data[i + 1], b: data[i + 2] });
          }
        }

        // Sample from bottom edge
        for (let y = sampleSize - edgeWidth; y < sampleSize; y++) {
          for (let x = 0; x < sampleSize; x++) {
            const i = (y * sampleSize + x) * 4;
            pixels.push({ r: data[i], g: data[i + 1], b: data[i + 2] });
          }
        }

        // Sample from left edge
        for (let y = edgeWidth; y < sampleSize - edgeWidth; y++) {
          for (let x = 0; x < edgeWidth; x++) {
            const i = (y * sampleSize + x) * 4;
            pixels.push({ r: data[i], g: data[i + 1], b: data[i + 2] });
          }
        }

        // Sample from right edge
        for (let y = edgeWidth; y < sampleSize - edgeWidth; y++) {
          for (let x = sampleSize - edgeWidth; x < sampleSize; x++) {
            const i = (y * sampleSize + x) * 4;
            pixels.push({ r: data[i], g: data[i + 1], b: data[i + 2] });
          }
        }

        if (pixels.length === 0) {
          resolve('#808080');
          return;
        }

        // Calculate average color
        const avgR = Math.round(pixels.reduce((sum, p) => sum + p.r, 0) / pixels.length);
        const avgG = Math.round(pixels.reduce((sum, p) => sum + p.g, 0) / pixels.length);
        const avgB = Math.round(pixels.reduce((sum, p) => sum + p.b, 0) / pixels.length);

        // Convert to hex
        const toHex = (n: number) => n.toString(16).padStart(2, '0');
        const hexColor = `#${toHex(avgR)}${toHex(avgG)}${toHex(avgB)}`;

        resolve(hexColor);
      } catch {
        resolve('#808080'); // Fallback gray
      }
    };

    img.onerror = () => {
      reject(new Error('Failed to load image'));
    };

    img.src = imageUrl;
  });
}

/**
 * Lighten or darken a hex color
 */
export function adjustColorBrightness(hex: string, percent: number): string {
  const num = parseInt(hex.replace('#', ''), 16);
  const amt = Math.round(2.55 * percent);
  const R = Math.min(255, Math.max(0, (num >> 16) + amt));
  const G = Math.min(255, Math.max(0, ((num >> 8) & 0x00ff) + amt));
  const B = Math.min(255, Math.max(0, (num & 0x0000ff) + amt));
  return `#${((1 << 24) + (R << 16) + (G << 8) + B).toString(16).slice(1)}`;
}
