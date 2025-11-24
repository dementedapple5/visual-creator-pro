import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface ThumbnailData {
  avatarId?: string;
  productIds?: string[];
  title?: string;
  subtitle?: string;
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
    const resolution = thumbnailData.aspectRatio === "9:16" ? "1080x1920" : "2560x1440";
    let prompt = `Generate a high-impact ${platformType} thumbnail in ${resolution} resolution. `;

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
      }
    }

    // Text styling
    if (thumbnailData.title) {
      const textStyles: Record<string, string> = {
        bold: "large, bold, and impactful",
        modern: "modern, clean, and sleek",
        playful: "playful, fun, and colorful",
        professional: "professional and clean",
        neon: "with neon glow effects",
        "3d": "with 3D dimensional effects",
      };
      const textStyle = thumbnailData.textStyle
        ? textStyles[thumbnailData.textStyle]
        : "bold";
      prompt += `Include the text "${thumbnailData.title}" in ${textStyle} typography. `;
      
      if (thumbnailData.subtitle) {
        prompt += `Subtitle: "${thumbnailData.subtitle}" in smaller complementary text. `;
      }
    }

    // Expression for avatar
    if (thumbnailData.avatarId && thumbnailData.expression) {
      prompt += `The person should have a ${thumbnailData.expression} facial expression. `;
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

    // Call Lovable AI with Gemini 3 Pro Image
    const response = await fetch(
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
          modalities: ["image", "text"],
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI Gateway error:", response.status, errorText);
      
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
      
      throw new Error(`AI Gateway error: ${response.status} ${errorText}`);
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
