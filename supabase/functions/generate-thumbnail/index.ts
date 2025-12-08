import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface ThumbnailData {
  avatarId?: string;
  customAvatarUrl?: string;
  avatarPosition?: string;
  productIds?: string[]; // Legacy support
  productPosition?: string; // Legacy support
  elements?: {
    id?: string;
    url?: string;
    position: string;
  }[];
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

  const startedAt = Date.now();
  let generationId: string | null = null;
  let supabase: ReturnType<typeof createClient> | null = null;
  let userId: string | null = null;

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const geminiApiKey = Deno.env.get("GEMINI_API_KEY")!;

    supabase = createClient(supabaseUrl, supabaseKey);

    const { thumbnailData, remixImageUrl, remixPrompt } = await req.json() as {
      thumbnailData: ThumbnailData;
      remixImageUrl?: string;
      remixPrompt?: string;
    };

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

    userId = user.id;

    const generationMode = remixImageUrl
      ? "remix"
      : thumbnailData.iterationPrompt
        ? "iterate"
        : "create";

    const { data: generationRecord, error: generationError } = await supabase
      .from("generations")
      .insert({
        user_id: userId,
        status: "processing",
        mode: generationMode,
        request: { thumbnailData, remixPrompt, remixImageUrl },
        prompt: thumbnailData?.iterationPrompt || null,
        remix_prompt: remixPrompt || null,
        aspect_ratio: thumbnailData?.aspectRatio || null,
        title: thumbnailData?.title || null,
        subtitle: thumbnailData?.subtitle || null,
      })
      .select("id")
      .single();

    if (generationError) {
      throw generationError;
    }

    generationId = generationRecord?.id || null;

    console.log("Thumbnail data received:", thumbnailData);
    console.log("Remix mode:", !!remixImageUrl);

    // Build the prompt
    const platformType = thumbnailData.aspectRatio === "9:16" ? "TikTok/Instagram story" : "YouTube";
    const aspectRatio = thumbnailData.aspectRatio || "16:9";

    let prompt = "";

    // Check if this is a remix request
    if (remixImageUrl && remixPrompt) {
      prompt = `You are remixing an existing thumbnail. Apply the following changes to the image: ${remixPrompt}

CRITICAL: Maintain the overall composition and style of the original thumbnail while applying the requested changes.`;
    } else {
      prompt = `Generate a high-impact ${platformType} thumbnail with ${aspectRatio} aspect ratio. 

CRITICAL INSTRUCTIONS:
- PRESERVE the exact appearance, face, outfit, and styling of any people shown in the provided images
- Do NOT modify facial features, clothing, or accessories of the people
- Keep them looking EXACTLY as they appear in the source images`;
    }

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
        prompt += `\n\nBackground: ${thumbnailData.backgroundValue} setting. `;
      } else if (thumbnailData.backgroundType === "color") {
        prompt += `\n\nBackground: solid ${thumbnailData.backgroundValue} color. `;
      } else if (thumbnailData.backgroundType === "prompt" || thumbnailData.backgroundType === "custom-prompt") {
        prompt += `\n\nBackground: ${thumbnailData.backgroundValue}. `;
      } else if (thumbnailData.backgroundType === "avatar" || thumbnailData.backgroundType === "avatar-bg") {
        prompt += `\n\nCRITICAL: Keep and preserve the EXACT original background from the avatar image. Do NOT change, modify, or replace the background in any way. The background must remain identical to the source avatar image. `;
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
    if ((thumbnailData.avatarId || thumbnailData.customAvatarUrl) && thumbnailData.expression) {
      prompt += `The person should have a ${thumbnailData.expression} facial expression. `;
    }

    // Avatar positioning
    if ((thumbnailData.avatarId || thumbnailData.customAvatarUrl) && thumbnailData.avatarPosition) {
      prompt += `Position the avatar at ${thumbnailData.avatarPosition.replace('-', ' ')}. `;
    }

    // Elements positioning
    if (thumbnailData.elements && thumbnailData.elements.length > 0) {
      thumbnailData.elements.forEach((element, index) => {
        const position = element.position.replace('-', ' ');
        // We can't easily identify "which" element is which in the prompt without more context,
        // but we can give general instructions or try to map them by order.
        // Since we are sending images in order, we can refer to them by order.
        // However, mixing avatar and elements makes "order" tricky for the model.
        // A simple approach is to list positions.
        prompt += `Position element ${index + 1} at ${position}. `;
      });
    } else if (thumbnailData.productIds && thumbnailData.productIds.length > 0 && thumbnailData.productPosition) {
      // Legacy support
      prompt += `Position the product(s) at ${thumbnailData.productPosition.replace('-', ' ')}. `;
    }

    // Iteration prompt for refinement
    if (thumbnailData.iterationPrompt) {
      prompt += `\n\nADDITIONAL CHANGES REQUESTED:\n${thumbnailData.iterationPrompt}\n`;
    }

    // Build content parts array for Gemini API
    const contentParts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }> = [
      { text: prompt }
    ];

    // Helper function to fetch and convert image to base64 (without data URI prefix)
    const fetchImageAsBase64 = async (url: string): Promise<string> => {
      const response = await fetch(url);
      const arrayBuffer = await response.arrayBuffer();
      const arr = new Uint8Array(arrayBuffer);
      // Use reduce to avoid stack overflow with large images
      const base64 = btoa(arr.reduce((data, byte) => data + String.fromCharCode(byte), ''));
      return base64;
    };

    // If this is a remix, add the source image first
    if (remixImageUrl) {
      const base64Image = await fetchImageAsBase64(remixImageUrl);
      contentParts.push({
        inlineData: {
          mimeType: "image/jpeg",
          data: base64Image
        }
      });
    }

    // Add avatar image (skip in remix mode)
    if (!remixImageUrl) {
      if (thumbnailData.customAvatarUrl) {
        // Use custom uploaded avatar
        const base64Image = await fetchImageAsBase64(thumbnailData.customAvatarUrl);
        contentParts.push({
          inlineData: {
            mimeType: "image/jpeg",
            data: base64Image
          }
        });
      } else if (thumbnailData.avatarId) {
        // Fetch avatar from DB
        const { data: avatar } = await supabase
          .from("avatars")
          .select("image_url")
          .eq("id", thumbnailData.avatarId)
          .single();

        if (avatar?.image_url) {
          const base64Image = await fetchImageAsBase64(avatar.image_url);
          contentParts.push({
            inlineData: {
              mimeType: "image/jpeg",
              data: base64Image
            }
          });
        }
      }
    }

    // Add element images (skip in remix mode)
    if (!remixImageUrl) {
      if (thumbnailData.elements && thumbnailData.elements.length > 0) {
        // Process new elements structure
        for (const element of thumbnailData.elements) {
          if (element.url) {
            // Custom element URL
            const base64Image = await fetchImageAsBase64(element.url);
            contentParts.push({
              inlineData: {
                mimeType: "image/jpeg",
                data: base64Image
              }
            });
          } else if (element.id) {
            // Library element (product)
            // We need to fetch the image URL for this product ID
            // Assuming product_images table links to product_id
            const { data: productImages } = await supabase
              .from("product_images")
              .select("image_url")
              .eq("product_id", element.id)
              .limit(1); // Just take the first image for now

            if (productImages && productImages.length > 0 && productImages[0].image_url) {
              const base64Image = await fetchImageAsBase64(productImages[0].image_url);
              contentParts.push({
                inlineData: {
                  mimeType: "image/jpeg",
                  data: base64Image
                }
              });
            }
          }
        }
      } else if (thumbnailData.productIds && thumbnailData.productIds.length > 0) {
        // Legacy support for productIds
        const { data: productImages } = await supabase
          .from("product_images")
          .select("image_url")
          .in("product_id", thumbnailData.productIds);

        if (productImages && productImages.length > 0) {
          for (const productImage of productImages) {
            if (productImage.image_url) {
              const base64Image = await fetchImageAsBase64(productImage.image_url);
              contentParts.push({
                inlineData: {
                  mimeType: "image/jpeg",
                  data: base64Image
                }
              });
            }
          }
        }
      }
    }

    // Add custom background (skip in remix mode)
    if (!remixImageUrl && thumbnailData.backgroundType === "custom" && thumbnailData.backgroundValue) {
      const base64Image = await fetchImageAsBase64(thumbnailData.backgroundValue);
      contentParts.push({
        inlineData: {
          mimeType: "image/jpeg",
          data: base64Image
        }
      });
    }

    console.log("Generated prompt:", prompt);
    console.log("Number of content parts:", contentParts.length);

    // Retry logic for Gemini API calls
    const maxRetries = 3;
    const baseDelay = 2000; // 2 seconds
    let lastError: Error | null = null;
    let response: Response | null = null;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        console.log(`Attempt ${attempt + 1} of ${maxRetries} to call Gemini API`);

        // Call Google Gemini image generation model directly
        // Using gemini-3-pro-image-preview as requested
        response = await fetch(
          "https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-image-preview:generateContent",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-goog-api-key": geminiApiKey,
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
                  aspectRatio: aspectRatio,
                  imageSize: "2K",
                },
              },
            }),
          }
        );

        if (response.ok) {
          console.log("Gemini API call successful");
          break; // Success, exit retry loop
        }

        const errorText = await response.text();
        console.error(`Gemini API error on attempt ${attempt + 1}:`, response.status, errorText);

        // Handle specific error codes
        if (response.status === 429) {
          return new Response(
            JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }),
            { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        if (response.status === 403) {
          return new Response(
            JSON.stringify({ error: "API key invalid or quota exceeded. Please check your Gemini API configuration." }),
            { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
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

        lastError = new Error(`Gemini API error: ${response.status} ${errorText}`);

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
    console.log("Gemini API response received");

    // Extract the base64 image from the Gemini response
    let imageData: string | null = null;

    // Gemini API response format: candidates[0].content.parts[].inlineData.data
    if (data.candidates?.[0]?.content?.parts) {
      for (const part of data.candidates[0].content.parts) {
        if (part.inlineData?.data) {
          imageData = part.inlineData.data;
          break;
        }
      }
    }

    if (!imageData) {
      console.error("No image in response. Response structure:", JSON.stringify(data, null, 2));
      throw new Error("No image returned from AI");
    }

    console.log("Image data received, preparing to upload to storage");

    const fileName = `${userId}/${Date.now()}.png`;

    // Convert base64 to binary (imageData is already without the data URI prefix)
    const binaryData = Uint8Array.from(atob(imageData), (c) => c.charCodeAt(0));

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

    if (generationId) {
      await supabase
        .from("generations")
        .update({
          status: "completed",
          image_url: publicUrl,
          completed_at: new Date().toISOString(),
          duration_ms: Date.now() - startedAt,
        })
        .eq("id", generationId);
    }

    return new Response(
      JSON.stringify({ imageUrl: publicUrl, generationId }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    if (generationId && supabase) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
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
