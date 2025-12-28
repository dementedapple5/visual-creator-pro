import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const extractStoragePathFromSupabaseUrl = (urlOrPath: string, bucket: string): string | null => {
  // If we already got a raw storage path like "user-id/file.jpg"
  if (!urlOrPath.includes("http://") && !urlOrPath.includes("https://") && urlOrPath.includes("/")) {
    return urlOrPath;
  }

  try {
    const u = new URL(urlOrPath);
    const p = u.pathname;

    // Public URL format:
    // /storage/v1/object/public/<bucket>/<path>
    const publicMarker = `/storage/v1/object/public/${bucket}/`;
    const idxPublic = p.indexOf(publicMarker);
    if (idxPublic >= 0) {
      return p.slice(idxPublic + publicMarker.length);
    }

    // Signed URL format:
    // /storage/v1/object/sign/<bucket>/<path>
    const signedMarker = `/storage/v1/object/sign/${bucket}/`;
    const idxSigned = p.indexOf(signedMarker);
    if (idxSigned >= 0) {
      return p.slice(idxSigned + signedMarker.length);
    }

    // Fallback for older helper (split on /<bucket>/)
    const parts = urlOrPath.split(`/${bucket}/`);
    if (parts[1]) return parts[1];

    return null;
  } catch {
    return null;
  }
};

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

    const body = await req.json();

    const { imageUrl, avatarId } = body as { imageUrl: string; avatarId?: string };
    if (!imageUrl) {
      throw new Error("Missing imageUrl parameter");
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("No authorization header");
    }

    // 1. Get user info
    const { data: { user }, error: userError } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", "")
    );

    if (userError || !user) {
      console.error("User auth error:", userError);
      throw new Error("User not authenticated");
    }

    userId = user.id;

    // 2. Check subscription tier and quota
    // We invoke the existing check-subscription function to get consistent plan info
    const { data: subscription, error: subError } = await supabase.functions.invoke("check-subscription", {
      headers: { Authorization: authHeader }
    });

    if (subError || !subscription) {
      throw new Error("Could not verify subscription status");
    }

    const planTier = subscription.plan_tier || "free";
    const isSuperAdmin = !!subscription.is_super_admin;
    
    if (planTier === "free" && !isSuperAdmin) {
      return new Response(
        JSON.stringify({ error: "Professional headshots are only available for paid plans. Please upgrade to use this feature." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Define limits
    const headshotLimits: Record<string, number> = {
      starter: 10,
      pro: 30,
      enterprise: 100
    };
    const limit = isSuperAdmin ? 999999 : (headshotLimits[planTier] || 0);

    // 3. Count current usage in billing period
    const billingStart = subscription.billing_period_start || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
    
    const { count, error: countError } = await supabase
      .from("generations")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("mode", "headshot")
      .eq("status", "completed")
      .gte("created_at", billingStart);

    if (countError) throw countError;

    if ((count || 0) >= limit) {
      return new Response(
        JSON.stringify({ error: `You have reached your monthly limit of ${limit} professional headshots for the ${planTier} plan.` }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 4. Track the generation
    const { data: generationRecord, error: generationError } = await supabase
      .from("generations")
      .insert({
        user_id: userId,
        status: "processing",
        mode: "headshot",
        credits_used: 0, // Headshots don't use regular credits as per plan
        request: { imageUrl, planTier },
      })
      .select("id")
      .single();

    if (generationError) throw generationError;
    generationId = generationRecord.id;

    // 5. Call Gemini API
    const prompt = "Create a professional headshot with studio lighting white background of the person in the image. Dont change clothing and respect all facial details of the subject.";
    
    // Helper function to fetch and convert image to base64
    const fetchImageAsBase64 = async (url: string): Promise<string> => {
      const response = await fetch(url);

      const arrayBuffer = await response.arrayBuffer();
      const arr = new Uint8Array(arrayBuffer);
      const base64 = btoa(arr.reduce((data, byte) => data + String.fromCharCode(byte), ''));
      return base64;
    };

    const base64Image = await fetchImageAsBase64(imageUrl);

    const geminiResponse = await fetch(
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
              parts: [
                { text: prompt },
                {
                  inlineData: {
                    mimeType: "image/jpeg",
                    data: base64Image
                  }
                }
              ],
            },
          ],
          generationConfig: {
            responseModalities: ["IMAGE"],
            imageConfig: {
              aspectRatio: "1:1",
              imageSize: "2K",
            },
          },
        }),
      }
    );

    if (!geminiResponse.ok) {
      const errorText = await geminiResponse.text();
      throw new Error(`Gemini API error: ${geminiResponse.status} ${errorText}`);
    }

    const data = await geminiResponse.json();
    let imageData: string | null = null;

    if (data.candidates?.[0]?.content?.parts) {
      for (const part of data.candidates[0].content.parts) {
        if (part.inlineData?.data) {
          imageData = part.inlineData.data;
          break;
        }
      }
    }

    if (!imageData) {
      throw new Error("No image returned from AI");
    }

    // 6. Save to storage
    const fileName = `${userId}/headshot_${Date.now()}.jpg`;
    const binaryData = Uint8Array.from(atob(imageData), (c) => c.charCodeAt(0));

    const { error: uploadError } = await supabase.storage
      .from("avatars") // Store in avatars bucket
      .upload(fileName, binaryData, {
        contentType: "image/jpeg",
      });

    if (uploadError) {
      throw uploadError;
    }

    const { data: { publicUrl } } = supabase.storage
      .from("avatars")
      .getPublicUrl(fileName);

    // 6.5 Optionally update the avatar row + cleanup original image
    let avatarUpdated = false;
    if (avatarId) {
      // Ensure the avatar belongs to the authenticated user (important because we're service-role here)
      const { data: existingAvatar, error: avatarFetchError } = await supabase
        .from("avatars")
        .select("id,user_id,image_url")
        .eq("id", avatarId)
        .single();

      if (!avatarFetchError && existingAvatar && existingAvatar.user_id === userId) {
        const { error: avatarUpdateError } = await supabase
          .from("avatars")
          .update({ image_url: publicUrl })
          .eq("id", avatarId)
          .eq("user_id", userId);

        if (!avatarUpdateError) {
          avatarUpdated = true;

          // Remove original avatar image (best-effort). If parsing fails, we just skip cleanup.
          const oldPath = extractStoragePathFromSupabaseUrl(imageUrl, "avatars");
          if (oldPath) {
            await supabase.storage.from("avatars").remove([oldPath]).catch(() => {});
          }
        }
      }
    }

    // 7. Update generation record
    await supabase
      .from("generations")
      .update({
        status: "completed",
        image_url: publicUrl,
        completed_at: new Date().toISOString(),
        duration_ms: Date.now() - startedAt,
      })
      .eq("id", generationId);

    return new Response(
      JSON.stringify({ imageUrl: publicUrl, generationId, avatarUpdated }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );

  } catch (error) {
    console.error("Error in generate-headshot function:", error);
    
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

    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

