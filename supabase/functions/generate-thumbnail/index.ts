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
  avatarPosition?: string;         // Legacy single value
  avatarPositions?: string[];      // New: multiple positions for grid variations
  productIds?: string[]; // Legacy support
  productPosition?: string; // Legacy support
  productPositions?: string[];     // New: multiple positions for grid variations
  elements?: {
    id?: string;
    url?: string;
    position: string;
    name?: string;
    brand?: string;
  }[];
  userElements?: string; // Comma-separated list of text elements
  title?: string;
  subtitle?: string;
  textPosition?: string;           // Legacy single value
  textPositions?: string[];        // New: multiple positions for grid variations
  expression?: string;             // Legacy single value
  expressions?: string[];          // New: multiple expressions for grid variations
  visualStyle?: string;            // Legacy single value
  visualStyles?: string[];         // New: multiple styles for grid variations
  textStyle?: string;              // Legacy single value
  textStyles?: string[];           // New: multiple styles for grid variations
  fontStyleImageUrl?: string; // Image reference for font/text styling
  backgroundType?: string;
  backgroundValue?: string;
  aspectRatio?: string;
  iterationPrompt?: string;
  // AI decide modes
  titleMode?: 'custom' | 'ai';
  subtitleMode?: 'custom' | 'ai';
  // Grid generation mode
  gridMode?: boolean;
  gridCount?: number; // 1, 4, or 9
  resolution?: string; // "1K", "2K", or "4K"
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

    const { thumbnailData, remixImageUrl, remixPrompt, thumbnailId, iterationImageUrl, iterationPrompt, creditsUsed, contextImageUrls, contextImageLabels } = await req.json() as {
      thumbnailData: ThumbnailData;
      remixImageUrl?: string;
      remixPrompt?: string;
      thumbnailId?: string; // For iterations, pass the thumbnail ID to link the generation
      iterationImageUrl?: string; // The current version's image URL to iterate on
      iterationPrompt?: string; // What changes to apply to the iteration
      creditsUsed?: number;
      contextImageUrls?: string[];
      contextImageLabels?: string[];
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
      : iterationImageUrl
        ? "iterate"
        : "create";

    const { data: generationRecord, error: generationError } = await supabase
      .from("generations")
      .insert({
        user_id: userId,
        status: "processing",
        mode: generationMode,
        credits_used: creditsUsed || 1,
        request: { thumbnailData, remixPrompt, remixImageUrl, iterationImageUrl, iterationPrompt, contextImageUrls, contextImageLabels },
        prompt: iterationPrompt || null,
        remix_prompt: remixPrompt || null,
        aspect_ratio: thumbnailData?.aspectRatio || null,
        title: thumbnailData?.title || null,
        subtitle: thumbnailData?.subtitle || null,
        thumbnail_id: thumbnailId || null, // Link to existing thumbnail for iterations
      })
      .select("id")
      .single();

    if (generationError) {
      throw generationError;
    }

    generationId = generationRecord?.id || null;

    console.log("Thumbnail data received:", thumbnailData);
    console.log("Remix mode:", !!remixImageUrl);
    console.log("Iteration mode:", !!iterationImageUrl);

    // Build the prompt
    const platformType = thumbnailData?.aspectRatio === "9:16" ? "TikTok/Instagram story" : "YouTube";
    const aspectRatio = thumbnailData?.aspectRatio || "16:9";

    // For iterations and remixes, always use single thumbnail mode with 1K resolution
    const isIterationOrRemix = !!iterationImageUrl || !!remixImageUrl;
    const gridCount = isIterationOrRemix ? 1 : (thumbnailData?.gridCount || (thumbnailData?.gridMode !== false ? 9 : 1));
    const isGridMode = gridCount > 1;
    const resolution = isIterationOrRemix ? "1K" : (thumbnailData?.resolution || (isGridMode ? "4K" : "1K"));

    console.log("Grid mode:", isGridMode, "Grid count:", gridCount, "Resolution:", resolution);

    let prompt = "";

    // Check if this is an iteration request (modifying an existing version)
    if (iterationImageUrl && iterationPrompt) {
      prompt = `You are iterating on an existing thumbnail. Apply the following changes to the image: ${iterationPrompt}

CRITICAL INSTRUCTIONS:
- Use the provided image as the BASE and apply ONLY the requested modifications
- Maintain the overall composition, style, colors, and layout of the original thumbnail
- PRESERVE all elements that are not explicitly mentioned to be changed
- Keep the same aspect ratio (${aspectRatio})
- Do NOT change anything that wasn't specifically requested
- If additional context images are provided, use them ONLY as reference to preserve fidelity of mentioned assets (e.g., avatar/product) without changing the base composition`;
    }
    // Check if this is a remix request
    else if (remixImageUrl && remixPrompt) {
      prompt = `You are remixing an existing thumbnail. Apply the following changes to the image: ${remixPrompt}

CRITICAL: Maintain the overall composition and style of the original thumbnail while applying the requested changes.`;
    }
    // Grid mode - generate grid of variations (2x2 for 4 thumbnails, 3x3 for 9 thumbnails)
    else if (isGridMode) {
      const gridSize = gridCount === 4 ? 2 : 3;
      const gridDescription = gridCount === 4 ? "2x2 grid (2 columns, 2 rows)" : "3x3 grid (3 columns, 3 rows)";
      // Keep this compact: long prompts are a common cause of image failures/timeouts.
      const viralVisualGuidelines =
        `Viral YouTube look (visual): high contrast, warm key + cool rim light, dark/blur background, ` +
        `bokeh/flares, clean cutout, strong rim/subject glow, subtle 3D depth, no clutter, mobile-sharp 16:9.`;
      const viralTextGuidelines =
        `Viral YouTube text: bold condensed ALL-CAPS (Anton/Bebas/Impact vibe), 1–4 word headline, ` +
        `high contrast, subtle 3D + shadow + glow, readable on mobile.`;

      prompt = `Generate a ${gridDescription.toUpperCase()} GRID IMAGE containing ${gridCount} DISTINCT ${platformType} thumbnail variations.

CRITICAL LAYOUT INSTRUCTIONS:
- Create a single image divided into a ${gridDescription}
- Each cell contains ONE complete thumbnail
- ALL ${gridCount} cells must be filled with unique thumbnail variations
- Cells should not have borders or gaps between them
- Each thumbnail must be a complete, standalone design

VARIATION INSTRUCTIONS FOR THE ${gridCount} THUMBNAILS:`;

      // Add variation instructions based on selected options
      const expressions = thumbnailData.expressions || (thumbnailData.expression ? [thumbnailData.expression] : []);
      const visualStyles = thumbnailData.visualStyles || (thumbnailData.visualStyle ? [thumbnailData.visualStyle] : []);
      const textStyles = thumbnailData.textStyles || (thumbnailData.textStyle ? [thumbnailData.textStyle] : []);
      const avatarPositions = thumbnailData.avatarPositions || (thumbnailData.avatarPosition ? [thumbnailData.avatarPosition] : []);
      const textPositions = thumbnailData.textPositions || (thumbnailData.textPosition ? [thumbnailData.textPosition] : []);
      const productPositions = thumbnailData.productPositions || (thumbnailData.productPosition ? [thumbnailData.productPosition] : []);

      // Expressions
      if (expressions.includes("ai-decide")) {
        prompt += `\n- Vary FACIAL EXPRESSIONS across thumbnails (excited, surprised, happy, serious, confident, thinking)`;
      } else if (expressions.length > 0) {
        prompt += `\n- Use these FACIAL EXPRESSIONS across thumbnails: ${expressions.join(", ")}`;
      }

      // Visual styles
      const nonAiGridVisualStyles = visualStyles.filter((v) => v !== "ai-decide");
      if (nonAiGridVisualStyles.length > 0) {
        prompt += `\n- Use these VISUAL STYLES across thumbnails: ${nonAiGridVisualStyles.join(", ")}`;
      } else if (visualStyles.includes("ai-decide")) {
        prompt += `\n- VISUAL STYLE (AI DECIDE): Apply this viral visual spec to all thumbnails: ${viralVisualGuidelines}`;
      }

      // Text styles
      if (textStyles.includes("ai-decide")) {
        // If user wants AI to decide text style, constrain it to a proven viral spec.
        prompt += `\n- TEXT STYLE (AI DECIDE): Apply this viral typography spec across thumbnails: ${viralTextGuidelines}`;
      } else if (textStyles.length > 0 && !textStyles.includes("Image Reference")) {
        prompt += `\n- Use these TEXT STYLES across thumbnails: ${textStyles.join(", ")}`;
      }

      // Avatar positions
      if (avatarPositions.includes("ai-decide")) {
        prompt += `\n- Vary AVATAR/PERSON POSITIONS across thumbnails (top-left, top-center, top-right, center-left, center, center-right, bottom-left, bottom-center, bottom-right)`;
      } else if (avatarPositions.length > 0) {
        prompt += `\n- Position the AVATAR/PERSON in these locations across thumbnails: ${avatarPositions.join(", ")}`;
      }

      // Text positions
      if (textPositions.includes("ai-decide")) {
        prompt += `\n- Vary TEXT POSITIONS across thumbnails (top-left, top-center, top-right, center-left, center, center-right, bottom-left, bottom-center, bottom-right)`;
      } else if (textPositions.length > 0) {
        prompt += `\n- Position the TEXT in these locations across thumbnails: ${textPositions.join(", ")}`;
      }

      // Element/product positions
      if (productPositions.includes("ai-decide")) {
        prompt += `\n- Vary ELEMENT/PRODUCT POSITIONS across thumbnails (top-left, top-center, top-right, center-left, center, center-right, bottom-left, bottom-center, bottom-right)`;
      } else if (productPositions.length > 0) {
        prompt += `\n- Position the ELEMENTS/PRODUCTS in these locations across thumbnails: ${productPositions.join(", ")}`;
      }

      // Handle AI-generated titles
      if (thumbnailData.titleMode === 'ai') {
        prompt += `\n- Generate UNIQUE, COMPELLING TITLES for each thumbnail - make them click-worthy and varied`;
      }

      // Handle AI-generated subtitles
      if (thumbnailData.subtitleMode === 'ai') {
        prompt += `\n- Generate UNIQUE SUBTITLES for each thumbnail that complement the titles`;
      }

      prompt += `

PRESERVE INSTRUCTIONS:
- PRESERVE the exact appearance, face, outfit, and styling of any people shown in the provided images
- Do NOT modify facial features, clothing, or accessories of the people
- Keep them looking EXACTLY as they appear in the source images
- Ensure each of the ${gridCount} thumbnails is high-quality and could work as a standalone thumbnail`;
    }
    // Single thumbnail mode (legacy)
    else {
      prompt = `Generate a high-impact ${platformType} thumbnail with ${aspectRatio} aspect ratio. 

CRITICAL INSTRUCTIONS:
- PRESERVE the exact appearance, face, outfit, and styling of any people shown in the provided images
- Do NOT modify facial features, clothing, or accessories of the people
- Keep them looking EXACTLY as they appear in the source images`;
    }

    // Only add detailed styling instructions for new creations (not for iterations or remixes)
    if (!iterationImageUrl && !remixImageUrl && thumbnailData) {
      // For grid mode, most styling is handled in the variation instructions above
      // Only add non-variant specific instructions here

      // Define textStyles in the outer scope so it's available for both grid and single mode sections
      const textStyles = thumbnailData.textStyles || (thumbnailData.textStyle ? [thumbnailData.textStyle] : []);

      // Reuse the same compact viral style spec used by QuickCreate (kept short on purpose)
      const viralVisualGuidelines =
        `Viral YouTube look (visual): high contrast, warm key + cool rim light, dark/blur background, ` +
        `bokeh/flares, clean cutout, strong rim/subject glow, subtle 3D depth, no clutter, mobile-sharp 16:9.`;
      const viralTextGuidelines =
        `Viral YouTube text: bold condensed ALL-CAPS (Anton/Bebas/Impact vibe), 1–4 word headline, ` +
        `high contrast, subtle 3D + shadow + glow, readable on mobile.`;

      // In single-thumbnail mode, the frontend often sends plural arrays (e.g. textPositions)
      // even when only one option is selected. Normalize to a single value so the prompt
      // always includes the requested expression/positions.
      const pickFirstNonAi = (arr?: string[]) =>
        arr?.find((v) => typeof v === "string" && v.trim() && v !== "ai-decide");
      const singleExpression = thumbnailData.expression || pickFirstNonAi(thumbnailData.expressions);
      const singleAvatarPosition = thumbnailData.avatarPosition || pickFirstNonAi(thumbnailData.avatarPositions);
      const singleTextPosition = thumbnailData.textPosition || pickFirstNonAi(thumbnailData.textPositions);
      const nonAiVisualStyles = (thumbnailData.visualStyles || []).filter((v) => typeof v === "string" && v.trim() && v !== "ai-decide");
      const wantsAiVisualStyle =
        // Only treat as AI-decide if there is NO explicit style selected.
        !thumbnailData.visualStyle &&
        nonAiVisualStyles.length === 0 &&
        (thumbnailData.visualStyle === "ai-decide" ||
          (Array.isArray(thumbnailData.visualStyles) && thumbnailData.visualStyles.includes("ai-decide")));
      const singleVisualStyle =
        // Prefer explicit single field first (unless it's ai-decide)
        (thumbnailData.visualStyle && thumbnailData.visualStyle !== "ai-decide" ? thumbnailData.visualStyle : undefined) ||
        pickFirstNonAi(thumbnailData.visualStyles);

      // Background (applies to all thumbnails in grid)
      if (thumbnailData.backgroundType && thumbnailData.backgroundValue) {
        if (thumbnailData.backgroundType === "preset") {
          prompt += `\n\nBACKGROUND: ${thumbnailData.backgroundValue} setting.`;
        } else if (thumbnailData.backgroundType === "color" || thumbnailData.backgroundType === "solid") {
          prompt += `\n\nBACKGROUND: solid ${thumbnailData.backgroundValue} color.`;
        } else if (thumbnailData.backgroundType === "gradient") {
          const colors = thumbnailData.backgroundValue.split(",");
          if (colors.length >= 2) {
            prompt += `\n\nBACKGROUND: a gradient from ${colors[0]} to ${colors[1]}.`;
          } else {
            prompt += `\n\nBACKGROUND: ${thumbnailData.backgroundValue} gradient.`;
          }
        } else if (thumbnailData.backgroundType === "prompt" || thumbnailData.backgroundType === "custom-prompt") {
          prompt += `\n\nBACKGROUND: ${thumbnailData.backgroundValue}.`;
        } else if (thumbnailData.backgroundType === "avatar" || thumbnailData.backgroundType === "avatar-bg") {
          prompt += `\n\nBACKGROUND: CRITICAL - Keep and preserve the EXACT original background from the avatar image. Do NOT change, modify, or replace the background in any way. The background must remain identical to the source avatar image.`;
        } else if (thumbnailData.backgroundType === "custom" || thumbnailData.backgroundType === "image") {
          prompt += `\n\nBACKGROUND: Use the provided background image. Do not modify the image in any way, keep it as is. Keep everything intact even if there are people in the background image.`;
        }
      }

      // Visual style (only for single mode, grid mode handles this in variations)
      if (!isGridMode) {
        if (wantsAiVisualStyle) {
          // IMPORTANT: this is visual-only so we don't override user-selected typography.
          prompt += `\n\nVISUAL STYLE (AI DECIDE): Apply this viral visual spec: ${viralVisualGuidelines}`;
        } else if (singleVisualStyle) {
          const styles: Record<string, string> = {
            epic: "Epic and bold with dramatic lighting and strong contrast",
            dramatic: "Cinematic and dramatic with high contrast",
            vibrant: "Vibrant, colorful, and energetic",
            professional: "Clean, professional, and polished",
            creative: "Artistic, creative, and unique",
            minimalist: "Simple, minimalist, and elegant",
          };
          prompt += `\n\nVISUAL STYLE: ${styles[singleVisualStyle] || singleVisualStyle}.`;
        }
      }

      // Avatar section (expression + position) - grouped together for clarity
      if (!isGridMode && (thumbnailData.avatarId || thumbnailData.customAvatarUrl)) {
        const hasExpression = singleExpression && singleExpression !== "ai-decide";
        const hasPosition = singleAvatarPosition && singleAvatarPosition !== "ai-decide";
        
        if (hasExpression || hasPosition) {
          prompt += `\n\nAVATAR/PERSON REQUIREMENTS:`;
          if (hasExpression) {
            prompt += `\n- Facial expression: ${singleExpression} (CRITICAL - the person must show this exact expression)`;
          }
          if (hasPosition) {
            const position = singleAvatarPosition!.replace(/-/g, ' ');
            prompt += `\n- Position: ${position} (CRITICAL - the avatar must be positioned exactly at ${position}, this is non-negotiable)`;
          }
        }
      }

      // Text section (content + styling + position) - grouped together
      if (!isGridMode) {
        const hasTitle = thumbnailData.title && thumbnailData.titleMode !== 'ai';
        const hasSubtitle = thumbnailData.subtitle && thumbnailData.subtitleMode !== 'ai';
        const hasTextPosition = singleTextPosition && singleTextPosition !== "ai-decide";
        
        if (hasTitle || hasSubtitle || hasTextPosition) {
          prompt += `\n\nTEXT REQUIREMENTS:`;
          
          if (hasTitle) {
            // Check if using image-based font style reference
            if (thumbnailData.fontStyleImageUrl) {
              prompt += `\n- Main title: "${thumbnailData.title}" styled EXACTLY like the font/text style shown in the provided font reference image. Match the font style, weight, effects, colors, and overall aesthetic from the reference image.`;
            } else if (!textStyles.includes("ai-decide") && textStyles.length > 0) {
              const textStyleDescriptions: Record<string, string> = {
                "Bold & Large": "large, bold, and impactful",
                "Elegant Script": "elegant script style",
                "Modern Sans": "modern, clean sans-serif",
                "Handwritten": "handwritten style",
                "Futuristic": "futuristic style with modern effects",
                "Classic Serif": "classic serif typography"
              };
              const primaryStyle = textStyles[0];
              const textStyleDesc = textStyleDescriptions[primaryStyle] || primaryStyle;
              prompt += `\n- Main title: "${thumbnailData.title}" in ${textStyleDesc} typography.`;
            } else {
              prompt += `\n- Main title: "${thumbnailData.title}".`;
              // If user chose "let AI decide" for text style, add the viral typography spec here (text-only).
              if (textStyles.includes("ai-decide")) {
                prompt += `\n- Typography (AI decide): ${viralTextGuidelines}`;
              }
            }
          }
          
          if (hasSubtitle) {
            prompt += `\n- Subtitle: "${thumbnailData.subtitle}" in smaller complementary text styled to match the main title.`;
          }
          
          if (hasTextPosition) {
            const position = singleTextPosition!.replace(/-/g, ' ');
            prompt += `\n- Text position: ${position} (CRITICAL - the text must be positioned exactly at ${position}, this is non-negotiable)`;
          }
        }
      } else {
        // Grid mode: just include text content if specified
        if (thumbnailData.title && thumbnailData.titleMode !== 'ai') {
          if (thumbnailData.fontStyleImageUrl) {
            prompt += `\n\nTEXT: Include "${thumbnailData.title}" styled EXACTLY like the font/text style shown in the provided font reference image. Match the font style, weight, effects, colors, and overall aesthetic from the reference image.`;
          } else {
            prompt += `\n\nTEXT: Include "${thumbnailData.title}"${thumbnailData.subtitle && thumbnailData.subtitleMode !== 'ai' ? ` with subtitle "${thumbnailData.subtitle}"` : ''}.`;
          }
        }
      }

      // Elements section (list + positions) - consolidated to avoid repetition
      let elementsToInclude: Array<{ name: string; brand?: string; position?: string }> = [];
      
      // Collect elements from the elements array (primary source - has complete info including positions)
      if (thumbnailData.elements && thumbnailData.elements.length > 0) {
        thumbnailData.elements.forEach((element) => {
          // Include elements that have a name (text elements and products)
          if (element.name) {
            elementsToInclude.push({
              name: element.name,
              brand: element.brand,
              position: element.position
            });
          }
        });
      }
      
      // Legacy/fallback: add user-defined text elements only if not already in elements array
      // (userElements is typically redundant since textElements are already in elements array)
      if (thumbnailData.userElements && elementsToInclude.length === 0) {
        const userElementList = thumbnailData.userElements.split(',').map(el => el.trim()).filter(Boolean);
        userElementList.forEach((elementName) => {
          elementsToInclude.push({ name: elementName });
        });
      }
      
      // Legacy support: fetch product details if productIds provided (only if no elements found yet)
      if (elementsToInclude.length === 0 && thumbnailData.productIds && thumbnailData.productIds.length > 0) {
        const { data: productDetails } = await supabase
          .from("products")
          .select("id, title, brand")
          .in("id", thumbnailData.productIds);

        if (productDetails && productDetails.length > 0) {
          productDetails.forEach((product) => {
            if (product.title) {
              elementsToInclude.push({
                name: product.title,
                brand: product.brand || undefined,
                position: thumbnailData.productPosition || undefined
              });
            }
          });
        }
      }
      
      // Build elements section if we have any elements
      if (elementsToInclude.length > 0) {
        prompt += `\n\nELEMENTS/PRODUCTS TO INCLUDE:`;
        elementsToInclude.forEach((element) => {
          let elementLabel: string;
          if (element.brand) {
            elementLabel = `${element.name} (by ${element.brand})`;
          } else {
            elementLabel = element.name;
          }
          
          if (!isGridMode && element.position && element.position !== "ai-decide") {
            const position = element.position.replace(/-/g, ' ');
            prompt += `\n- ${elementLabel} - Position at ${position} (CRITICAL - must be positioned exactly at ${position}, this is non-negotiable)`;
          } else {
            prompt += `\n- ${elementLabel}`;
          }
        });
        prompt += `\nMake sure all elements/products are prominently featured and recognizable in the thumbnail.`;
      }
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

    // If this is an iteration, add the source image (the version being iterated on)
    if (iterationImageUrl) {
      console.log("Adding iteration source image:", iterationImageUrl);
      const base64Image = await fetchImageAsBase64(iterationImageUrl);
      contentParts.push({
        inlineData: {
          mimeType: "image/jpeg",
          data: base64Image
        }
      });
    }
    // If this is a remix, add the source image
    else if (remixImageUrl) {
      const base64Image = await fetchImageAsBase64(remixImageUrl);
      contentParts.push({
        inlineData: {
          mimeType: "image/jpeg",
          data: base64Image
        }
      });
    }

    // Add extra context images (works for create + remix + iterate)
    if (contextImageUrls && Array.isArray(contextImageUrls) && contextImageUrls.length > 0) {
      console.log(`Adding ${contextImageUrls.length} context image(s)`);
      for (let i = 0; i < contextImageUrls.length; i++) {
        const url = contextImageUrls[i];
        if (!url) continue;
        const label = contextImageLabels?.[i] || `context-${i + 1}`;
        try {
          contentParts.push({ text: `Additional context image (${label}):` });
          const base64Image = await fetchImageAsBase64(url);
          contentParts.push({
            inlineData: {
              mimeType: "image/jpeg",
              data: base64Image
            }
          });
        } catch (e) {
          console.warn("Failed to add context image:", url, e);
        }
      }
    }

    // Add avatar image (skip in remix/iteration mode - they work from existing complete image)
    if (!remixImageUrl && !iterationImageUrl) {
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

    // Add element images (skip in remix/iteration mode)
    if (!remixImageUrl && !iterationImageUrl) {
      if (thumbnailData.elements && thumbnailData.elements.length > 0) {
        console.log(`Processing ${thumbnailData.elements.length} elements for the prompt`);
        // Process new elements structure
        for (const [index, element] of thumbnailData.elements.entries()) {
          if (element.url) {
            console.log(`Adding custom element image from URL at index ${index}: ${element.url}`);
            const base64Image = await fetchImageAsBase64(element.url);
            contentParts.push({
              inlineData: {
                mimeType: "image/jpeg",
                data: base64Image
              }
            });
          } else if (element.id) {
            console.log(`Adding library element with ID: ${element.id}`);
            const { data: productImages } = await supabase
              .from("product_images")
              .select("image_url")
              .eq("product_id", element.id)
              .limit(1);

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

    // Add custom background (skip in remix/iteration mode)
    if (!remixImageUrl && !iterationImageUrl && 
        (thumbnailData?.backgroundType === "custom" || thumbnailData?.backgroundType === "image") && 
        thumbnailData?.backgroundValue) {
      console.log(`Adding custom background image: ${thumbnailData.backgroundValue}`);
      const base64Image = await fetchImageAsBase64(thumbnailData.backgroundValue);
      contentParts.push({
        inlineData: {
          mimeType: "image/jpeg",
          data: base64Image
        }
      });
    }

    // Add font style reference image (skip in remix/iteration mode)
    if (!remixImageUrl && !iterationImageUrl && thumbnailData?.fontStyleImageUrl) {
      console.log("Adding font style reference image");
      const base64Image = await fetchImageAsBase64(thumbnailData.fontStyleImageUrl);
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
                responseModalities: ["IMAGE"],
                imageConfig: {
                  aspectRatio: aspectRatio,
                  imageSize: resolution as "1K" | "2K" | "4K", // Use resolution from request
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
          // Update generation status to failed before returning
          if (generationId && supabase) {
            await supabase
              .from("generations")
              .update({
                status: "failed",
                error_message: "Rate limit exceeded",
                completed_at: new Date().toISOString(),
                duration_ms: Date.now() - startedAt,
              })
              .eq("id", generationId);
          }
          return new Response(
            JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }),
            { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        if (response.status === 403) {
          // Update generation status to failed before returning
          if (generationId && supabase) {
            await supabase
              .from("generations")
              .update({
                status: "failed",
                error_message: "API key invalid or quota exceeded",
                completed_at: new Date().toISOString(),
                duration_ms: Date.now() - startedAt,
              })
              .eq("id", generationId);
          }
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

      // Update generation status to failed before returning
      if (generationId && supabase) {
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

    console.log("Image data received, length:", imageData.length);

    // For grid mode (2K or 4K images), skip storage upload to avoid memory issues
    // Return base64 directly - frontend will handle displaying and letting user select thumbnails
    if (isGridMode) {
      console.log(`Grid mode: returning base64 directly to avoid memory issues with ${resolution} images`);

      if (generationId) {
        await supabase
          .from("generations")
          .update({
            status: "completed",
            // No image_url for grid mode - the individual thumbnails will be saved separately
            completed_at: new Date().toISOString(),
            duration_ms: Date.now() - startedAt,
          })
          .eq("id", generationId);
      }

      return new Response(
        JSON.stringify({
          imageBase64: imageData,
          generationId,
          isGridMode: true
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // For single thumbnail mode, upload to storage as before
    console.log("Single mode: uploading to storage");
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
