import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface ThumbnailData {
  avatarId?: string;
  productId?: string;
  title?: string;
  subtitle?: string;
  expression?: string;
  visualStyle?: string;
  textStyle?: string;
  backgroundType?: string;
  backgroundValue?: string;
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
    let prompt = `Generate a high-impact thumbnail in 2K resolution. `;

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
        prompt += `Background: ${thumbnailData.backgroundValue}. `;
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

    // Collect images (avatar and product)
    const images: string[] = [];

    if (thumbnailData.avatarId) {
      const { data: avatar } = await supabase
        .from("avatars")
        .select("image_url")
        .eq("id", thumbnailData.avatarId)
        .single();

      if (avatar?.image_url) {
        // Fetch and convert to base64
        const imageResponse = await fetch(avatar.image_url);
        const imageBuffer = await imageResponse.arrayBuffer();
        const base64 = btoa(String.fromCharCode(...new Uint8Array(imageBuffer)));
        images.push(base64);
        prompt += `Include the person from the provided image. `;
      }
    }

    if (thumbnailData.productId) {
      const { data: product } = await supabase
        .from("products")
        .select("image_url")
        .eq("id", thumbnailData.productId)
        .single();

      if (product?.image_url) {
        const imageResponse = await fetch(product.image_url);
        const imageBuffer = await imageResponse.arrayBuffer();
        const base64 = btoa(String.fromCharCode(...new Uint8Array(imageBuffer)));
        images.push(base64);
        prompt += `Include the product from the provided image. `;
      }
    }

    // Custom background
    if (thumbnailData.backgroundType === "custom" && thumbnailData.backgroundValue) {
      const imageResponse = await fetch(thumbnailData.backgroundValue);
      const imageBuffer = await imageResponse.arrayBuffer();
      const base64 = btoa(String.fromCharCode(...new Uint8Array(imageBuffer)));
      images.push(base64);
      prompt += `Use the provided image as the background. `;
    }

    console.log("Generated prompt:", prompt);
    console.log("Number of images:", images.length);

    // Build the content array
    const contentParts: any[] = [{ type: "text", text: prompt }];

    // Add images
    for (const base64Image of images) {
      contentParts.push({
        type: "inline_data",
        inline_data: {
          mime_type: "image/jpeg",
          data: base64Image,
        },
      });
    }

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
          modalities: ["image"],
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI Gateway error:", response.status, errorText);
      throw new Error(`AI Gateway error: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    console.log("AI response received");

    // Extract the base64 image from the response
    const imageData = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;

    if (!imageData) {
      console.error("No image in response:", JSON.stringify(data));
      throw new Error("No image returned from AI");
    }

    // Upload to storage
    const { data: { user } } = await supabase.auth.getUser(
      req.headers.get("Authorization")?.replace("Bearer ", "") || ""
    );

    if (!user) {
      throw new Error("User not authenticated");
    }

    const fileName = `${user.id}/${Date.now()}.png`;

    // Convert base64 to blob
    const base64Data = imageData.split(",")[1];
    const binaryData = Uint8Array.from(atob(base64Data), (c) => c.charCodeAt(0));

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

    console.log("Image uploaded successfully");

    return new Response(
      JSON.stringify({ imageUrl: publicUrl }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error in generate-thumbnail function:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
