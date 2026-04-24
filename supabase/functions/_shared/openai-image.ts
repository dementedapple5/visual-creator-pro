import { Logger } from "./logger.ts";

export type OpenAIImageQuality = "low" | "medium" | "high" | "auto";

const OPENAI_IMAGE_MODEL = "gpt-image-2";
const OPENAI_IMAGE_GENERATIONS_URL = "https://api.openai.com/v1/images/generations";
const OPENAI_IMAGE_EDITS_URL = "https://api.openai.com/v1/images/edits";

type OpenAIImageApiResponse = {
  data?: Array<{
    b64_json?: string;
    revised_prompt?: string;
  }>;
  output_format?: "png" | "jpeg" | "webp";
  quality?: OpenAIImageQuality;
  size?: string;
};

type GenerateOpenAIImageOptions = {
  apiKey: string;
  prompt: string;
  logger: Logger;
  aspectRatio?: string;
  resolution?: string;
  inputImages?: string[];
  userId?: string | null;
  quality?: OpenAIImageQuality;
  logLabel?: string;
};

export type OpenAIImageResult = {
  b64Json: string;
  contentType: string;
  size: string;
  quality: OpenAIImageQuality;
  revisedPrompt?: string;
};

function parseRatio(value?: string): number | null {
  if (!value) return null;

  const parts = value.trim().split(/[:/]/);
  if (parts.length !== 2) return null;

  const width = Number(parts[0]);
  const height = Number(parts[1]);

  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return null;
  }

  return width / height;
}

export function mapResolutionToOpenAIQuality(resolution?: string): OpenAIImageQuality {
  const normalized = resolution?.trim().toUpperCase();

  if (normalized === "2K" || normalized === "4K") return "high";
  if (normalized === "1K") return "medium";

  return "auto";
}

export function mapResolutionToOpenAISize(aspectRatio?: string, resolution?: string): string {
  const ratio = parseRatio(aspectRatio);
  const normalizedResolution = resolution?.trim().toUpperCase();
  const isSquare = ratio ? Math.abs(ratio - 1) < 0.05 : false;
  const isPortrait = ratio ? ratio < 1 : false;

  if (isSquare) {
    if (normalizedResolution === "4K") return "2880x2880";
    if (normalizedResolution === "2K") return "2048x2048";
    return "1024x1024";
  }

  if (isPortrait) {
    if (normalizedResolution === "4K") return "2160x3840";
    if (normalizedResolution === "2K") return "1152x2048";
    return "1024x1536";
  }

  if (normalizedResolution === "4K") return "3840x2160";
  if (normalizedResolution === "2K") return "2048x1152";
  return "1536x1024";
}

export function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }

  return bytes;
}

function parseDataUrlImage(dataUrl: string): { mimeType: string; data: string } | null {
  if (typeof dataUrl !== "string" || !dataUrl.startsWith("data:")) return null;

  const commaIdx = dataUrl.indexOf(",");
  if (commaIdx === -1) return null;

  const meta = dataUrl.slice(5, commaIdx);
  const data = dataUrl.slice(commaIdx + 1);

  if (!meta.includes(";base64")) return null;

  const mimeType = meta.split(";")[0] || "image/png";
  if (!mimeType.startsWith("image/") || !data) return null;

  return { mimeType, data };
}

function extensionForMimeType(mimeType: string): string {
  if (mimeType === "image/jpeg") return "jpg";
  if (mimeType === "image/webp") return "webp";
  return "png";
}

async function imageInputToBlob(input: string): Promise<{ blob: Blob; filename: string }> {
  const parsed = parseDataUrlImage(input);

  if (parsed) {
    const bytes = base64ToUint8Array(parsed.data);
    return {
      blob: new Blob([bytes], { type: parsed.mimeType }),
      filename: `input.${extensionForMimeType(parsed.mimeType)}`,
    };
  }

  const response = await fetch(input);
  if (!response.ok) {
    throw new Error(`Failed to fetch input image for OpenAI: ${response.status}`);
  }

  const contentType = response.headers.get("content-type") || "image/png";
  return {
    blob: await response.blob(),
    filename: `input.${extensionForMimeType(contentType)}`,
  };
}

async function readOpenAIError(response: Response): Promise<string> {
  const text = await response.text();

  try {
    const parsed = JSON.parse(text) as { error?: { message?: string } };
    return parsed.error?.message || text;
  } catch {
    return text;
  }
}

export async function generateOpenAIImage({
  apiKey,
  prompt,
  logger,
  aspectRatio,
  resolution,
  inputImages,
  userId,
  quality,
  logLabel = "OpenAI image generation",
}: GenerateOpenAIImageOptions): Promise<OpenAIImageResult> {
  const size = mapResolutionToOpenAISize(aspectRatio, resolution);
  const outputQuality = quality ?? mapResolutionToOpenAIQuality(resolution);
  const hasInputImages = Boolean(inputImages?.length);
  const endpoint = hasInputImages ? OPENAI_IMAGE_EDITS_URL : OPENAI_IMAGE_GENERATIONS_URL;

  logger.info(`Starting ${logLabel}`, {
    model: OPENAI_IMAGE_MODEL,
    size,
    quality: outputQuality,
    inputImageCount: inputImages?.length || 0,
  });

  let response: Response;

  if (hasInputImages) {
    const form = new FormData();
    form.append("model", OPENAI_IMAGE_MODEL);
    form.append("prompt", prompt);
    form.append("size", size);
    form.append("quality", outputQuality);
    form.append("output_format", "png");
    form.append("background", "opaque");
    form.append("moderation", "low");
    form.append("n", "1");
    if (userId) form.append("user", userId);

    const limitedImages = inputImages!.slice(0, 16);
    for (let i = 0; i < limitedImages.length; i++) {
      const { blob, filename } = await imageInputToBlob(limitedImages[i]);
      form.append("image[]", blob, `${i + 1}-${filename}`);
    }

    response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      body: form,
    });
  } else {
    response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: OPENAI_IMAGE_MODEL,
        prompt,
        size,
        quality: outputQuality,
        output_format: "png",
        background: "opaque",
        moderation: "low",
        n: 1,
        ...(userId ? { user: userId } : {}),
      }),
    });
  }

  if (!response.ok) {
    const errorText = await readOpenAIError(response);
    throw new Error(`OpenAI image API failed: ${response.status} ${errorText}`);
  }

  const result = await response.json() as OpenAIImageApiResponse;
  const image = result.data?.[0];

  if (!image?.b64_json) {
    throw new Error("No image data received from OpenAI");
  }

  logger.info(`${logLabel} successful`, {
    size: result.size || size,
    quality: result.quality || outputQuality,
    outputFormat: result.output_format || "png",
  });

  return {
    b64Json: image.b64_json,
    contentType: `image/${result.output_format || "png"}`,
    size: result.size || size,
    quality: result.quality || outputQuality,
    revisedPrompt: image.revised_prompt,
  };
}
