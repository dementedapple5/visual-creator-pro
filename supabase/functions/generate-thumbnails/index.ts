import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import { corsHeaders } from "../_shared/cors.ts";
import { createLogger } from "../_shared/logger.ts";
import { generateOpenAIImage } from "../_shared/openai-image.ts";

const logger = createLogger("generate-thumbnails");

type ThumbnailPromptElement = {
  description?: unknown;
  type?: unknown;
  position?: unknown;
};

type ThumbnailPrompt = {
  position?: unknown;
  title?: unknown;
  text?: unknown;
  subtitle?: unknown;
  visualStyle?: unknown;
  textStyle?: unknown;
  background?: unknown;
  faceExpression?: unknown;
  textPosition?: unknown;
  elements?: ThumbnailPromptElement[];
  description?: unknown;
};

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

    const openAIApiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openAIApiKey) {
      logger.error("OPENAI_API_KEY not configured");
      throw new Error("OPENAI_API_KEY not configured");
    }

    const referenceFrames = pickReferenceFrames(frames, 6);
    const referenceStyles = pickReferenceFrames(styleReferences, 4);
    logger.info(`Reference frames processed`, { total: Array.isArray(frames) ? frames.length : 0, usable: referenceFrames.length });
    logger.info(`Reference styles processed`, { total: Array.isArray(styleReferences) ? styleReferences.length : 0, usable: referenceStyles.length });

    // Keep this compact: long prompts are a common cause of image model failures/timeouts.
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
    const prompts = thumbnailPrompts as ThumbnailPrompt[];
    const getThumbnailPrompt = (position: string) => {
      const p = prompts.find((item) => item.position === position);
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
          .map((e) => {
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
- Final image size: 2048x1152 (2x2 grid output).
${isViral ? `- Apply viral style (all 4): ${viralStyleGuidelines}\n` : ''}${styleReferenceInstructions}`;

    console.log("Generating grid image via OpenAI...");
    logger.info("Prompt preview (first 500 chars)", { promptPreview: gridPrompt.slice(0, 500) });

    const referenceFrameDataUrls = referenceFrames.map((img) => `data:${img.mimeType};base64,${img.data}`);
    const styleRefDataUrls = referenceStyles.map((img) => `data:${img.mimeType};base64,${img.data}`);
    const allRefImages = [...referenceFrameDataUrls, ...styleRefDataUrls];

    logger.info("Image references breakdown", {
      totalImages: allRefImages.length,
      videoFrames: referenceFrameDataUrls.length,
      styleRefs: styleRefDataUrls.length
    });

    const generatedImage = await generateOpenAIImage({
      apiKey: openAIApiKey,
      prompt: gridPrompt,
      aspectRatio: "16:9",
      resolution: "2K",
      inputImages: allRefImages,
      logger,
      logLabel: "OpenAI gpt-image-2 grid generation",
    });

    const gridImage = `data:${generatedImage.contentType};base64,${generatedImage.b64Json}`;

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
