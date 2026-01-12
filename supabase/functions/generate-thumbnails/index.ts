import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
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

  const startedAt = Date.now();
  let generationId: string | null = null;
  let supabase: ReturnType<typeof createClient> | null = null;

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    supabase = createClient(supabaseUrl, supabaseKey);

    const { thumbnailPrompts, frames, isViral, creditsUsed, styleReferences } = await req.json();
    logger.info("Starting thumbnail grid generation", { isViral, promptCount: thumbnailPrompts?.length, hasStyleRefs: !!styleReferences });
    
    // Create initial generation record
    const authHeader = req.headers.get("Authorization");
    if (authHeader) {
      const { data: { user } } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
      if (user) {
        const { data: genRecord } = await supabase
          .from("generations")
          .insert({
            user_id: user.id,
            status: "processing",
            credits_used: creditsUsed || 2,
            mode: "create",
          })
          .select("id")
          .single();
        generationId = genRecord?.id || null;
      }
    }

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
    const referenceStyles = pickReferenceFrames(styleReferences, 4);
    logger.info(`Reference frames processed`, { total: Array.isArray(frames) ? frames.length : 0, usable: referenceFrames.length });
    logger.info(`Reference styles processed`, { total: Array.isArray(styleReferences) ? styleReferences.length : 0, usable: referenceStyles.length });

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

    // Build style reference instructions if provided
    const styleReferenceInstructions = referenceStyles.length > 0 
      ? `\n\nSTYLE REFERENCE IMAGES PROVIDED (IMPORTANT - READ CAREFULLY):
The LAST ${referenceStyles.length} reference image(s) provided are STYLE REFERENCES ONLY.
- Extract their visual style: color palettes, typography style, text placement patterns, composition, lighting mood
- Apply these style elements to the 4 thumbnails you generate
- DO NOT copy the subjects or content from these style references
- The first ${referenceFrames.length} images show the actual video content/subjects to include
- Think: "Content from video frames + Visual style from the ${referenceStyles.length} style reference(s)"`
      : '';

    const gridPrompt = `Create ONE 2x2 grid image of YouTube thumbnails (4 distinct variants). Layout:

TOP ROW:
- Left: ${getThumbnailPrompt('top-left')}
- Right: ${getThumbnailPrompt('top-right')}

BOTTOM ROW:
- Left: ${getThumbnailPrompt('bottom-left')}
- Right: ${getThumbnailPrompt('bottom-right')}

Requirements (strict):
- NO borders/gaps/lines between cells (perfectly adjacent).
- Each cell is a complete 16:9 thumbnail, YouTube-optimized, faithful to reference frames for content and subjects.
- Place the title/subtitle text EXACTLY ONCE per thumbnail (single clear high-contrast location).
- Final image size: 3840x2160 (2x2 of 1920x1080).
${isViral ? `- Apply viral style (all 4): ${viralStyleGuidelines}\n` : ''}${styleReferenceInstructions}`;

    console.log("Generating grid image via Replicate...");
    logger.info("Prompt preview (first 500 chars)", { promptPreview: gridPrompt.slice(0, 500) });

    const referenceFrameDataUrls = referenceFrames.map((img) => `data:${img.mimeType};base64,${img.data}`);
    const styleRefDataUrls = referenceStyles.map((img) => `data:${img.mimeType};base64,${img.data}`);
    const allRefImages = [...referenceFrameDataUrls, ...styleRefDataUrls];
    
    logger.info("Image references breakdown", { 
      totalImages: allRefImages.length, 
      videoFrames: referenceFrameDataUrls.length, 
      styleRefs: styleRefDataUrls.length 
    });

    // Replicate API call with polling logic
    logger.info("Starting Replicate prediction for grid...");
    
    // 1. Create prediction
    const createResponse = await fetch(
      "https://api.replicate.com/v1/models/google/nano-banana-pro/predictions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${REPLICATE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          input: {
            prompt: gridPrompt,
            resolution: "2K",
            ...(allRefImages.length > 0 ? { image_input: allRefImages } : {}),
            aspect_ratio: "16:9",
            output_format: "png",
            safety_filter_level: "block_only_high",
          },
        }),
      }
    );

    if (!createResponse.ok) {
      const errorText = await createResponse.text();
      throw new Error(`Failed to create Replicate prediction: ${createResponse.status} ${errorText}`);
    }

    let prediction = await createResponse.json();
    const predictionId = prediction.id;
    logger.info(`Prediction created: ${predictionId}`);

    // 2. Poll for completion
    const maxPollAttempts = 120; // ~6 minutes total (with 3s delay)
    const pollInterval = 3000;
    let succeeded = false;

    for (let i = 0; i < maxPollAttempts; i++) {
      if (prediction.status === "succeeded") {
        succeeded = true;
        break;
      } else if (prediction.status === "failed" || prediction.status === "canceled") {
        throw new Error(`Replicate prediction ${prediction.status}: ${prediction.error || "No error details"}`);
      }

      logger.info(`Polling prediction ${predictionId} (attempt ${i + 1}, status: ${prediction.status})...`);
      await new Promise(resolve => setTimeout(resolve, pollInterval));

      const pollResponse = await fetch(
        `https://api.replicate.com/v1/predictions/${predictionId}`,
        {
          headers: {
            Authorization: `Bearer ${REPLICATE_API_KEY}`,
          },
        }
      );

      if (pollResponse.ok) {
        prediction = await pollResponse.json();
      } else {
        const pollError = await pollResponse.text();
        logger.error(`Poll failed: ${pollResponse.status} ${pollError}`);
        if (pollResponse.status >= 500) continue;
        throw new Error(`Failed to poll Replicate prediction: ${pollResponse.status}`);
      }
    }

    if (!succeeded) {
      throw new Error("Replicate prediction timed out");
    }

    logger.info("Replicate prediction successful");

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

    if (generationId && supabase) {
      await supabase
        .from("generations")
        .update({
          status: "completed",
          completed_at: new Date().toISOString(),
          duration_ms: Date.now() - startedAt,
        })
        .eq("id", generationId);
    }

    return new Response(
      JSON.stringify({ gridImage, prompt: gridPrompt, generationId }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    logger.error('Thumbnail generation failed', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    if (generationId && supabase) {
      await supabase
        .from("generations")
        .update({
          status: "failed",
          error_message: errorMessage,
          completed_at: new Date().toISOString(),
          duration_ms: Date.now() - startedAt,
        })
        .eq("id", generationId);
    }

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

