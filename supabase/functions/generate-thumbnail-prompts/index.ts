/// <reference path="../deno-shim.d.ts" />
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { createLogger } from "../_shared/logger.ts";

const logger = createLogger("generate-thumbnail-prompts");

type ThumbnailPosition = "top-left" | "top-right" | "bottom-left" | "bottom-right";

type ThumbnailPrompt = {
  position: ThumbnailPosition;
  // Classification tags (new): used to steer better thumbnail concepts
  // Use stable, lowercase "slugs" (e.g. "reaction", "vlog", "cooking", "tutorial", "interview", "economy")
  videoType?: string;
  tags?: string[];
  // Core semantic fields (new)
  videoTheme: string;
  title: string;
  subtitle?: string;
  visualStyle?: string;
  textStyle?: string;
  background?: string;
  faceExpression?: string;
  textPosition?: string;
  viralStyleGuidelines?: string;
  elements?: Array<{
    type?: string; // icon | prop | badge | sticker | shape | product | ui | flag | logo | arrow
    description?: string;
    position?: string;
  }>;
  // Visual-only description for image generation (legacy + still useful)
  description: string;
  // Backward compatible: used by generate-thumbnails today
  text: string;
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

function safeParseJson(input: string): unknown {
  try {
    return JSON.parse(input);
  } catch {
    // Try to recover if model wrapped output with extra text
    const first = input.indexOf("{");
    const last = input.lastIndexOf("}");
    if (first !== -1 && last !== -1 && last > first) {
      const sliced = input.slice(first, last + 1);
      return JSON.parse(sliced);
    }
    throw new Error("Invalid JSON response from Gemini");
  }
}

function normalizeWhitespace(s: unknown): string {
  return typeof s === "string" ? s.replace(/\s+/g, " ").trim() : "";
}

function normalizeTag(input: unknown): string {
  if (typeof input !== "string") return "";
  const s = input
    .trim()
    .toLowerCase()
    .replace(/[_\s]+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return s;
}

function normalizeTags(input: unknown, max = 16): string[] {
  const src = Array.isArray(input) ? input : (typeof input === "string" ? [input] : []);
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of src) {
    const tag = normalizeTag(item);
    if (!tag) continue;
    if (seen.has(tag)) continue;
    seen.add(tag);
    out.push(tag);
    if (out.length >= max) break;
  }
  return out;
}

function clampWords(s: string, maxWords: number): string {
  const words = s.split(/\s+/).filter(Boolean);
  if (words.length <= maxWords) return s;
  return words.slice(0, maxWords).join(" ");
}

function clampChars(s: string, maxChars: number): string {
  const out = normalizeWhitespace(s);
  if (!out) return "";
  if (out.length <= maxChars) return out;
  // Prefer truncating at punctuation/word boundary
  const sliced = out.slice(0, maxChars);
  const lastBreak = Math.max(
    sliced.lastIndexOf(". "),
    sliced.lastIndexOf("; "),
    sliced.lastIndexOf(", "),
    sliced.lastIndexOf(" - "),
    sliced.lastIndexOf(" ")
  );
  return (lastBreak > 40 ? sliced.slice(0, lastBreak) : sliced).trim();
}

function clampFieldWords(input: unknown, maxWords: number): string | undefined {
  const s = normalizeWhitespace(input);
  if (!s) return undefined;
  return clampWords(s, maxWords);
}

function clampFieldChars(input: unknown, maxChars: number): string | undefined {
  const s = normalizeWhitespace(input);
  if (!s) return undefined;
  return clampChars(s, maxChars) || undefined;
}

function compactGuidelines(input: unknown): string | undefined {
  const s = normalizeWhitespace(input);
  if (!s) return undefined;
  // If the model returned a giant block, replace with a short "style id".
  if (s.length > 240) return "viral-yt-v1 (bold all-caps, high-contrast, rim light, glow, no clutter)";
  return s;
}

function normalizeThumbnailPromptResponse(raw: unknown): {
  videoType?: unknown;
  videoTags?: unknown;
  thumbnails: unknown[];
} {
  // Common variants we’ve seen models return:
  // 1) { thumbnails: [...] }
  // 2) [...] (just the thumbnails array)
  // 3) { data: { thumbnails: [...] } }
  // 4) { thumbnails: { "top-left": {...}, ... } } or keys like topLeft/topRight/etc.
  if (Array.isArray(raw)) {
    return { thumbnails: raw };
  }

  if (raw && typeof raw === "object") {
    const obj = raw as Record<string, unknown>;

    if (Array.isArray(obj.thumbnails)) {
      return { videoType: obj.videoType, videoTags: obj.videoTags, thumbnails: obj.thumbnails };
    }

    const data = obj.data;
    if (data && typeof data === "object") {
      const dataObj = data as Record<string, unknown>;
      if (Array.isArray(dataObj.thumbnails)) {
        return { videoType: dataObj.videoType ?? obj.videoType, videoTags: dataObj.videoTags ?? obj.videoTags, thumbnails: dataObj.thumbnails };
      }
    }

    // Keyed-by-position object: { thumbnails: { "top-left": {...}, ... } }
    if (obj.thumbnails && typeof obj.thumbnails === "object") {
      const tObj = obj.thumbnails as Record<string, unknown>;
      const values = Object.values(tObj).filter(Boolean);
      if (values.length) {
        return { videoType: obj.videoType, videoTags: obj.videoTags, thumbnails: values };
      }
    }

    // Top-level keyed positions: { "top-left": {...}, "top-right": {...}, ... }
    const maybePositions = ["top-left", "top-right", "bottom-left", "bottom-right"];
    const topLevel = maybePositions.map((k) => obj[k]).filter(Boolean);
    if (topLevel.length) {
      return { videoType: obj.videoType, videoTags: obj.videoTags, thumbnails: topLevel };
    }

    // CamelCase variants
    const camel = ["topLeft", "topRight", "bottomLeft", "bottomRight"].map((k) => obj[k]).filter(Boolean);
    if (camel.length) {
      return { videoType: obj.videoType, videoTags: obj.videoTags, thumbnails: camel };
    }
  }

  return { thumbnails: [] };
}

function buildValidatedThumbnails(raw: any): ThumbnailPrompt[] {
  const positions: ThumbnailPosition[] = ['top-left', 'top-right', 'bottom-left', 'bottom-right'];
  const src = raw?.thumbnails;
  if (!Array.isArray(src)) {
    throw new Error('Invalid response structure: missing thumbnails array');
  }

  const rootVideoType = normalizeTag(raw?.videoType);
  const rootTags = normalizeTags(raw?.videoTags);

  const byPos = new Map<string, any>();
  for (const t of src) {
    const pos = typeof t?.position === "string" ? t.position : "";
    if (positions.includes(pos as ThumbnailPosition)) byPos.set(pos, t);
  }

  return positions.map((position) => {
    const t = byPos.get(position) ?? {};

    const videoTheme = normalizeWhitespace(t.videoTheme) || "Tema del video no especificado";
    const titleRaw = normalizeWhitespace(t.title) || normalizeWhitespace(t.text) || "";
    const subtitleRaw = normalizeWhitespace(t.subtitle);

    const title = clampWords(titleRaw, 5); // allow up to 5 words for Spanish, still short
    const subtitle = subtitleRaw ? clampWords(subtitleRaw, 6) : undefined;

    if (!title) {
      throw new Error(`Missing thumbnail title for position: ${position}`);
    }

    const videoType = normalizeTag(t.videoType) || rootVideoType || undefined;
    // Prefer thumbnail-specific tags, else inherit root tags, else fall back to videoType
    const tagsLocal = normalizeTags(t.tags);
    const tags = (tagsLocal.length ? tagsLocal : rootTags).length
      ? (tagsLocal.length ? tagsLocal : rootTags)
      : (videoType ? [videoType] : []);

    // Keep fields compact to avoid downstream prompt bloat (Gemini image model has prompt-size sensitivity)
    const visualStyle = clampFieldWords(t.visualStyle, 14);
    const textStyle = clampFieldWords(t.textStyle, 16);
    const background = clampFieldWords(t.background, 18);
    const faceExpression = clampFieldWords(t.faceExpression, 10);
    const textPosition = clampFieldWords(t.textPosition, 14);
    const viralStyleGuidelines = compactGuidelines(t.viralStyleGuidelines);
    const elements = Array.isArray(t.elements) ? t.elements : undefined;

    // Enforce a short visual-only description (no typography/text placement)
    const description = clampFieldChars(t.description, 360);
    if (!description) {
      throw new Error(`Missing thumbnail description for position: ${position}`);
    }

    return {
      position,
      videoType,
      tags,
      videoTheme,
      title,
      subtitle,
      visualStyle,
      textStyle,
      background,
      faceExpression,
      textPosition,
      viralStyleGuidelines,
      elements,
      description,
      // Backward compatibility
      text: title,
    };
  });
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { transcription, videoTitle, frames, isViral } = await req.json();
    logger.info("Starting thumbnail prompt generation", { isViral, videoTitle });
    
    if (!transcription) {
      logger.error("No transcription provided");
      throw new Error('No transcription provided');
    }

    const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
    if (!GEMINI_API_KEY) {
      logger.error("GEMINI_API_KEY not configured");
      throw new Error('GEMINI_API_KEY not configured');
    }

    const referenceFrames = pickReferenceFrames(frames, 6);
    logger.info(`Reference frames processed`, { total: Array.isArray(frames) ? frames.length : 0, usable: referenceFrames.length });

    // Compact style spec (kept short on purpose; full long blocks cause downstream prompt failures)
    const viralStyleGuidelines = `Viral YouTube style: bold condensed ALL-CAPS (Anton/Bebas/Impact vibe), 1–4 word headline, high-contrast colors, subtle 3D+shadow+glow, off-center subject + text opposite face, warm key/cool rim, dark/blur BG, bokeh/flares, clean cutout + strong rim/subject glow, no clutter, mobile-sharp 16:9.`;

    // Build the prompt
    const systemPrompt = `You are an expert YouTube thumbnail strategist + designer.

Goal: Generate 4 PROFESSIONAL YouTube thumbnail concepts for a 2x2 grid (4 distinct variations), tightly aligned with the video's real topic.

First, you MUST identify the video's type + themes as tags. This is critical to avoid generic or off-topic thumbnails.

Video type taxonomy (choose ONE best-fit "videoType" slug):
- reaction, vlog, cooking, tutorial, interview, economy, gaming, podcast, news, documentary, review, unboxing, educational, tech, fitness, travel, music, comedy, sports, horror, politics, science, other

Tags rules:
- Output "videoType" as a lowercase slug (e.g. "reaction")
- Output "videoTags" as an array of 4–10 lowercase slugs (can include videoType + additional tags)
- Also output "tags" per thumbnail (usually same as videoTags unless a specific variant focuses on a sub-angle)
- Tags should be stable slugs: lowercase, hyphens, no accents (e.g. "personal-finance", "street-food", "home-workout")

Tag-to-thumbnail heuristics (MANDATORY when relevant):
- reaction: include a clear "reacted content" visual (e.g. screenshot/panel of the thing being reacted to) + reactor face with strong emotion; highlight the reacted moment with a circle/arrow/burst in elements; make the reacted content readable on mobile.
- vlog: emphasize real-life setting (place/activity) + candid feel; include location/activity cues (camera, suitcase, street signs, landmarks, coffee shop, gym, car interior) as subtle elements; avoid overly "studio" look unless frames show it.
- cooking: hero shot of the final dish (close-up, glossy, steam) + one or two key ingredients/tools; use appetizing lighting/colors; avoid unrelated props.
- tutorial: show the subject/tool/UI clearly; include "before/after" or step cue as elements (badge, numbered steps, progress bar); keep it instructional and specific.
- interview/podcast:
  - If the reference frames show MULTIPLE distinct people (e.g. host + guest), you MUST feature 2+ people in the thumbnail composition (side-by-side, split-screen, or foreground/background) instead of showing only one person.
  - Do NOT invent extra people: only include multiple people when the frames clearly show them.
  - Use mic/headphones/studio cues when present; include conversation context (name plates/badges) ONLY if consistent with video.
- economy/personal-finance: use clear finance cues (charts, currency, receipts, bank app UI) and avoid sensational claims; keep it credible.
- gaming: show the game scene/HUD/character clearly + creator face; use high-contrast, dynamic elements tied to the game.
- news/documentary: editorial, credible, less gimmicky; use relevant imagery and clean composition.

Contextual visual elements (APPLY when mentioned in transcription):
- COUNTRIES/PLACES: If the video mentions specific countries, cities, or geographic locations, include the country FLAG as an element in at least 1-2 thumbnails (e.g. small flag icon in corner, flag overlay, or flag-themed accent). This adds instant visual context and recognition.
- BRAND LOGOS: If the video discusses recognizable brands (tech companies, car brands, food chains, sports teams, etc.), include the brand LOGO as an element in thumbnails where relevant. Place logos clearly but not as the main focus—use them to reinforce what the video is about.
- ARROWS & HIGHLIGHTS: Use bold arrows (curved, straight, or hand-drawn style) to point at key elements being discussed—especially useful for product reviews, comparisons, tutorials, or when highlighting specific features/details. Arrows draw attention and create visual hierarchy. Use in 1-2 thumbnails, not all.
- ELEMENT PLACEMENT: Flags typically work well as small overlays (corner badges, behind subject), logos near the product/topic they reference, arrows pointing from text toward the subject or feature being highlighted.

${isViral ? `STYLE GOAL (MANDATORY):
- Apply this compact viral style spec: ${viralStyleGuidelines}
- Keep ALL text fields short (avoid long paragraphs).` : ''}

CRITICAL: Output MUST be valid JSON ONLY (no markdown, no backticks, no extra text).

Language rules:
- The titles/subtitles MUST be in the SAME language as the transcription.

Title/subtitle rules (this is the main priority):
- "title" must be SPECIFIC and DESCRIPTIVE (avoid generic phrases like "WOW", "INCREÍBLE", "LO MEJOR" unless it clearly references what).
- "title" should contain the key hook noun (product/topic) OR the key pain/result (e.g., "Action 6", "Batería", "Estabilización", "Ruido", "Precio", "¿Merece la pena?").
- "title" should be short and punchy (ideally 2–5 words).
- "subtitle" is optional and should ADD context (2–6 words). It must not repeat the title.
- Do NOT use clickbait that contradicts the video. No made-up specs, no fake claims.

Visual description rules:
- "description" is VISUAL ONLY: framing, camera angle, composition, lighting, colors, subject, environment, props.
- Do NOT mention the title/subtitle text, do NOT mention typography, and do NOT mention "place the text" inside "description".

STRICT LENGTH BUDGET (MANDATORY):
- description: max 40 words (1–2 sentences)
- visualStyle: max 12 words
- background: max 14 words
- textStyle: max 14 words
- faceExpression: max 8 words
- textPosition: max 10 words
- elements: 0–2 items, each description max 10 words
- viralStyleGuidelines: return a short identifier only (e.g. "viral-yt-v1"), NOT a long paragraph

Return JSON with exactly this structure (array length must be 4, positions fixed):
{
  "videoType": "reaction|vlog|cooking|tutorial|interview|economy|...|other",
  "videoTags": ["reaction", "gaming", "memes"],
  "thumbnails": [
    {
      "position": "top-left",
      "videoType": "reaction",
      "tags": ["reaction","gaming","memes"],
      "videoTheme": "...",
      "title": "...",
      "subtitle": "...",
      "visualStyle": "...",
      "textStyle": "...",
      "background": "...",
      "faceExpression": "...",
      "textPosition": "...",
      "viralStyleGuidelines": "...",
      "elements": [
        { "type": "flag", "description": "Spanish flag small overlay", "position": "top-right corner" },
        { "type": "logo", "description": "Apple logo near product", "position": "beside iPhone" },
        { "type": "arrow", "description": "bold red arrow pointing to feature", "position": "from text to subject" }
      ],
      "description": "..."
    },
    { "position": "top-right",  "...": "..." },
    { "position": "bottom-left","...": "..." },
    { "position": "bottom-right","...": "..." }
  ]
}

Element types reference:
- "flag": country/region flag (use when locations are mentioned)
- "logo": brand/company logo (use when brands are discussed)
- "arrow": directional arrow to highlight elements (use for emphasis)
- "icon", "prop", "badge", "sticker", "shape", "product", "ui": other visual elements

Position style guidelines:
- top-left: Bold, vibrant, dramatic, high contrast.
- top-right: Clean, modern, minimalist, product/scene clarity.
- bottom-left: Dynamic, action-oriented, warm and energetic.
- bottom-right: Editorial, sophisticated, premium.

IMPORTANT:
- "elements" can be an empty array when not needed.
- If there is a human subject in reference frames, include "faceExpression" and keep the person faithful to the reference (same outfit, same face).
- If multiple distinct people appear in reference frames, you are allowed to include multiple people in thumbnails when it fits the videoType/tags (especially interview/podcast), but you MUST NOT invent faces that are not present in frames.`;

    const userPrompt = `Video title: ${videoTitle ? `"${videoTitle}"` : "(not provided)"}

Transcription (excerpt): """${transcription.substring(0, 2500)}"""

Task:
- Infer the true videoTheme.
- Create 4 distinct thumbnail concepts that would work for THIS video.
- Titles must be concrete and informative (no vague titles).
- Ensure all 4 titles are different and cover different hooks/angles (problem, verdict, comparison, pros/cons, test result, etc.).`;

    // Build content parts array for Gemini API
    const contentParts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }> = [
      { text: `${systemPrompt}\n\n${userPrompt}` }
    ];

    // Add reference frames as inline images
    contentParts.push({ text: "Video Content Reference Frames:" });
    for (const img of referenceFrames) {
      contentParts.push({
        inlineData: {
          mimeType: img.mimeType,
          data: img.data
        }
      });
    }

    const response = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': GEMINI_API_KEY,
        },
        body: JSON.stringify({
          contents: [
            {
              parts: contentParts,
            },
          ],
          generationConfig: {
            responseMimeType: 'application/json',
            temperature: 0.7,
          },
        })
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      logger.error('Gemini API error', { status: response.status, error: errorText });
      throw new Error(`Gemini API error: ${errorText}`);
    }

    const result = await response.json();
    
    // Extract text content from Gemini response
    const content = result.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!content) {
      logger.error('No content received from Gemini');
      throw new Error('No content received from Gemini');
    }

    // Parse JSON response
    let thumbnailPrompts: any;
    try {
      thumbnailPrompts = safeParseJson(content);
    } catch (e) {
      logger.error('Failed to parse JSON response', e, { content });
      throw e instanceof Error ? e : new Error('Invalid JSON response from Gemini');
    }

    const normalized = normalizeThumbnailPromptResponse(thumbnailPrompts);
    if (!Array.isArray(normalized.thumbnails) || normalized.thumbnails.length === 0) {
      const keys =
        thumbnailPrompts && typeof thumbnailPrompts === "object"
          ? Object.keys(thumbnailPrompts as Record<string, unknown>).slice(0, 40)
          : [];
      logger.error("Model returned unexpected JSON shape (no thumbnails array)", {
        type: typeof thumbnailPrompts,
        keys,
        preview: typeof content === "string" ? content.slice(0, 800) : "",
      });
    }

    const validatedThumbnails = buildValidatedThumbnails(normalized);

    logger.info(`Generated ${validatedThumbnails.length} thumbnail prompts`);

    return new Response(
      JSON.stringify({
        videoType: normalizeTag(normalized?.videoType) || undefined,
        videoTags: normalizeTags(normalized?.videoTags),
        thumbnails: validatedThumbnails,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    logger.error('Thumbnail prompt generation failed', error);
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

