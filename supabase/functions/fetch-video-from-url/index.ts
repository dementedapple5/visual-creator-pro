import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import ytdl from "npm:@distube/ytdl-core@4.16.12";
import { corsHeaders } from "../_shared/cors.ts";
import { createLogger } from "../_shared/logger.ts";

const logger = createLogger("fetch-video-from-url");

const MAX_VIDEO_BYTES = Number(Deno.env.get("FETCH_VIDEO_MAX_BYTES") || `${250 * 1024 * 1024}`);
const SIGNED_URL_TTL_SECONDS = Number(Deno.env.get("FETCH_VIDEO_SIGNED_URL_TTL_SECONDS") || "900");

type YtdlCookie = {
  domain?: string;
  expirationDate?: number;
  hostOnly?: boolean;
  httpOnly?: boolean;
  name: string;
  path?: string;
  sameSite?: string;
  secure?: boolean;
  session?: boolean;
  value: string;
};

const isLikelyVideoMimeType = (mimeType: string): boolean => {
  const normalized = (mimeType || "").split(";")[0].trim().toLowerCase();
  return normalized.startsWith("video/") || normalized === "application/octet-stream";
};

const isYouTubeHost = (hostname: string): boolean => {
  const host = hostname.toLowerCase();
  return host.includes("youtube.com") || host.includes("youtu.be") || host.includes("youtube-nocookie.com");
};

const extractYouTubeVideoId = (url: URL): string | null => {
  const host = url.hostname.toLowerCase();

  if (host.includes("youtu.be")) {
    const id = url.pathname.split("/").filter(Boolean)[0];
    return id || null;
  }

  const fromQuery = url.searchParams.get("v");
  if (fromQuery) return fromQuery;

  const segments = url.pathname.split("/").filter(Boolean);
  const markerIndex = segments.findIndex((segment) => segment === "shorts" || segment === "embed" || segment === "live");
  if (markerIndex >= 0 && segments[markerIndex + 1]) {
    return segments[markerIndex + 1];
  }

  return null;
};

const parseContentLength = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed >= 0) return parsed;
  }
  return null;
};

