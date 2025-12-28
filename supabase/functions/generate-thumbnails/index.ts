import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { createLogger } from "../_shared/logger.ts";

const logger = createLogger("generate-thumbnails");

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  // Avoid stack overflow on large images by chunking
  const chunkSize = 0x8000;
  let binary = "";
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

function parseDataUrlImage(dataUrl: string): { mimeType: string; data: string } | null {
  // Expected: data:<mime>;base64,<data>
  if (typeof dataUrl !== "string") return null;
  if (!dataUrl.startsWith("data:")) return null;

  const commaIdx = dataUrl.indexOf(",");
  if (commaIdx === -1) return null;

  const meta = dataUrl.slice(5, commaIdx); // after "data:"
  const data = dataUrl.slice(commaIdx + 1);

  if (!meta.includes(";base64")) return null;
  const mimeType = meta.split(";")[0] || "";
  if (!mimeType.startsWith("image/")) return null;
  if (!data) return null;

  return { mimeType, data };
}

function pickReferenceFrames(frames: unknown, max: number): { mimeType: string; data: string }[] {
  if (!Array.isArray(frames)) return [];
  const parsed = frames
    .map((f) => (typeof f === "string" ? parseDataUrlImage(f) : null))
    .filter((x): x is { mimeType: string; data: string } => Boolean(x));

  if (parsed.length <= max) return parsed;

  // Evenly sample to keep variety
  const result: { mimeType: string; data: string }[] = [];
  const step = (parsed.length - 1) / (max - 1);
  for (let i = 0; i < max; i++) {
    const idx = Math.round(i * step);
    result.push(parsed[Math.max(0, Math.min(parsed.length - 1, idx))]);
  }
  return result;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { thumbnailPrompts, frames, isViral } = await req.json();
    logger.info("Starting thumbnail grid generation", { isViral, promptCount: thumbnailPrompts?.length });
    
    if (!thumbnailPrompts || !Array.isArray(thumbnailPrompts) || thumbnailPrompts.length !== 4) {
      logger.error("Invalid thumbnailPrompts", { thumbnailPrompts });
      throw new Error('Invalid thumbnailPrompts: must be an array with exactly 4 items');
    }

    const REPLICATE_API_KEY = Deno.env.get("REPLICATE_API_KEY");
    if (!REPLICATE_API_KEY) {
      logger.error("REPLICATE_API_KEY not configured");
      throw new Error("REPLICATE_API_KEY not configured");
    }

    const referenceFrames = pickReferenceFrames(frames, 6);
    logger.info(`Reference frames processed`, { total: Array.isArray(frames) ? frames.length : 0, usable: referenceFrames.length });

    // Keep this compact: long prompts are a common cause of Gemini image failures/timeouts.
    const viralStyleGuidelines =
      `Viral YouTube thumbnail: bold condensed ALL-CAPS (Anton/Bebas/Impact vibe), ` +
      `1–4 word headline, high contrast, subtle 3D+shadow+glow, subject off-center + text opposite face, ` +
      `warm key/cool rim, dark/blur BG, bokeh/flares, clean cutout + strong rim/subject glow, no clutter, mobile-sharp 16:9.`;

    const compact = (input: unknown, max = 220) => {
      const s = typeof input === "string" ? input.replace(/\s+/g, " ").trim() : "";
      if (!s) return "";
      if (s.length <= max) return s;
      const sliced = s.slice(0, max);
      const lastSpace = sliced.lastIndexOf(" ");
      return (lastSpace > 60 ? sliced.slice(0, lastSpace) : sliced).trim();
    };

    // Build prompt for 2x2 grid
    const getThumbnailPrompt = (position: string) => {
      const p = thumbnailPrompts.find((p: any) => p.position === position);
      if (!p) return 'Missing description';
      const title = typeof p.title === "string" && p.title.trim() ? p.title.trim() : (typeof p.text === "string" ? p.text.trim() : "");
      const subtitle = typeof p.subtitle === "string" && p.subtitle.trim() ? p.subtitle.trim() : "";

      const overlay =
        title && subtitle
          ? `. Include a main title text overlay: "${title}" and a smaller subtitle text: "${subtitle}"`
          : title
            ? `. Include this text overlay: "${title}"`
            : '';

      const visualStyle = compact(p.visualStyle, 140);
      const textStyle = compact(p.textStyle, 160);
      const background = compact(p.background, 160);
      const faceExpression = compact(p.faceExpression, 100);
      const textPosition = typeof p.textPosition === "string" && p.textPosition.trim()
        ? ` Text at ${compact(p.textPosition, 70).replace("-", " ")} (single placement, high contrast).`
        : "";

      let elements = "";
      if (Array.isArray(p.elements) && p.elements.length > 0) {
        const items = p.elements
          .map((e: any) => {
            const desc = compact(e?.description, 80);
            const type = compact(e?.type, 24);
            const pos = compact(e?.position, 32);
            const parts = [type, desc].filter(Boolean).join(": ");
            return pos ? `${parts} (${pos})` : parts;
          })
          .filter(Boolean);
        if (items.length > 0) {
          elements = ` Elements: ${items.slice(0, 2).join("; ")}.`;
        }
      }

      const desc = compact(p.description, 420);
      const styleBits = [
        visualStyle ? `Style: ${visualStyle}.` : "",
        background ? `BG: ${background}.` : "",
        faceExpression ? `Expr: ${faceExpression}.` : "",
        textStyle ? `Type: ${textStyle}.` : "",
      ].filter(Boolean).join(" ");

      return `${desc}${styleBits ? ` ${styleBits}` : ""}${textPosition ? ` ${textPosition}` : ""}${elements ? ` ${elements}` : ""}${overlay}`;
    };

    const gridPrompt = `Create ONE 2x2 grid image of YouTube thumbnails (4 distinct variants). Layout:

TOP ROW:
- Left: ${getThumbnailPrompt('top-left')}
- Right: ${getThumbnailPrompt('top-right')}

BOTTOM ROW:
- Left: ${getThumbnailPrompt('bottom-left')}
- Right: ${getThumbnailPrompt('bottom-right')}

Requirements (strict):
- NO borders/gaps/lines between cells (perfectly adjacent).
- Each cell is a complete 16:9 thumbnail, YouTube-optimized, faithful to reference frames.
- Place the title/subtitle text EXACTLY ONCE per thumbnail (single clear high-contrast location).
- Final image size: 3840x2160 (2x2 of 1920x1080).
${isViral ? `- Apply viral style (all 4): ${viralStyleGuidelines}\n` : ''}`;

    console.log("Generating grid image via Replicate...");

    const referenceFrameDataUrls = referenceFrames.map((img) => `data:${img.mimeType};base64,${img.data}`);

    // Retry logic for Replicate API calls
    const maxRetries = 3;
    const baseDelay = 2000; // 2 seconds
    let lastError: Error | null = null;
    let response: Response | null = null;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        logger.info(`Replicate API call attempt ${attempt + 1}`, { maxRetries });

        response = await fetch(
          "https://api.replicate.com/v1/models/google/nano-banana-pro/predictions",
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${REPLICATE_API_KEY}`,
              "Content-Type": "application/json",
              // Block until complete for a simpler server contract
              Prefer: "wait",
            },
            body: JSON.stringify({
              input: {
                prompt: gridPrompt,
                resolution: "2K",
                ...(referenceFrameDataUrls.length > 0 ? { image_input: referenceFrameDataUrls } : {}),
                // The output is the full 2x2 grid (3840x2160), which is 16:9 overall.
                aspect_ratio: "16:9",
                output_format: "png",
                safety_filter_level: "block_only_high",
              },
            }),
          },
        );

        if (response.ok) {
          logger.info("Replicate API call successful");
          break; // Success, exit retry loop
        }

        const errorText = await response.text();
        logger.error(`Replicate API error on attempt ${attempt + 1}`, { status: response.status, error: errorText });

        // Handle retryable status codes
        if (response.status === 429 || response.status === 503 || response.status === 500) {
          if (attempt < maxRetries - 1) {
            const delay = baseDelay * Math.pow(2, attempt);
            logger.info(`Retrying after ${delay}ms...`);
            await new Promise((resolve) => setTimeout(resolve, delay));
            continue;
          }
        }

        lastError = new Error(`Replicate API error: ${response.status} ${errorText}`);
        break; // Don't retry on 400, 401, 403, etc.
      } catch (error) {
        logger.error(`Network error on attempt ${attempt + 1}`, error);
        lastError = error instanceof Error ? error : new Error(String(error));

        if (attempt < maxRetries - 1) {
          const delay = baseDelay * Math.pow(2, attempt);
          await new Promise((resolve) => setTimeout(resolve, delay));
          continue;
        }
      }
    }

    if (!response || !response.ok) {
      throw lastError || new Error("Failed to generate image after multiple attempts");
    }

    const prediction = await response.json();
    const status = prediction?.status;
    if (status && status !== "succeeded") {
      logger.error("Replicate prediction did not succeed", { status, id: prediction?.id, error: prediction?.error, logs: prediction?.logs });
      throw new Error(`Replicate prediction failed with status: ${status}`);
    }

    const output = prediction?.output;
    const outputUrl =
      typeof output === "string"
        ? output
        : Array.isArray(output) && typeof output[0] === "string"
          ? output[0]
          : null;

    if (!outputUrl) {
      logger.error("No output URL received from Replicate", { id: prediction?.id, status: prediction?.status, output: prediction?.output });
      throw new Error("No image output received from Replicate");
    }

    // Convert the output image URL into a data URL to keep the existing frontend contract unchanged.
    const imageRes = await fetch(outputUrl);
    if (!imageRes.ok) {
      const errText = await imageRes.text();
      logger.error("Failed to download Replicate output image", { status: imageRes.status, error: errText });
      throw new Error(`Failed to download output image: ${imageRes.status}`);
    }

    const contentType = imageRes.headers.get("content-type") || "image/png";
    const bytes = await imageRes.arrayBuffer();
    const gridImage = `data:${contentType};base64,${arrayBufferToBase64(bytes)}`;

    logger.info('Generated 2x2 grid image successfully');

    return new Response(
      JSON.stringify({ gridImage, prompt: gridPrompt }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    logger.error('Thumbnail generation failed', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        details: error instanceof Error ? error.stack : undefined
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

