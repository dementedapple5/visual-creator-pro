import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { createLogger } from "../_shared/logger.ts";

const logger = createLogger("generate-titles");

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { transcription } = await req.json();
    logger.info("Starting title generation", { transcriptionLength: transcription?.length });
    
    if (!transcription) {
      logger.error("No transcription provided");
      throw new Error('No transcription provided');
    }

    const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
    if (!GEMINI_API_KEY) {
      logger.error("GEMINI_API_KEY not configured");
      throw new Error('GEMINI_API_KEY not configured');
    }

    const systemPrompt = `You are an expert YouTube title optimizer. Your job is to create compelling, click-worthy titles that:
- Are under 60 characters when possible
- Create curiosity and intrigue
- Use power words that drive clicks
- Are honest and accurately represent the content
- Follow successful YouTube title patterns
- IMPORTANT: All titles MUST be in the same language as the video transcription provided.

Return exactly 4 title suggestions in a JSON object with this structure:
{
  "titles": ["Title 1", "Title 2", "Title 3", "Title 4"]
}`;

    const userPrompt = `Based on this video transcription, generate 4 compelling YouTube title suggestions:\n\n${transcription.substring(0, 3000)}`;

    logger.info("Calling Gemini API for titles");
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
              parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }],
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
      logger.error("No content received from Gemini");
      throw new Error('No content received from Gemini');
    }

    // Parse JSON response
    let titles: string[] = [];
    try {
      const parsed = JSON.parse(content);
      titles = parsed.titles || [];
    } catch (e) {
      logger.error('Failed to parse JSON response', e, { content });
      // Fallback: try simple line splitting if JSON parse fails
      titles = content
        .split('\n')
        .filter((line: string) => line.trim())
        .map((line: string) => line.replace(/^[0-9].\s*/, '').replace(/^-\s*/, '').trim())
        .slice(0, 4);
    }

    logger.info(`Generated ${titles.length} titles`);

    return new Response(
      JSON.stringify({ titles }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    logger.error('Title generation failed', error);
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