const sanitizeFileName = (value: string): string => {
  const trimmed = value.trim();
  const withoutReserved = trimmed.replace(/[<>:"/\\|?*\x00-\x1F]/g, "");
  const normalizedWhitespace = withoutReserved.replace(/\s+/g, " ").trim();
  const safe = normalizedWhitespace.slice(0, 80).trim();
  return safe || "youtube-video";
};

const extensionFromMimeType = (mimeType: string): string => {
  const normalized = (mimeType || "").split(";")[0].trim().toLowerCase();
  const byMime: Record<string, string> = {
    "video/mp4": "mp4",
    "video/webm": "webm",
    "video/quicktime": "mov",
    "video/x-matroska": "mkv",
    "video/x-msvideo": "avi",
  };

  if (byMime[normalized]) return byMime[normalized];
  if (normalized.startsWith("video/")) {
    return normalized.replace("video/", "").replace(/[^a-z0-9]/g, "") || "mp4";
  }

  return "mp4";
};

const pickYouTubeFormat = (formats: any[]): any | null => {
  const progressive = formats.filter((format) => {
    return format?.hasVideo && format?.hasAudio && typeof format?.url === "string";
  });

  if (progressive.length === 0) return null;

  const score = (format: any): number => {
    const height = typeof format?.height === "number" ? format.height : 0;
    const bitrate = typeof format?.bitrate === "number" ? format.bitrate : 0;
    const isMp4 = typeof format?.mimeType === "string" && format.mimeType.toLowerCase().includes("video/mp4");
    return height * 10_000 + bitrate + (isMp4 ? 500 : 0);
  };

  const sorted = [...progressive].sort((a, b) => score(b) - score(a));

  // Prefer <=1080p for balance of quality and size.
  const preferred = sorted.find((format) => (typeof format?.height === "number" ? format.height : 0) <= 1080);
  return preferred || sorted[0];
};

const isBotChallengeError = (message: string): boolean => {
  const normalized = message.toLowerCase();
  return normalized.includes("sign in to confirm") || normalized.includes("not a bot");
};

const parseCookiesFromEnv = (): YtdlCookie[] | null => {
  const raw = Deno.env.get("YTDL_COOKIES_JSON") || Deno.env.get("YOUTUBE_COOKIES_JSON");
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    const valid = parsed.filter((cookie) => {
      return cookie && typeof cookie.name === "string" && typeof cookie.value === "string";
    });
    return valid.length > 0 ? (valid as YtdlCookie[]) : null;
  } catch {
    return null;
  }
};

const createYtdlAgent = (): { agent: any | undefined; hasCookies: boolean; usingProxy: boolean } => {
  const cookies = parseCookiesFromEnv();
  const proxyUri = Deno.env.get("YTDL_PROXY_URI");

  if (proxyUri) {
    const proxy = { uri: proxyUri };
    const agent = cookies ? ytdl.createProxyAgent(proxy, cookies) : ytdl.createProxyAgent(proxy);
    return { agent, hasCookies: Boolean(cookies), usingProxy: true };
  }

  if (cookies) {
    return { agent: ytdl.createAgent(cookies), hasCookies: true, usingProxy: false };
  }

  return { agent: undefined, hasCookies: false, usingProxy: false };
};

const fetchYouTubeInfo = async (
  videoUrl: string,
  agent: any | undefined,
  hasCookies: boolean,
): Promise<any> => {
  const attempts = [
    ["WEB_EMBEDDED", "IOS", "ANDROID", "TV"],
    ["ANDROID", "IOS", "TV"],
    ["TV", "IOS"],
    ["WEB"],
  ];
  let lastError: unknown;

  for (const playerClients of attempts) {
    try {
      return await ytdl.getInfo(videoUrl, {
        agent,
        playerClients,
        requestOptions: {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
            "Accept-Language": "en-US,en;q=0.9",
            "Referer": "https://www.youtube.com/",
          },
        },
      });
    } catch (error) {
      lastError = error;
      const message = error instanceof Error ? error.message : String(error);
      if (isBotChallengeError(message) && !hasCookies) {
        throw new Error(
          "YouTube blocked automated access for this video. Configure YTDL_COOKIES_JSON in Supabase secrets (YouTube cookies JSON), then retry.",
        );
      }
    }
  }

  if (lastError instanceof Error) throw lastError;
  throw new Error("Could not fetch YouTube metadata.");
};

