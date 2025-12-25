import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

  try {
    const { thumbnailPrompts, frames } = await req.json();
    
    if (!thumbnailPrompts || !Array.isArray(thumbnailPrompts) || thumbnailPrompts.length !== 4) {
      throw new Error('Invalid thumbnailPrompts: must be an array with exactly 4 items');
    }

    const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
    if (!GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY not configured');
    }

    console.log('Generating 2x2 thumbnail grid...');

    const referenceFrames = pickReferenceFrames(frames, 5);
    console.log(`Reference frames received: ${Array.isArray(frames) ? frames.length : 0}, usable: ${referenceFrames.length}`);

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

      const visualStyle = typeof p.visualStyle === "string" && p.visualStyle.trim() ? ` Visual style: ${p.visualStyle.trim()}.` : "";
      const textStyle = typeof p.textStyle === "string" && p.textStyle.trim() ? ` Text style: ${p.textStyle.trim()}.` : "";
      const background = typeof p.background === "string" && p.background.trim() ? ` Background: ${p.background.trim()}.` : "";
      const faceExpression = typeof p.faceExpression === "string" && p.faceExpression.trim() ? ` Face expression: ${p.faceExpression.trim()}.` : "";
      const textPosition = typeof p.textPosition === "string" && p.textPosition.trim()
        ? ` Place the title/subtitle at ${p.textPosition.trim().replace("-", " ")} (single clear placement, high contrast).`
        : "";

      let elements = "";
      if (Array.isArray(p.elements) && p.elements.length > 0) {
        const items = p.elements
          .map((e: any) => {
            const desc = typeof e?.description === "string" ? e.description.trim() : "";
            const type = typeof e?.type === "string" ? e.type.trim() : "";
            const pos = typeof e?.position === "string" ? e.position.trim() : "";
            const parts = [type, desc].filter(Boolean).join(": ");
            return pos ? `${parts} (${pos})` : parts;
          })
          .filter(Boolean);
        if (items.length > 0) {
          elements = ` Extra elements/assets: ${items.join("; ")}.`;
        }
      }

      return `${p.description}${visualStyle}${background}${faceExpression}${textStyle}${textPosition}${elements}${overlay}`;
    };

    const gridPrompt = `You are creating a single image that contains a 2x2 grid of YouTube thumbnails. The grid should be arranged as follows:

TOP ROW:
- Left: ${getThumbnailPrompt('top-left')}
- Right: ${getThumbnailPrompt('top-right')}

BOTTOM ROW:
- Left: ${getThumbnailPrompt('bottom-left')}
- Right: ${getThumbnailPrompt('bottom-right')}

Requirements:
- Create a single image with a 2x2 grid layout
- Each cell should be a complete 16:9 thumbnail matching its description
- The 4 thumbnails should be visually distinct but cohesive
- Use the reference frames to match the subject/style when applicable. The faces and subjects should be faithful to the reference frames.
- Each thumbnail should be high quality, eye-catching, and YouTube-optimized
- IMPORTANT: Include each title/subtitle text EXACTLY ONCE per thumbnail (if subtitle is provided). Do not repeat the same text in different parts of a single thumbnail. Place it in a single, clear, high-contrast location.
- The final image should be exactly 3840x2160 pixels (2x width and 2x height of 1920x1080)
- Ensure clean borders between grid cells
- All 4 thumbnails should respect the video content shown in reference frames`;

    console.log('Generating grid image...');
    
    // Build content parts array for Gemini API (matching reference implementation)
    const contentParts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }> = [
      { text: gridPrompt }
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

    // Retry logic for Gemini API calls
    const maxRetries = 3;
    const baseDelay = 2000; // 2 seconds
    let lastError: Error | null = null;
    let response: Response | null = null;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        console.log(`Attempt ${attempt + 1} of ${maxRetries} to call Gemini API`);

        response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-image-preview:generateContent`,
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
                responseModalities: ["TEXT", "IMAGE"],
                imageConfig: {
                  aspectRatio: "16:9",
                  imageSize: "4K",
                },
              },
            })
          }
        );

        if (response.ok) {
          console.log("Gemini API call successful");
          break; // Success, exit retry loop
        }

        const errorText = await response.text();
        console.error(`Gemini API error on attempt ${attempt + 1}:`, response.status, errorText);
        
        // Handle specific error codes
        if (response.status === 429 || response.status === 503 || response.status === 500) {
          if (attempt < maxRetries - 1) {
            const delay = baseDelay * Math.pow(2, attempt);
            console.log(`Retrying after ${delay}ms...`);
            await new Promise(resolve => setTimeout(resolve, delay));
            continue;
          }
        }

        lastError = new Error(`Gemini API error: ${response.status} ${errorText}`);
        break; // Don't retry on 400, 403, etc.

      } catch (error) {
        console.error(`Network error on attempt ${attempt + 1}:`, error);
        lastError = error instanceof Error ? error : new Error(String(error));

        if (attempt < maxRetries - 1) {
          const delay = baseDelay * Math.pow(2, attempt);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
      }
    }

    if (!response || !response.ok) {
      throw lastError || new Error('Failed to generate image after multiple attempts');
    }

    const result = await response.json();
    
    // Extract image from response
    let gridImage: string | null = null;
    const parts = result.candidates?.[0]?.content?.parts || [];
    for (const part of parts) {
      // API can return either inlineData (camelCase) or inline_data (snake_case) depending on client
      const inline = part.inlineData ?? part.inline_data;
      const mimeType = inline?.mimeType ?? inline?.mime_type;
      const data = inline?.data;
      if (typeof mimeType === "string" && mimeType.startsWith("image/") && typeof data === "string") {
        gridImage = `data:${mimeType};base64,${data}`;
        break;
      }
    }

    if (!gridImage) {
      throw new Error('No image received from Gemini API');
    }

    console.log('Generated 2x2 grid image successfully');

    return new Response(
      JSON.stringify({ gridImage, prompt: gridPrompt }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Thumbnail generation error:', error);
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

