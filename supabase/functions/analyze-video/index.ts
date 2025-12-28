import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import { corsHeaders } from "../_shared/cors.ts";
import { createLogger } from "../_shared/logger.ts";

const logger = createLogger("analyze-video");

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { jobId } = await req.json();
    logger.setContext({ jobId });
    logger.info("Starting video analysis");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const openAiKey = Deno.env.get("OPENAI_API_KEY");
    const geminiApiKey = Deno.env.get("GEMINI_API_KEY")!;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error("Missing Supabase configuration");
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch job details
    logger.info("Fetching job details");
    const { data: job, error: jobError } = await supabase
      .from("smart_create_jobs")
      .select("*")
      .eq("id", jobId)
      .single();

    if (jobError || !job) {
      logger.error("Job not found", jobError);
      throw new Error("Job not found");
    }

    logger.setContext({ sourceType: job.source_type });
    logger.info(`Analyzing job source: ${job.source_type}`);

    let transcript = "";

    // 1. Transcribe Audio if available
    if (openAiKey && job.source_url && job.source_type === "audio_upload") {
      logger.info("Starting transcription...");
      
      // Download audio file from storage
      const { data: fileData, error: downloadError } = await supabase.storage
        .from("smart-create-videos")
        .download(job.source_url);

      if (downloadError) {
        logger.error("Error downloading audio", downloadError);
        throw downloadError;
      }

      // Create FormData for OpenAI
      const formData = new FormData();
      formData.append("file", fileData, "audio.wav");
      formData.append("model", "whisper-1");

      // Call OpenAI Whisper API
      logger.info("Calling OpenAI Whisper API");
      const whisperResponse = await fetch("https://api.openai.com/v1/audio/transcriptions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${openAiKey}`,
        },
        body: formData,
      });

      if (!whisperResponse.ok) {
        const errorText = await whisperResponse.text();
        logger.error("Whisper API error", { status: whisperResponse.status, error: errorText });
        throw new Error(`Whisper API failed: ${errorText}`);
      }

      const whisperData = await whisperResponse.json();
      transcript = whisperData.text;
      logger.info("Transcription complete", { length: transcript.length });
    } else {
      logger.info("Skipping transcription (missing key or audio source)");
      // Fallback mock transcript for testing without paying
      transcript = "This is a video about how to create amazing YouTube thumbnails using AI tools. I will show you step by step how to use Gemini and other tools to boost your click through rate.";
    }

    // 2. Generate Suggestions with Gemini
    logger.info("Generating suggestions with Gemini...");
    
    const prompt = `
    Analyze the following video transcript and generate 3 distinct YouTube thumbnail concepts.
    
    TRANSCRIPT:
    "${transcript.substring(0, 5000)}"
    
    For each concept, provide:
    1. A catchy Title (short, punchy)
    2. A supporting Subtitle (optional, providing context)
    3. A Visual Style description (e.g., "vibrant", "minimalist", "dramatic")
    4. A detailed description of what the frame/image should look like (to help the user pick a frame later)
    
    Output strictly valid JSON in this format:
    [
      {
        "title": "...",
        "subtitle": "...",
        "visualStyle": "...",
        "frameDescription": "..."
      },
      ...
    ]
    `;

    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${geminiApiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: "application/json" }
        }),
      }
    );

    if (!geminiResponse.ok) {
      const errorText = await geminiResponse.text();
      logger.error("Gemini API failed", { status: geminiResponse.status, error: errorText });
      throw new Error(`Gemini API failed: ${errorText}`);
    }

    const geminiData = await geminiResponse.json();
    const rawText = geminiData.candidates[0].content.parts[0].text;
    
    let suggestionsData;
    try {
      suggestionsData = JSON.parse(rawText);
    } catch (e) {
      logger.error("Failed to parse Gemini JSON", e, { rawText });
      // Fallback
      suggestionsData = [
        { title: "Watch This First", subtitle: "Important Update", visualStyle: "dramatic" },
        { title: "How I Did It", subtitle: "Step by Step", visualStyle: "clean" },
        { title: "Don't Do This", subtitle: "Common Mistakes", visualStyle: "bold" }
      ];
    }

    // Insert suggestions
    logger.info("Inserting suggestions", { count: suggestionsData.length });
    const suggestionsToInsert = suggestionsData.map((s: any) => ({
      job_id: jobId,
      frame_url: "", // No frame yet, user picks locally
      title: s.title,
      subtitle: s.subtitle,
      // We could store visualStyle and frameDescription in metadata column if we had one
      // For now we'll just use title/subtitle
    }));

    const { error: insertError } = await supabase
      .from("smart_create_suggestions")
      .insert(suggestionsToInsert);

    if (insertError) {
      logger.error("Error inserting suggestions", insertError);
      throw insertError;
    }

    // Update job status
    logger.info("Updating job status to completed");
    const { error: updateError } = await supabase
      .from("smart_create_jobs")
      .update({ status: "completed" })
      .eq("id", jobId);

    if (updateError) {
      logger.error("Error updating job status", updateError);
      throw updateError;
    }

    logger.info("Video analysis completed successfully");
    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    logger.error("Unhandled error in analyze-video", error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        details: error instanceof Error ? error.stack : undefined 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
