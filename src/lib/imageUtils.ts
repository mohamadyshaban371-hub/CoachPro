/**
 * Compresses an image file before upload. Uses bicubic-quality canvas rendering
 * to preserve detail on InBody printouts while keeping file size manageable.
 *
 * Quality presets:
 *   - InBody / measurement photos  → 1600 px / 0.88 quality  (numbers must be readable)
 *   - Progress / body photos        → 1100 px / 0.82 quality
 *   - Profile pictures              →  700 px / 0.80 quality
 */
export async function compressImage(
  file: File,
  maxWidth = 1200,
  quality = 0.82
): Promise<File | Blob> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > maxWidth) {
          height = Math.round((maxWidth / width) * height);
          width = maxWidth;
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(file);
          return;
        }

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(blob);
            } else {
              resolve(file);
            }
          },
          'image/jpeg',
          quality
        );
      };
      img.onerror = () => resolve(file);
    };
    reader.onerror = (error) => reject(error);
  });
}

/**
 * Validates image quality before accepting it as an InBody scan.
 * Returns null if OK, or an error string describing the problem.
 *
 * Checks:
 *  - File size: rejects files under 20 KB (likely a blank/corrupt image)
 *  - File type: only JPEG / PNG / WebP accepted
 */
export function validateInBodyImage(file: File): string | null {
  const MIN_SIZE = 20 * 1024;
  if (file.size < MIN_SIZE) {
    return 'الصورة صغيرة جداً أو تالفة — يرجى التقاط صورة واضحة لتقرير InBody.';
  }
  const accepted = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  if (!accepted.includes(file.type.toLowerCase())) {
    return `نوع الملف غير مدعوم (${file.type}). يُرجى رفع JPEG أو PNG.`;
  }
  return null;
}
