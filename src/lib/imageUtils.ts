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

export const DOWNLOAD_SIZES = {
  youtube: { width: 1280, height: 720, label: "YouTube ready (1280x720)" },
  full: { width: 2752, height: 1536, label: "Full size (2752x1536)" },
} as const;

export type DownloadSizeKey = keyof typeof DOWNLOAD_SIZES;

type DownloadImageOptions = {
  width: number;
  height: number;
  fileName?: string;
};

/**
 * Converts a data URL (base64) to a Blob
 */
export const dataUrlToBlob = (dataUrl: string): Blob => {
  const arr = dataUrl.split(',');
  const mimeMatch = arr[0].match(/:(.*?);/);
  const mime = mimeMatch ? mimeMatch[1] : 'image/png';
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new Blob([u8arr], { type: mime });
};

/**
 * Checks if a string is a data URL
 */
export const isDataUrl = (url: string): boolean => {
  return url.startsWith('data:');
};

/**
 * Uploads a data URL image to Supabase storage and returns the public URL
 * @param dataUrl - The data URL to upload
 * @param supabase - The Supabase client instance
 * @param userId - The user ID for the storage path
 * @param bucket - The storage bucket name (default: "thumbnails")
 * @returns The public URL of the uploaded image
 */
export const uploadDataUrlToStorage = async (
  dataUrl: string,
  supabase: any,
  userId: string,
  bucket: string = "thumbnails"
): Promise<string> => {
  const blob = dataUrlToBlob(dataUrl);
  const fileName = `${userId}/generated/${Date.now()}-${Math.random().toString(36).substring(7)}.jpg`;

  // Convert to JPEG blob for consistent format
  const jpegBlob = await new Promise<Blob>((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Failed to get canvas context'));
        return;
      }
      ctx.drawImage(img, 0, 0);
      canvas.toBlob(
        (resultBlob) => {
          if (resultBlob) {
            resolve(resultBlob);
          } else {
            reject(new Error('Failed to convert to JPEG'));
          }
        },
        'image/jpeg',
        0.92
      );
    };
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = dataUrl;
  });

  const { error: uploadError } = await supabase.storage
    .from(bucket)
    .upload(fileName, jpegBlob, {
      contentType: "image/jpeg",
    });

  if (uploadError) {
    throw uploadError;
  }

  const { data: { publicUrl } } = supabase.storage
    .from(bucket)
    .getPublicUrl(fileName);

  return publicUrl;
};

/**
 * Downloads an image resized to the requested dimensions using a canvas to preserve quality.
 * Uses a cover fit to avoid distortion when aspect ratios differ.
 */
export const downloadImageWithSize = async (
  imageUrl: string,
  { width, height, fileName }: DownloadImageOptions
): Promise<void> => {
  const img = new Image();
  img.crossOrigin = "anonymous";

  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error("Failed to load image for download"));
    img.src = imageUrl;
  });

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Failed to prepare download canvas");
  }

  // Scale image to cover the target size without stretching
  const scale = Math.max(width / img.width, height / img.height);
  const targetWidth = img.width * scale;
  const targetHeight = img.height * scale;
  const dx = (width - targetWidth) / 2;
  const dy = (height - targetHeight) / 2;

  ctx.drawImage(img, dx, dy, targetWidth, targetHeight);

  await new Promise<void>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("Unable to generate download blob"));
        return;
      }

      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName || `thumbnail-${width}x${height}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      resolve();
    }, "image/png");
  });
};