const jsonResponse = (status: number, payload: Record<string, unknown>) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error("Missing Supabase configuration.");
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return jsonResponse(401, { error: "Missing authorization header." });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData?.user) {
      logger.error("User auth failed", userError);
      return jsonResponse(401, { error: "User not authenticated." });
    }

    const user = userData.user;

    const body = await req.json().catch(() => null);
    const rawUrl = typeof body?.url === "string" ? body.url.trim() : "";
    if (!rawUrl) {
      return jsonResponse(400, { error: "Missing url." });
    }

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(rawUrl);
    } catch {
      return jsonResponse(400, { error: "Invalid URL." });
    }

    if (!["http:", "https:"].includes(parsedUrl.protocol)) {
      return jsonResponse(400, { error: "Only HTTP/HTTPS URLs are supported." });
    }

    if (!isYouTubeHost(parsedUrl.hostname)) {
      return jsonResponse(400, { error: "This function currently supports YouTube URLs only." });
    }

    const videoId = extractYouTubeVideoId(parsedUrl);
    if (!videoId) {
      return jsonResponse(400, { error: "Could not extract YouTube video ID." });
    }

    logger.setContext({ userId: user.id, videoId });
    const { agent, hasCookies, usingProxy } = createYtdlAgent();
    logger.info("Fetching YouTube metadata", { hasCookies, usingProxy });

    const info = await fetchYouTubeInfo(parsedUrl.toString(), agent, hasCookies);
    const selectedFormat = pickYouTubeFormat(info?.formats || []);
    if (!selectedFormat?.url) {
      return jsonResponse(422, { error: "No downloadable YouTube format found." });
    }

    const declaredLength = parseContentLength(selectedFormat.contentLength);
    if (declaredLength !== null && declaredLength > MAX_VIDEO_BYTES) {
      return jsonResponse(413, {
        error: `Video is too large (${Math.round(declaredLength / (1024 * 1024))} MB). Limit is ${Math.round(MAX_VIDEO_BYTES / (1024 * 1024))} MB.`,
      });
    }

    const downloadHeaders: HeadersInit = {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
      "Referer": "https://www.youtube.com/",
      "Origin": "https://www.youtube.com",
    };

    logger.info("Downloading selected YouTube stream");
    const streamResponse = await fetch(selectedFormat.url, { headers: downloadHeaders });
    if (!streamResponse.ok || !streamResponse.body) {
      return jsonResponse(502, { error: `Failed to download YouTube stream (HTTP ${streamResponse.status}).` });
    }

    const contentTypeFromResponse = (streamResponse.headers.get("content-type") || "").split(";")[0].trim();
    const selectedMimeType = (typeof selectedFormat.mimeType === "string" ? selectedFormat.mimeType : "").split(";")[0].trim();
    const mimeType = selectedMimeType || contentTypeFromResponse || "video/mp4";

    if (!isLikelyVideoMimeType(mimeType)) {
      return jsonResponse(422, { error: "Downloaded stream is not a video format." });
    }

    const reader = streamResponse.body.getReader();
    const chunks: Uint8Array[] = [];
    let totalBytes = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;

      totalBytes += value.byteLength;
      if (totalBytes > MAX_VIDEO_BYTES) {
        return jsonResponse(413, {
          error: `Video exceeds max allowed size (${Math.round(MAX_VIDEO_BYTES / (1024 * 1024))} MB).`,
        });
      }
      chunks.push(value);
    }

    if (totalBytes === 0) {
      return jsonResponse(422, { error: "Downloaded video is empty." });
    }

    const videoBytes = new Uint8Array(totalBytes);
    let offset = 0;
    for (const chunk of chunks) {
      videoBytes.set(chunk, offset);
      offset += chunk.byteLength;
    }

    const ext = extensionFromMimeType(mimeType);
    const title = sanitizeFileName(info?.videoDetails?.title || `youtube-${videoId}`);
    const fileName = `${title}.${ext}`;
    const storagePath = `${user.id}/url-imports/${Date.now()}-${crypto.randomUUID()}.${ext}`;

    logger.info("Uploading downloaded video to storage", { storagePath, bytes: totalBytes });
    const { error: uploadError } = await supabase.storage
      .from("smart-create-videos")
      .upload(storagePath, videoBytes, {
        contentType: mimeType,
        upsert: false,
        cacheControl: "3600",
      });

    if (uploadError) {
      logger.error("Storage upload failed", uploadError);
      throw new Error(uploadError.message);
    }

    const { data: signedData, error: signedError } = await supabase.storage
      .from("smart-create-videos")
      .createSignedUrl(storagePath, SIGNED_URL_TTL_SECONDS);

    if (signedError || !signedData?.signedUrl) {
      logger.error("Could not create signed URL", signedError);
      throw new Error(signedError?.message || "Could not create signed URL.");
    }

    const signedUrl = signedData.signedUrl.startsWith("http")
      ? signedData.signedUrl
      : `${supabaseUrl}${signedData.signedUrl}`;

    logger.info("Video prepared successfully");
    return jsonResponse(200, {
      signedUrl,
      storagePath,
      fileName,
      contentType: mimeType,
      sizeBytes: totalBytes,
      expiresIn: SIGNED_URL_TTL_SECONDS,
    });
  } catch (error) {
    logger.error("Unhandled error in fetch-video-from-url", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    const status = isBotChallengeError(message) ? 403 : 500;
    return jsonResponse(status, { error: message });
  }
});
