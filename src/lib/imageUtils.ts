/**
 * Compresses an image file and converts it to JPG format
 * @param file - The original image file
 * @param maxWidth - Maximum width for the compressed image (default: 1920)
 * @param quality - Compression quality 0-1 (default: 0.85)
 * @returns Compressed image as a Blob
 */
export const compressAndConvertToJpg = async (
  file: File | Blob,
  maxWidth: number = 1920,
  quality: number = 0.85
): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      reject(new Error('Failed to get canvas context'));
      return;
    }

    img.onload = () => {
      // Calculate new dimensions while maintaining aspect ratio
      let width = img.width;
      let height = img.height;

      if (width > maxWidth) {
        height = (height * maxWidth) / width;
        width = maxWidth;
      }

      // Set canvas size
      canvas.width = width;
      canvas.height = height;

      // Draw and compress image
      ctx.drawImage(img, 0, 0, width, height);

      // Convert to blob (JPG format)
      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('Failed to compress image'));
          }
        },
        'image/jpeg',
        quality
      );
    };

    img.onerror = () => {
      reject(new Error('Failed to load image'));
    };

    // Load the image
    const reader = new FileReader();
    reader.onload = (e) => {
      img.src = e.target?.result as string;
    };
    reader.onerror = () => {
      reject(new Error('Failed to read file'));
    };
    reader.readAsDataURL(file);
  });
};

/**
 * Extracts the storage path from a Supabase public URL
 * @param publicUrl - The public URL from Supabase storage
 * @param bucketName - The name of the storage bucket
 * @returns The storage path (e.g., "user-id/filename.jpg")
 */
export const extractStoragePath = (publicUrl: string, bucketName: string): string => {
  const parts = publicUrl.split(`/${bucketName}/`);
  return parts[1] || '';
};
