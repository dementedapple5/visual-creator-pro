import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type ThumbnailPosition = "top-left" | "top-right" | "bottom-left" | "bottom-right";

type ThumbnailPrompt = {
  position: ThumbnailPosition;
  // Core semantic fields (new)
  videoTheme: string;
  title: string;
  subtitle?: string;
  visualStyle?: string;
  textStyle?: string;
  background?: string;
  faceExpression?: string;
  textPosition?: string;
  elements?: Array<{
    type?: string; // icon | prop | badge | sticker | shape | product | ui
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

function clampWords(s: string, maxWords: number): string {
  const words = s.split(/\s+/).filter(Boolean);
  if (words.length <= maxWords) return s;
  return words.slice(0, maxWords).join(" ");
}

function buildValidatedThumbnails(raw: any): ThumbnailPrompt[] {
  const positions: ThumbnailPosition[] = ['top-left', 'top-right', 'bottom-left', 'bottom-right'];
  const src = raw?.thumbnails;
  if (!Array.isArray(src)) {
    throw new Error('Invalid response structure: missing thumbnails array');
  }

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

    const description = normalizeWhitespace(t.description);
    if (!description) {
      throw new Error(`Missing thumbnail description for position: ${position}`);
    }
    if (!title) {
      throw new Error(`Missing thumbnail title for position: ${position}`);
    }

    const visualStyle = normalizeWhitespace(t.visualStyle) || undefined;
    const textStyle = normalizeWhitespace(t.textStyle) || undefined;
    const background = normalizeWhitespace(t.background) || undefined;
    const faceExpression = normalizeWhitespace(t.faceExpression) || undefined;
    const textPosition = normalizeWhitespace(t.textPosition) || undefined;
    const elements = Array.isArray(t.elements) ? t.elements : undefined;

    return {
      position,
      videoTheme,
      title,
      subtitle,
      visualStyle,
      textStyle,
      background,
      faceExpression,
      textPosition,
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
    const { transcription, videoTitle, frames } = await req.json();
    
    if (!transcription) {
      throw new Error('No transcription provided');
    }

    const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
    if (!GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY not configured');
    }

    console.log('Generating thumbnail prompts with Gemini 2.0 Flash...');

    const referenceFrames = pickReferenceFrames(frames, 5);
    console.log(`Reference frames received: ${Array.isArray(frames) ? frames.length : 0}, usable: ${referenceFrames.length}`);

    // Build the prompt
    const systemPrompt = `You are an expert YouTube thumbnail strategist + designer.

Goal: Generate 4 PROFESSIONAL YouTube thumbnail concepts for a 2x2 grid (4 distinct variations), tightly aligned with the video's real topic.

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

Return JSON with exactly this structure (array length must be 4, positions fixed):
{
  "thumbnails": [
    {
      "position": "top-left",
      "videoTheme": "...",
      "title": "...",
      "subtitle": "...",
      "visualStyle": "...",
      "textStyle": "...",
      "background": "...",
      "faceExpression": "...",
      "textPosition": "...",
      "elements": [{ "type": "...", "description": "...", "position": "..." }],
      "description": "..."
    },
    { "position": "top-right",  "...": "..." },
    { "position": "bottom-left","...": "..." },
    { "position": "bottom-right","...": "..." }
  ]
}

Position style guidelines:
- top-left: Bold, vibrant, dramatic, high contrast.
- top-right: Clean, modern, minimalist, product/scene clarity.
- bottom-left: Dynamic, action-oriented, warm and energetic.
- bottom-right: Editorial, sophisticated, premium.

IMPORTANT:
- "elements" can be an empty array when not needed.
- If there is a human subject in reference frames, include "faceExpression" and keep the person faithful to the reference (same outfit, same face).`;

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
    for (const img of referenceFrames) {
      contentParts.push({
        inlineData: {
          mimeType: img.mimeType,
          data: img.data
        }
      });
    }

    const response = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent',
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
      console.error('Gemini API error:', errorText);
      throw new Error(`Gemini API error: ${errorText}`);
    }

    const result = await response.json();
    
    // Extract text content from Gemini response
    const content = result.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!content) {
      throw new Error('No content received from Gemini');
    }

    // Parse + validate JSON response
    let thumbnailPrompts: any;
    try {
      thumbnailPrompts = safeParseJson(content);
    } catch (e) {
      console.error('Failed to parse JSON response:', content);
      throw e instanceof Error ? e : new Error('Invalid JSON response from Gemini');
    }

    const validatedThumbnails = buildValidatedThumbnails(thumbnailPrompts);

    console.log(`Generated ${validatedThumbnails.length} thumbnail prompts`);

    return new Response(
      JSON.stringify({ thumbnails: validatedThumbnails }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Thumbnail prompt generation error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

