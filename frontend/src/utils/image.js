/**
 * Converts an image file to a compressed WebP base64 data URL.
 * Resizes the image so that the longest side is a maximum of 1920px.
 * Compresses to 80% quality and rejects files that exceed 2MB.
 * 
 * @param {File} file - The raw image File object
 * @returns {Promise<{dataUrl: string, width: number, height: number}>}
 */
export function compressImage(file) {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      return reject(new Error('Selected file is not an image.'));
    }

    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      
      img.onload = () => {
        let width = img.width;
        let height = img.height;
        const maxSide = 1920;

        // Resize calculation
        if (width > maxSide || height > maxSide) {
          if (width > height) {
            height = Math.round((height * maxSide) / width);
            width = maxSide;
          } else {
            width = Math.round((width * maxSide) / height);
            height = maxSide;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        
        if (!ctx) {
          return reject(new Error('Failed to get 2D context for image compression.'));
        }

        // Draw image onto canvas
        ctx.drawImage(img, 0, 0, width, height);

        // Attempt WebP compilation, fallback to JPEG if WebP is not supported by the browser
        let dataUrl = '';
        try {
          dataUrl = canvas.toDataURL('image/webp', 0.8);
          // If browser does not support WebP, it returns image/png by default or fails
          if (!dataUrl.startsWith('data:image/webp')) {
            dataUrl = canvas.toDataURL('image/jpeg', 0.8);
          }
        } catch (e) {
          dataUrl = canvas.toDataURL('image/jpeg', 0.8);
        }

        // Calculate size of base64 string
        // Base64 size formula: (stringLength * 3) / 4 - paddingCount
        const base64Length = dataUrl.split(',')[1].length;
        const approxSizeInBytes = (base64Length * 3) / 4;
        const limitInBytes = 2 * 1024 * 1024; // 2MB

        if (approxSizeInBytes > limitInBytes) {
          return reject(new Error(`Compressed image is too large (${(approxSizeInBytes / (1024 * 1024)).toFixed(2)}MB). The limit is 2MB.`));
        }

        resolve({
          dataUrl,
          width,
          height
        });
      };

      img.onerror = () => {
        reject(new Error('Failed to load image file.'));
      };
    };

    reader.onerror = () => {
      reject(new Error('Failed to read image file.'));
    };
  });
}
