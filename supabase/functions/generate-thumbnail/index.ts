import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import { corsHeaders } from "../_shared/cors.ts";
import { createLogger } from "../_shared/logger.ts";

const logger = createLogger("generate-thumbnail");

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  // Avoid stack overflow on large images by chunking
  const chunkSize = 0x8000;
  let binary = "";
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

async function fetchImageAsDataUrl(url: string): Promise<string> {
  const response = await fetch(url);
  const arrayBuffer = await response.arrayBuffer();
  const contentType = response.headers.get("content-type") || "image/jpeg";
  const base64 = arrayBufferToBase64(arrayBuffer);
  return `data:${contentType};base64,${base64}`;
}

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
  customPrompt?: string;
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
    const replicateApiKey = Deno.env.get("REPLICATE_API_KEY")!;

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
    logger.info("Generating thumbnail", { mode: remixImageUrl ? "remix" : iterationImageUrl ? "iterate" : "create", thumbnailId });
    if (!authHeader) {
      throw new Error("No authorization header");
    }

    const { data: { user }, error: userError } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", "")
    );

    if (userError || !user) {
      logger.error("User auth error", userError);
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

    // For iterations, remixes and sketches, always use single thumbnail mode (no grid).
    const isIterationOrRemix = !!iterationImageUrl || !!remixImageUrl;
    const isSketch = contextImageLabels?.includes("sketch-reference");
    const gridCount = (isIterationOrRemix || isSketch) ? 1 : (thumbnailData?.gridCount || (thumbnailData?.gridMode !== false ? 9 : 1));
    const isGridMode = gridCount > 1;
    // Iterations/remixes stay at 1K to reduce latency/memory; sketches can request higher resolution.
    const resolution = isIterationOrRemix
      ? "1K"
      : (thumbnailData?.resolution || (isGridMode ? (gridCount === 4 ? "2K" : "4K") : "1K"));

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

      // Add custom prompt if provided
      if (thumbnailData.customPrompt) {
        prompt += `\n\nADDITIONAL INSTRUCTIONS: ${thumbnailData.customPrompt}`;
      }
    }

    // Build image input array for Replicate API
    const imageInput: string[] = [];

    // If this is an iteration, add the source image (the version being iterated on)
    if (iterationImageUrl) {
      logger.info("Adding iteration source image", { url: iterationImageUrl });
      imageInput.push(await fetchImageAsDataUrl(iterationImageUrl));
    }
    // If this is a remix, add the source image
    else if (remixImageUrl) {
      imageInput.push(await fetchImageAsDataUrl(remixImageUrl));
    }

    // Add extra context images (works for create + remix + iterate)
    if (contextImageUrls && Array.isArray(contextImageUrls) && contextImageUrls.length > 0) {
      logger.info(`Adding ${contextImageUrls.length} context image(s)`);
      for (let i = 0; i < contextImageUrls.length; i++) {
        const url = contextImageUrls[i];
        const label = contextImageLabels?.[i] || `context-${i + 1}`;
        if (!url) continue;
        
        try {
          if (url.startsWith("data:")) {
            imageInput.push(url);
          } else {
            imageInput.push(await fetchImageAsDataUrl(url));
          }
          logger.info(`Successfully added context image: ${label}`);
        } catch (e) {
          logger.error(`Failed to add context image ${label}`, e);
        }
      }
    }

    // Add avatar image (skip in remix/iteration mode - they work from existing complete image)
    if (!remixImageUrl && !iterationImageUrl) {
      if (thumbnailData.customAvatarUrl) {
        imageInput.push(await fetchImageAsDataUrl(thumbnailData.customAvatarUrl));
      } else if (thumbnailData.avatarId) {
        const { data: avatar } = await supabase
          .from("avatars")
          .select("image_url")
          .eq("id", thumbnailData.avatarId)
          .single();

        if (avatar?.image_url) {
          imageInput.push(await fetchImageAsDataUrl(avatar.image_url));
        }
      }
    }

    // Add element images (skip in remix/iteration mode)
    if (!remixImageUrl && !iterationImageUrl) {
      if (thumbnailData.elements && thumbnailData.elements.length > 0) {
        for (const element of thumbnailData.elements) {
          if (element.url) {
            imageInput.push(await fetchImageAsDataUrl(element.url));
          } else if (element.id) {
            const { data: productImages } = await supabase
              .from("product_images")
              .select("image_url")
              .eq("product_id", element.id)
              .limit(1);

            if (productImages && productImages.length > 0 && productImages[0].image_url) {
              imageInput.push(await fetchImageAsDataUrl(productImages[0].image_url));
            }
          }
        }
      } else if (thumbnailData.productIds && thumbnailData.productIds.length > 0) {
        const { data: productImages } = await supabase
          .from("product_images")
          .select("image_url")
          .in("product_id", thumbnailData.productIds);

        if (productImages) {
          for (const productImage of productImages) {
            if (productImage.image_url) {
              imageInput.push(await fetchImageAsDataUrl(productImage.image_url));
            }
          }
        }
      }
    }

    // Add custom background (skip in remix/iteration mode)
    if (!remixImageUrl && !iterationImageUrl && 
        (thumbnailData?.backgroundType === "custom" || thumbnailData?.backgroundType === "image") && 
        thumbnailData?.backgroundValue) {
      imageInput.push(await fetchImageAsDataUrl(thumbnailData.backgroundValue));
    }

    // Add font style reference image (skip in remix/iteration mode)
    if (!remixImageUrl && !iterationImageUrl && thumbnailData?.fontStyleImageUrl) {
      imageInput.push(await fetchImageAsDataUrl(thumbnailData.fontStyleImageUrl));
    }

    logger.info("Generated prompt", { prompt });
    logger.info("Number of image inputs", { count: imageInput.length });

    // Replicate API call with polling logic
    logger.info("Starting Replicate prediction...");
    
    // 1. Create prediction
    const createResponse = await fetch(
      "https://api.replicate.com/v1/models/google/nano-banana-pro/predictions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${replicateApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          input: {
            prompt,
            resolution,
            ...(imageInput.length > 0 ? { image_input: imageInput } : {}),
            aspect_ratio: aspectRatio,
            output_format: "png",
            safety_filter_level: "block_only_high",
          },
        }),
      }
    );

    if (!createResponse.ok) {
      const errorText = await createResponse.text();
      throw new Error(`Failed to create Replicate prediction: ${createResponse.status} ${errorText}`);
    }

    let prediction = await createResponse.json();
    const predictionId = prediction.id;
    logger.info(`Prediction created: ${predictionId}`);

    // 2. Poll for completion
    const maxPollAttempts = 120; // ~6 minutes total (with 3s delay)
    const pollInterval = 3000;
    let succeeded = false;

    for (let i = 0; i < maxPollAttempts; i++) {
      if (prediction.status === "succeeded") {
        succeeded = true;
        break;
      } else if (prediction.status === "failed" || prediction.status === "canceled") {
        throw new Error(`Replicate prediction ${prediction.status}: ${prediction.error || "No error details"}`);
      }

      logger.info(`Polling prediction ${predictionId} (attempt ${i + 1}, status: ${prediction.status})...`);
      await new Promise(resolve => setTimeout(resolve, pollInterval));

      const pollResponse = await fetch(
        `https://api.replicate.com/v1/predictions/${predictionId}`,
        {
          headers: {
            Authorization: `Bearer ${replicateApiKey}`,
          },
        }
      );

      if (pollResponse.ok) {
        prediction = await pollResponse.json();
      } else {
        const pollError = await pollResponse.text();
        logger.error(`Poll failed: ${pollResponse.status} ${pollError}`);
        // Continue polling unless we get a terminal error
        if (pollResponse.status >= 500) continue;
        throw new Error(`Failed to poll Replicate prediction: ${pollResponse.status}`);
      }
    }

    if (!succeeded) {
      throw new Error("Replicate prediction timed out");
    }

    logger.info("Replicate prediction successful");

    const output = prediction?.output;
    const outputUrl = typeof output === "string" ? output : (Array.isArray(output) && typeof output[0] === "string" ? output[0] : null);

    if (!outputUrl) {
      throw new Error("No image output received from Replicate");
    }

    // Download the generated image
    const imageRes = await fetch(outputUrl);
    if (!imageRes.ok) {
      throw new Error(`Failed to download output image: ${imageRes.status}`);
    }
    const contentType = imageRes.headers.get("content-type") || "image/png";
    const imageArrayBuffer = await imageRes.arrayBuffer();

    // For grid mode, return base64 directly
    if (isGridMode) {
      const imageData = arrayBufferToBase64(imageArrayBuffer);
      if (generationId) {
        await supabase
          .from("generations")
          .update({
            status: "completed",
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
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // For single mode, upload to storage
    const fileName = `${userId}/${Date.now()}.png`;
    const binaryData = new Uint8Array(imageArrayBuffer);

    const { error: uploadError } = await supabase.storage
      .from("thumbnails")
      .upload(fileName, binaryData, { contentType });

    if (uploadError) throw uploadError;

    const { data: { publicUrl } } = supabase.storage
      .from("thumbnails")
      .getPublicUrl(fileName);

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
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
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

    logger.error("Error in generate-thumbnail function", error);
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
