import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface ThumbnailData {
  avatarId?: string;
  avatarPosition?: string;
  productIds?: string[];
  productPosition?: string;
  title?: string;
  subtitle?: string;
  textPosition?: string;
  expression?: string;
  visualStyle?: string;
  textStyle?: string;
  backgroundType?: string;
  backgroundValue?: string;
  aspectRatio?: string;
  iterationPrompt?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY")!;

    const supabase = createClient(supabaseUrl, supabaseKey);

    const { thumbnailData } = await req.json() as { thumbnailData: ThumbnailData };

    console.log("Thumbnail data received:", thumbnailData);

    // Build the prompt
    const platformType = thumbnailData.aspectRatio === "9:16" ? "TikTok/Instagram story" : "YouTube";
    const aspectRatio = thumbnailData.aspectRatio || "16:9";
    const imageSize = "2K"; // High quality 2K resolution
    let prompt = `Generate a high-impact ${platformType} thumbnail. `;

    // Visual style
    if (thumbnailData.visualStyle) {
      const styles: Record<string, string> = {
        epic: "Epic and bold with dramatic lighting and strong contrast",
        dramatic: "Cinematic and dramatic with high contrast",
        vibrant: "Vibrant, colorful, and energetic",
        professional: "Clean, professional, and polished",
        creative: "Artistic, creative, and unique",
        minimalist: "Simple, minimalist, and elegant",
      };
      prompt += `Style: ${styles[thumbnailData.visualStyle] || thumbnailData.visualStyle}. `;
    }

    // Background
    if (thumbnailData.backgroundType && thumbnailData.backgroundValue) {
      if (thumbnailData.backgroundType === "preset") {
        prompt += `Background: ${thumbnailData.backgroundValue} setting. `;
      } else if (thumbnailData.backgroundType === "color") {
        prompt += `Background: solid ${thumbnailData.backgroundValue} color. `;
      } else if (thumbnailData.backgroundType === "prompt" || thumbnailData.backgroundType === "custom-prompt") {
        prompt += `Background: ${thumbnailData.backgroundValue}. `;
      } else if (thumbnailData.backgroundType === "avatar-bg") {
        prompt += `Keep the original background from the avatar image. `;
      }
    }

    // Text styling
    if (thumbnailData.title) {
      const textStyles: Record<string, string> = {
        "Bold & Large": "large, bold, and impactful",
        "Elegant Script": "elegant script style",
        "Modern Sans": "modern, clean sans-serif",
        "Handwritten": "handwritten style",
        "Futuristic": "futuristic style with modern effects",
        "Classic Serif": "classic serif typography"
      };
      const textStyle = thumbnailData.textStyle && textStyles[thumbnailData.textStyle]
        ? textStyles[thumbnailData.textStyle]
        : "bold and large";
      prompt += `Include the text "${thumbnailData.title}" in ${textStyle} typography. `;
      
      if (thumbnailData.subtitle) {
        prompt += `Subtitle: "${thumbnailData.subtitle}" in smaller complementary text. `;
      }

      // Add text positioning
      if (thumbnailData.textPosition) {
        prompt += `Position the text at ${thumbnailData.textPosition.replace('-', ' ')}. `;
      }
    }

    // Expression for avatar
    if (thumbnailData.avatarId && thumbnailData.expression) {
      prompt += `The person should have a ${thumbnailData.expression} facial expression. `;
    }

    // Avatar positioning
    if (thumbnailData.avatarId && thumbnailData.avatarPosition) {
      prompt += `Position the avatar at ${thumbnailData.avatarPosition.replace('-', ' ')}. `;
    }

    // Product positioning
    if (thumbnailData.productIds && thumbnailData.productIds.length > 0 && thumbnailData.productPosition) {
      prompt += `Position the product(s) at ${thumbnailData.productPosition.replace('-', ' ')}. `;
    }

    // Iteration prompt for refinement
    if (thumbnailData.iterationPrompt) {
      prompt += `\n\nADDITIONAL CHANGES REQUESTED:\n${thumbnailData.iterationPrompt}\n`;
    }

    // Build content array with text and images
    const contentParts: Array<{ type: string; text?: string; image_url?: { url: string } }> = [
      { type: "text", text: prompt }
    ];

    // Helper function to fetch and convert image to base64
    const fetchImageAsBase64 = async (url: string): Promise<string> => {
      const response = await fetch(url);
      const arrayBuffer = await response.arrayBuffer();
      const arr = new Uint8Array(arrayBuffer);
      // Use reduce to avoid stack overflow with large images
      const base64 = btoa(arr.reduce((data, byte) => data + String.fromCharCode(byte), ''));
      return `data:image/jpeg;base64,${base64}`;
    };

    // Add avatar image
    if (thumbnailData.avatarId) {
      const { data: avatar } = await supabase
        .from("avatars")
        .select("image_url")
        .eq("id", thumbnailData.avatarId)
        .single();

      if (avatar?.image_url) {
        const base64Image = await fetchImageAsBase64(avatar.image_url);
        contentParts.push({
          type: "image_url",
          image_url: { url: base64Image }
        });
        prompt += `Include the person from the provided image. `;
      }
    }

    // Add product images
    if (thumbnailData.productIds && thumbnailData.productIds.length > 0) {
      const { data: products } = await supabase
        .from("products")
        .select("image_url")
        .in("id", thumbnailData.productIds);

      if (products && products.length > 0) {
        for (const product of products) {
          if (product.image_url) {
            const base64Image = await fetchImageAsBase64(product.image_url);
            contentParts.push({
              type: "image_url",
              image_url: { url: base64Image }
            });
          }
        }
        const count = products.length;
        prompt += `Include ${count} product${count > 1 ? 's' : ''} from the provided image${count > 1 ? 's' : ''} prominently in the composition. `;
      }
    }

    // Add custom background
    if (thumbnailData.backgroundType === "custom" && thumbnailData.backgroundValue) {
      const base64Image = await fetchImageAsBase64(thumbnailData.backgroundValue);
      contentParts.push({
        type: "image_url",
        image_url: { url: base64Image }
      });
      prompt += `Use the provided image as the background. `;
    }

    console.log("Generated prompt:", prompt);
    console.log("Number of content parts:", contentParts.length);

    // Retry logic for AI Gateway calls
    const maxRetries = 3;
    const baseDelay = 2000; // 2 seconds
    let lastError: Error | null = null;
    let response: Response | null = null;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        console.log(`Attempt ${attempt + 1} of ${maxRetries} to call AI Gateway`);
        
        // Call Lovable AI with Gemini 3 Pro Image
        response = await fetch(
          "https://ai.gateway.lovable.dev/v1/chat/completions",
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${lovableApiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "google/gemini-3-pro-image-preview",
              messages: [
                {
                  role: "user",
                  content: contentParts,
                },
              ],
              config: {
                responseModalities: ['TEXT', 'IMAGE'],
                imageConfig: {
                  aspectRatio: aspectRatio,
                  imageSize: imageSize,
                },
              },
            }),
          }
        );

        if (response.ok) {
          console.log("AI Gateway call successful");
          break; // Success, exit retry loop
        }

        const errorText = await response.text();
        console.error(`AI Gateway error on attempt ${attempt + 1}:`, response.status, errorText);
        
        // Handle specific error codes
        if (response.status === 429) {
          return new Response(
            JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }),
            { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        
        if (response.status === 402) {
          return new Response(
            JSON.stringify({ error: "Payment required. Please add credits to your workspace." }),
            { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // For 503 and 500 errors, retry with exponential backoff
        if (response.status === 503 || response.status === 500) {
          if (attempt < maxRetries - 1) {
            const delay = baseDelay * Math.pow(2, attempt);
            console.log(`Retrying after ${delay}ms...`);
            await new Promise(resolve => setTimeout(resolve, delay));
            continue;
          }
        }
        
        lastError = new Error(`AI Gateway error: ${response.status} ${errorText}`);
        
      } catch (error) {
        console.error(`Network error on attempt ${attempt + 1}:`, error);
        lastError = error instanceof Error ? error : new Error(String(error));
        
        // Retry on network errors
        if (attempt < maxRetries - 1) {
          const delay = baseDelay * Math.pow(2, attempt);
          console.log(`Retrying after network error in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
      }
    }

    // If all retries failed
    if (!response || !response.ok) {
      const errorMessage = lastError?.message || "Failed to generate thumbnail after multiple attempts";
      console.error("All retry attempts failed:", errorMessage);
      return new Response(
        JSON.stringify({ 
          error: "The AI service is temporarily unavailable. Please try again in a few moments.",
          details: errorMessage
        }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    console.log("AI response received");

    // Extract the base64 image from the response
    const imageData = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;

    if (!imageData) {
      console.error("No image in response. Response structure:", JSON.stringify(data, null, 2));
      throw new Error("No image returned from AI");
    }

    console.log("Image data received, preparing to upload to storage");

    // Get authenticated user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("No authorization header");
    }

    const { data: { user }, error: userError } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", "")
    );

    if (userError || !user) {
      console.error("User auth error:", userError);
      throw new Error("User not authenticated");
    }

    const fileName = `${user.id}/${Date.now()}.png`;

    // Convert base64 to binary
    const base64Data = imageData.includes(",") ? imageData.split(",")[1] : imageData;
    const binaryData = Uint8Array.from(atob(base64Data), (c) => c.charCodeAt(0));

    console.log("Uploading image to storage, size:", binaryData.length);

    const { error: uploadError } = await supabase.storage
      .from("thumbnails")
      .upload(fileName, binaryData, {
        contentType: "image/png",
      });

    if (uploadError) {
      console.error("Upload error:", uploadError);
      throw uploadError;
    }

    const { data: { publicUrl } } = supabase.storage
      .from("thumbnails")
      .getPublicUrl(fileName);

    console.log("Image uploaded successfully:", publicUrl);

    return new Response(
      JSON.stringify({ imageUrl: publicUrl }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error in generate-thumbnail function:", error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : "Unknown error",
        details: error instanceof Error ? error.stack : undefined
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
