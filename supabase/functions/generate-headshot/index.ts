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
  const runId = "pre-fix";

  try {
    // #region agent log (H1/H2)
    fetch('http://127.0.0.1:7244/ingest/2872faa0-d840-4698-a191-04da621796b9',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'supabase/functions/generate-headshot/index.ts:serve:entry',message:'generate-headshot entry',data:{method:req.method,hasAuth:!!req.headers.get("Authorization"),contentType:req.headers.get("content-type"),hasSupabaseUrl:!!Deno.env.get("SUPABASE_URL"),hasServiceRoleKey:!!Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),hasGeminiKey:!!Deno.env.get("GEMINI_API_KEY")},timestamp:Date.now(),sessionId:'debug-session',runId,hypothesisId:'H1'})}).catch(()=>{});
    // #endregion agent log (H1/H2)
    // #region agent log (LH1)
    try { console.log(JSON.stringify({location:'supabase/functions/generate-headshot/index.ts:serve:entry',message:'generate-headshot entry (console)',data:{method:req.method,hasAuth:!!req.headers.get("Authorization"),contentType:req.headers.get("content-type")},timestamp:Date.now(),sessionId:'debug-session',runId,hypothesisId:'LH1'})); } catch (_) {}
    // #endregion agent log (LH1)

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const geminiApiKey = Deno.env.get("GEMINI_API_KEY")!;

    supabase = createClient(supabaseUrl, supabaseKey);

    const body = await req.json().catch((e) => {
      // #region agent log (H1)
      fetch('http://127.0.0.1:7244/ingest/2872faa0-d840-4698-a191-04da621796b9',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'supabase/functions/generate-headshot/index.ts:req.json',message:'req.json failed',data:{errorMessage:e instanceof Error ? e.message : String(e)},timestamp:Date.now(),sessionId:'debug-session',runId,hypothesisId:'H1'})}).catch(()=>{});
      // #endregion agent log (H1)
      // #region agent log (LH1)
      try { console.log(JSON.stringify({location:'supabase/functions/generate-headshot/index.ts:req.json',message:'req.json failed (console)',data:{errorMessage:e instanceof Error ? e.message : String(e)},timestamp:Date.now(),sessionId:'debug-session',runId,hypothesisId:'LH1'})); } catch (_) {}
      // #endregion agent log (LH1)
      throw e;
    });

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
    // #region agent log (H2)
    fetch('http://127.0.0.1:7244/ingest/2872faa0-d840-4698-a191-04da621796b9',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'supabase/functions/generate-headshot/index.ts:auth.getUser',message:'auth.getUser ok',data:{hasUser:!!user,userIdLen:userId?.length ?? 0},timestamp:Date.now(),sessionId:'debug-session',runId,hypothesisId:'H2'})}).catch(()=>{});
    // #endregion agent log (H2)
    // #region agent log (LH2)
    try { console.log(JSON.stringify({location:'supabase/functions/generate-headshot/index.ts:auth.getUser',message:'auth.getUser ok (console)',data:{userIdLen:userId?.length ?? 0},timestamp:Date.now(),sessionId:'debug-session',runId,hypothesisId:'LH2'})); } catch (_) {}
    // #endregion agent log (LH2)

    // 2. Check subscription tier and quota
    // We invoke the existing check-subscription function to get consistent plan info
    const { data: subscription, error: subError } = await supabase.functions.invoke("check-subscription", {
      headers: { Authorization: authHeader }
    });

    if (subError || !subscription) {
      // #region agent log (H3)
      fetch('http://127.0.0.1:7244/ingest/2872faa0-d840-4698-a191-04da621796b9',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'supabase/functions/generate-headshot/index.ts:check-subscription',message:'check-subscription failed',data:{hasSubscription:!!subscription,subErrorMsg:subError?.message ?? null},timestamp:Date.now(),sessionId:'debug-session',runId,hypothesisId:'H3'})}).catch(()=>{});
      // #endregion agent log (H3)
      // #region agent log (LH3)
      try { console.log(JSON.stringify({location:'supabase/functions/generate-headshot/index.ts:check-subscription',message:'check-subscription failed (console)',data:{hasSubscription:!!subscription,subErrorMsg:subError?.message ?? null},timestamp:Date.now(),sessionId:'debug-session',runId,hypothesisId:'LH3'})); } catch (_) {}
      // #endregion agent log (LH3)
      throw new Error("Could not verify subscription status");
    }

    const planTier = subscription.plan_tier || "free";
    const isSuperAdmin = !!subscription.is_super_admin;
    // #region agent log (H3)
    fetch('http://127.0.0.1:7244/ingest/2872faa0-d840-4698-a191-04da621796b9',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'supabase/functions/generate-headshot/index.ts:subscription',message:'subscription loaded',data:{planTier,isSuperAdmin,billingStart:subscription.billing_period_start ?? null},timestamp:Date.now(),sessionId:'debug-session',runId,hypothesisId:'H3'})}).catch(()=>{});
    // #endregion agent log (H3)
    // #region agent log (LH3)
    try { console.log(JSON.stringify({location:'supabase/functions/generate-headshot/index.ts:subscription',message:'subscription loaded (console)',data:{planTier,isSuperAdmin},timestamp:Date.now(),sessionId:'debug-session',runId,hypothesisId:'LH3'})); } catch (_) {}
    // #endregion agent log (LH3)
    
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
      // #region agent log (H4)
      fetch('http://127.0.0.1:7244/ingest/2872faa0-d840-4698-a191-04da621796b9',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'supabase/functions/generate-headshot/index.ts:fetchImageAsBase64:beforeFetch',message:'fetching source image',data:{urlHost:(() => { try { return new URL(url).host } catch { return "invalid_url" } })()},timestamp:Date.now(),sessionId:'debug-session',runId,hypothesisId:'H4'})}).catch(()=>{});
      // #endregion agent log (H4)
      // #region agent log (LH4)
      try { console.log(JSON.stringify({location:'supabase/functions/generate-headshot/index.ts:fetchImageAsBase64:beforeFetch',message:'fetching source image (console)',data:{urlHost:(() => { try { return new URL(url).host } catch { return "invalid_url" } })()},timestamp:Date.now(),sessionId:'debug-session',runId,hypothesisId:'LH4'})); } catch (_) {}
      // #endregion agent log (LH4)

      const response = await fetch(url);
      // #region agent log (H4)
      fetch('http://127.0.0.1:7244/ingest/2872faa0-d840-4698-a191-04da621796b9',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'supabase/functions/generate-headshot/index.ts:fetchImageAsBase64:afterFetch',message:'fetched source image',data:{ok:response.ok,status:response.status,contentType:response.headers.get("content-type")},timestamp:Date.now(),sessionId:'debug-session',runId,hypothesisId:'H4'})}).catch(()=>{});
      // #endregion agent log (H4)
      // #region agent log (LH4)
      try { console.log(JSON.stringify({location:'supabase/functions/generate-headshot/index.ts:fetchImageAsBase64:afterFetch',message:'fetched source image (console)',data:{ok:response.ok,status:response.status,contentType:response.headers.get("content-type")},timestamp:Date.now(),sessionId:'debug-session',runId,hypothesisId:'LH4'})); } catch (_) {}
      // #endregion agent log (LH4)

      const arrayBuffer = await response.arrayBuffer();
      // #region agent log (H4/H5)
      fetch('http://127.0.0.1:7244/ingest/2872faa0-d840-4698-a191-04da621796b9',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'supabase/functions/generate-headshot/index.ts:fetchImageAsBase64:arrayBuffer',message:'source image bytes read',data:{byteLength:arrayBuffer.byteLength},timestamp:Date.now(),sessionId:'debug-session',runId,hypothesisId:'H5'})}).catch(()=>{});
      // #endregion agent log (H4/H5)
      // #region agent log (LH5)
      try { console.log(JSON.stringify({location:'supabase/functions/generate-headshot/index.ts:fetchImageAsBase64:arrayBuffer',message:'source image bytes read (console)',data:{byteLength:arrayBuffer.byteLength},timestamp:Date.now(),sessionId:'debug-session',runId,hypothesisId:'LH5'})); } catch (_) {}
      // #endregion agent log (LH5)
      const arr = new Uint8Array(arrayBuffer);
      const base64 = btoa(arr.reduce((data, byte) => data + String.fromCharCode(byte), ''));
      return base64;
    };

    const base64Image = await fetchImageAsBase64(imageUrl);
    // #region agent log (H5)
    fetch('http://127.0.0.1:7244/ingest/2872faa0-d840-4698-a191-04da621796b9',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'supabase/functions/generate-headshot/index.ts:base64Image',message:'base64 encoded',data:{base64Len:base64Image?.length ?? 0},timestamp:Date.now(),sessionId:'debug-session',runId,hypothesisId:'H5'})}).catch(()=>{});
    // #endregion agent log (H5)
    // #region agent log (LH5)
    try { console.log(JSON.stringify({location:'supabase/functions/generate-headshot/index.ts:base64Image',message:'base64 encoded (console)',data:{base64Len:base64Image?.length ?? 0},timestamp:Date.now(),sessionId:'debug-session',runId,hypothesisId:'LH5'})); } catch (_) {}
    // #endregion agent log (LH5)

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
            responseModalities: ["TEXT", "IMAGE"],
            imageConfig: {
              aspectRatio: "1:1",
              imageSize: "2K",
            },
          },
        }),
      }
    );

    // #region agent log (H6)
    fetch('http://127.0.0.1:7244/ingest/2872faa0-d840-4698-a191-04da621796b9',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'supabase/functions/generate-headshot/index.ts:gemini:response',message:'gemini responded',data:{ok:geminiResponse.ok,status:geminiResponse.status},timestamp:Date.now(),sessionId:'debug-session',runId,hypothesisId:'H6'})}).catch(()=>{});
    // #endregion agent log (H6)
    // #region agent log (LH6)
    try { console.log(JSON.stringify({location:'supabase/functions/generate-headshot/index.ts:gemini:response',message:'gemini responded (console)',data:{ok:geminiResponse.ok,status:geminiResponse.status},timestamp:Date.now(),sessionId:'debug-session',runId,hypothesisId:'LH6'})); } catch (_) {}
    // #endregion agent log (LH6)

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
    // #region agent log (H7)
    fetch('http://127.0.0.1:7244/ingest/2872faa0-d840-4698-a191-04da621796b9',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'supabase/functions/generate-headshot/index.ts:storage:beforeUpload',message:'uploading to storage',data:{bucket:"avatars",fileNameSuffix:fileName.split("/").slice(-1)[0],bytes:binaryData.byteLength},timestamp:Date.now(),sessionId:'debug-session',runId,hypothesisId:'H7'})}).catch(()=>{});
    // #endregion agent log (H7)
    // #region agent log (LH7)
    try { console.log(JSON.stringify({location:'supabase/functions/generate-headshot/index.ts:storage:beforeUpload',message:'uploading to storage (console)',data:{bucket:"avatars",bytes:binaryData.byteLength},timestamp:Date.now(),sessionId:'debug-session',runId,hypothesisId:'LH7'})); } catch (_) {}
    // #endregion agent log (LH7)

    const { error: uploadError } = await supabase.storage
      .from("avatars") // Store in avatars bucket
      .upload(fileName, binaryData, {
        contentType: "image/jpeg",
      });

    if (uploadError) {
      // #region agent log (H7)
      fetch('http://127.0.0.1:7244/ingest/2872faa0-d840-4698-a191-04da621796b9',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'supabase/functions/generate-headshot/index.ts:storage:uploadError',message:'storage upload failed',data:{errorMessage:uploadError.message},timestamp:Date.now(),sessionId:'debug-session',runId,hypothesisId:'H7'})}).catch(()=>{});
      // #endregion agent log (H7)
      // #region agent log (LH7)
      try { console.log(JSON.stringify({location:'supabase/functions/generate-headshot/index.ts:storage:uploadError',message:'storage upload failed (console)',data:{errorMessage:uploadError.message},timestamp:Date.now(),sessionId:'debug-session',runId,hypothesisId:'LH7'})); } catch (_) {}
      // #endregion agent log (LH7)
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
    // #region agent log (H0)
    fetch('http://127.0.0.1:7244/ingest/2872faa0-d840-4698-a191-04da621796b9',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'supabase/functions/generate-headshot/index.ts:catch',message:'generate-headshot caught error',data:{errorMessage:error instanceof Error ? error.message : String(error)},timestamp:Date.now(),sessionId:'debug-session',runId,hypothesisId:'H0'})}).catch(()=>{});
    // #endregion agent log (H0)
    // #region agent log (LH0)
    try { console.log(JSON.stringify({location:'supabase/functions/generate-headshot/index.ts:catch',message:'generate-headshot caught error (console)',data:{errorMessage:error instanceof Error ? error.message : String(error)},timestamp:Date.now(),sessionId:'debug-session',runId,hypothesisId:'LH0'})); } catch (_) {}
    // #endregion agent log (LH0)
    
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

