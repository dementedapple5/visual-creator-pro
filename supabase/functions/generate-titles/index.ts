import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { transcription } = await req.json();
    
    if (!transcription) {
      throw new Error('No transcription provided');
    }

    const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
    if (!GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY not configured');
    }

    console.log('Generating titles for transcription with Gemini 2.0 Flash...');

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
      console.error('Gemini API error:', errorText);
      throw new Error(`Gemini API error: ${errorText}`);
    }

    const result = await response.json();
    
    // Extract text content from Gemini response
    const content = result.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!content) {
      throw new Error('No content received from Gemini');
    }

    // Parse JSON response
    let titles: string[] = [];
    try {
      const parsed = JSON.parse(content);
      titles = parsed.titles || [];
    } catch (e) {
      console.error('Failed to parse JSON response:', content);
      // Fallback: try simple line splitting if JSON parse fails
      titles = content
        .split('\n')
        .filter((line: string) => line.trim())
        .map((line: string) => line.replace(/^[0-9].\s*/, '').replace(/^-\s*/, '').trim())
        .slice(0, 4);
    }

    console.log(`Generated ${titles.length} titles`);

    return new Response(
      JSON.stringify({ titles }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Title generation error:', error);
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

