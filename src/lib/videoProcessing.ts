import { supabase, supabaseLongRunning } from "@/integrations/supabase/client";
import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile } from "@ffmpeg/util";

export interface GenerationResult {
  thumbnails: string[];
  transcription: string;
  prompt?: string;
}

export interface ProcessingCallbacks {
  onProgress: (step: number, message: string) => void;
  onTranscriptionUpdate?: (text: string) => void;
  onThumbnailUpdate?: (thumbnails: string[]) => void;
  onFramesUpdate?: (frames: string[]) => void;
  onAudioUpdate?: (audioDataUrl: string) => void;
  onFramesReady?: (frames: string[]) => Promise<string[]>;
}

let ffmpeg: FFmpeg | null = null;
let ffmpegLoadPromise: Promise<void> | null = null;

async function getFFmpeg(): Promise<FFmpeg> {
  if (!ffmpeg) {
    ffmpeg = new FFmpeg();
  }

  if (!ffmpegLoadPromise) {
    // IMPORTANT: @ffmpeg/ffmpeg uses a `type: "module"` worker (see node_modules/@ffmpeg/ffmpeg/dist/esm/classes.js),
    // so coreURL must be the ESM build. Passing the UMD build causes import() to fail (no default export),
    // resulting in "failed to import ffmpeg-core.js".
    const baseURL = "https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/esm";

    ffmpegLoadPromise = (async () => {
      console.log("Loading FFmpeg from:", baseURL);
      
      const coreURL = `${baseURL}/ffmpeg-core.js`;
      const wasmURL = `${baseURL}/ffmpeg-core.wasm`;

      try {
        await ffmpeg!.load({
          coreURL,
          wasmURL,
        });
        console.log("FFmpeg loaded successfully");
      } catch (err: any) {
        throw err;
      }
    })();
  }

  const timeoutMs = 180_000;
  const timeoutPromise = new Promise<never>((_, reject) => {
    const t = setTimeout(() => {
      clearTimeout(t);
      reject(new Error(`Could not load FFmpeg (timeout of ${Math.round(timeoutMs / 1000)}s).`));
    }, timeoutMs);
  });

  await Promise.race([ffmpegLoadPromise, timeoutPromise]);

  return ffmpeg;
}

// Extract frames from video file at evenly distributed timestamps
async function extractFramesFromVideo(file: File, numFrames: number = 6): Promise<{ frames: string[]; duration: number }> {
  return new Promise((resolve) => {
    const video = document.createElement('video');
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const frames: string[] = [];
    
    video.preload = 'metadata';
    video.muted = true;
    video.playsInline = true;
    
    // Timeout fallback in case video loading fails
    const timeout = setTimeout(() => {
      console.warn('Frame extraction timed out');
      URL.revokeObjectURL(video.src);
      resolve({ frames, duration: 0 });
    }, 30000);
    
    video.onloadedmetadata = () => {
      const duration = video.duration;
      const videoWidth = video.videoWidth;
      const videoHeight = video.videoHeight;
      const aspectRatio = videoWidth / videoHeight;
      
      console.log(`Video metadata: ${videoWidth}x${videoHeight} (ratio ${aspectRatio.toFixed(2)}), duration: ${duration}s`);
      
      // Calculate timestamps for randomized frame extraction
      // Skip first and last 5% of the video to avoid intros/outros
      const startOffset = duration * 0.05;
      const endOffset = duration * 0.95;
      const usableDuration = endOffset - startOffset;
      
      // Divide the video into equal segments and pick a random point in each
      // This ensures we get variety while still covering the whole video
      const segmentDuration = usableDuration / numFrames;
      const timestamps: number[] = [];
      
      for (let i = 0; i < numFrames; i++) {
        const segmentStart = startOffset + (i * segmentDuration);
        // Add random jitter within the segment (up to 90% of segment width to avoid overlaps)
        const jitter = Math.random() * segmentDuration * 0.9;
        const time = segmentStart + jitter;
        timestamps.push(Math.min(time, duration - 0.1));
      }
      
      // Sort timestamps to ensure logical progression in UI
      timestamps.sort((a, b) => a - b);
      
      console.log(`Extracting randomized frames at:`, timestamps.map(t => t.toFixed(1) + 's'));
      
      // Maintain original aspect ratio, targeting 720p height for good detail
      const targetHeight = 720;
      canvas.height = targetHeight;
      canvas.width = Math.round(targetHeight * aspectRatio);
      
      console.log(`Extraction resolution: ${canvas.width}x${canvas.height}`);
      
      let frameIndex = 0;
      
      const captureFrame = () => {
        if (frameIndex >= numFrames) {
          clearTimeout(timeout);
          URL.revokeObjectURL(video.src);
          console.log(`Extracted ${frames.length} frames successfully`);
          resolve({ frames, duration });
          return;
        }
        
        video.currentTime = timestamps[frameIndex];
      };
      
      video.onseeked = () => {
        if (ctx && video.readyState >= 2) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          // Increase quality for better detail
          frames.push(canvas.toDataURL('image/jpeg', 0.9));
          console.log(`Captured frame ${frameIndex + 1} at ${timestamps[frameIndex].toFixed(1)}s`);
        }
        frameIndex++;
        captureFrame();
      };
      
      captureFrame();
    };
    
    video.onerror = (e) => {
      console.error('Video loading error:', e);
      clearTimeout(timeout);
      resolve({ frames, duration: 0 });
    };
    
    video.src = URL.createObjectURL(file);
  });
}

export async function extractAudioFromVideo(
  file: File,
  opts?: {
    onProgress?: (ratio: number) => void;
    timeoutMs?: number;
    duration?: number;
  }
): Promise<{ base64: string; mimeType: string }> {
  console.log("Starting FFmpeg audio extraction...", {
    name: file.name,
    type: file.type,
    size: file.size,
    duration: opts?.duration,
  });

  const ff = await getFFmpeg();

  // Hook progress to surface "stuck" situations.
  const onProgress = opts?.onProgress;
  const timeoutMs = opts?.timeoutMs ?? 2 * 60 * 1000;
  const duration = opts?.duration ?? 0;

  const progressHandler = (p: { progress?: number; time?: number }) => {
    const ratio = Math.max(0, Math.min(1, p.progress ?? 0));
    onProgress?.(ratio);
  };

  // @ffmpeg/ffmpeg exposes .on(event, cb)
  // We attach once per invocation and detach after.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const anyFf = ff as any;
  try {
    if (typeof anyFf.on === "function") {
      anyFf.on("progress", progressHandler);
    }

    // Use the real extension so demuxing works for webm/mov/etc.
    const extFromName = (file.name.split(".").pop() || "").toLowerCase();
    const ext = extFromName && extFromName.length <= 6 ? extFromName : "mp4";
    const inputName = `input.${ext}`;
    const outputName = "output.mp3";

    await ff.writeFile(inputName, await fetchFile(file));
    console.log("Input file written to FFmpeg", { inputName });

    // If duration > 15 minutes (900s), take first 7.5 min and last 7.5 min
    let ffmpegArgs: string[];
    if (duration > 900) {
      console.log(`Video is long (${duration.toFixed(1)}s), trimming first 7.5m and last 7.5m`);
      const trimDuration = 450; // 7.5 minutes in seconds
      const startTimePart2 = duration - trimDuration;
      
      ffmpegArgs = [
        "-i", inputName,
        "-filter_complex", 
        `[0:a:0]atrim=0:${trimDuration},asetpts=PTS-STARTPTS[a1];[0:a:0]atrim=start=${startTimePart2}:end=${duration},asetpts=PTS-STARTPTS[a2];[a1][a2]concat=n=2:v=0:a=1[out]`,
        "-map", "[out]",
        "-ac", "1",
        "-ar", "16000",
        "-b:a", "64k",
        "-f", "mp3",
        outputName
      ];
    } else {
      ffmpegArgs = [
        "-i",
        inputName,
        "-vn",
        // Prefer the first audio stream and keep it small for faster processing.
        "-map",
        "0:a:0?",
        "-ac",
        "1",
        "-ar",
        "16000",
        "-b:a",
        "64k",
        "-f",
        "mp3",
        outputName,
      ];
    }

    const execPromise = ff.exec(ffmpegArgs);

    const timeoutPromise = new Promise<never>((_, reject) => {
      const t = setTimeout(() => {
        clearTimeout(t);
        reject(new Error("FFmpeg took too long converting audio (timeout)."));
      }, timeoutMs);
    });

    await Promise.race([execPromise, timeoutPromise]);
    console.log("FFmpeg extraction complete");

    const data = await ff.readFile(outputName);

    let uint8Array: Uint8Array;
    if (typeof data === "string") {
      uint8Array = new TextEncoder().encode(data);
    } else {
      uint8Array = data;
    }

    console.log("Output file read, size:", uint8Array.length);

    // Convert to base64 - copy to a new ArrayBuffer to avoid SharedArrayBuffer issues
    const buffer = new ArrayBuffer(uint8Array.length);
    new Uint8Array(buffer).set(uint8Array);
    const blob = new Blob([buffer], { type: "audio/mpeg" });

    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = String(reader.result || "");
        const base64 = result.split(",")[1] || "";
        console.log("Audio extracted successfully, base64 length:", base64.length);
        resolve({ base64, mimeType: "audio/mpeg" });
      };
      reader.onerror = () => reject(new Error("Failed to read extracted audio"));
      reader.readAsDataURL(blob);
    });
  } finally {
    try {
      if (typeof anyFf.off === "function") {
        anyFf.off("progress", progressHandler);
      }
    } catch {
      // ignore
    }
  }
}

export async function transcribeAudio(audioBase64: string, mimeType: string = 'audio/webm'): Promise<string> {
  console.log('Sending transcription request, audio length:', audioBase64.length, 'mimeType:', mimeType);
  
  try {
    const { data, error } = await supabase.functions.invoke('transcribe-audio', {
      body: { audio: audioBase64, mimeType }
    });

    console.log('Transcription response:', { data, error });

    if (error) {
      console.error('Supabase function error:', error);
      throw new Error(`Edge function error: ${error.message}`);
    }
    if (data?.error) {
      console.error('Transcription API error:', data.error);
      throw new Error(`Transcription error: ${data.error}`);
    }
    
    return data.text;
  } catch (err) {
    console.error('Transcription request failed:', err);
    throw err;
  }
}

/**
 * Crops a 2x2 grid image into 4 individual thumbnails
 * @param gridImage - Data URL of the 2x2 grid image (3840x2160)
 * @returns Array of 4 thumbnail data URLs (each 1920x1080)
 */
export async function cropGridToThumbnails(gridImage: string): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    
    img.onload = () => {
      // Grid should be 3840x2160 (2x2 of 1920x1080 thumbnails)
      const gridWidth = img.width;
      const gridHeight = img.height;
      
      // Each thumbnail should be half the grid dimensions
      const thumbnailWidth = gridWidth / 2;
      const thumbnailHeight = gridHeight / 2;
      
      const canvas = document.createElement('canvas');
      canvas.width = thumbnailWidth;
      canvas.height = thumbnailHeight;
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        reject(new Error('Could not get canvas context'));
        return;
      }
      
      const thumbnails: string[] = [];
      
      // Crop in order: top-left, top-right, bottom-left, bottom-right
      const positions = [
        { x: 0, y: 0 },           // top-left
        { x: thumbnailWidth, y: 0 }, // top-right
        { x: 0, y: thumbnailHeight }, // bottom-left
        { x: thumbnailWidth, y: thumbnailHeight } // bottom-right
      ];
      
      for (const pos of positions) {
        ctx.clearRect(0, 0, thumbnailWidth, thumbnailHeight);
        ctx.drawImage(
          img,
          pos.x, pos.y, thumbnailWidth, thumbnailHeight, // source rect
          0, 0, thumbnailWidth, thumbnailHeight // dest rect
        );
        thumbnails.push(canvas.toDataURL('image/jpeg', 0.9));
      }
      
      console.log(`Cropped grid into ${thumbnails.length} thumbnails`);
      resolve(thumbnails);
    };
    
    img.onerror = () => {
      reject(new Error('Failed to load grid image'));
    };
    
    img.src = gridImage;
  });
}

export async function generateThumbnails(
  transcription: string,
  frames?: string[],
  videoTitle?: string,
  onUpdate?: (thumbnails: string[]) => void,
  creditsUsed: number = 2
): Promise<{ thumbnails: string[]; prompt: string; generationId?: string }> {
  // Step 1: Generate thumbnail prompts with Gemini
  console.log('Step 1: Generating thumbnail prompts...');
  const { data: promptsData, error: promptsError } = await supabase.functions.invoke('generate-thumbnail-prompts', {
    body: { transcription, frames, videoTitle, isViral: true }
  });

  if (promptsError) throw new Error(promptsError.message);
  if (promptsData?.error) throw new Error(promptsData.error);
  
  const thumbnailPrompts = promptsData?.thumbnails || [];
  if (thumbnailPrompts.length !== 4) {
    throw new Error(`Expected 4 thumbnail prompts, got ${thumbnailPrompts.length}`);
  }

  console.log('Step 2: Generating 2x2 grid...');
  // Step 2: Generate 2x2 grid with Gemini
  // Use supabaseLongRunning for the 2x2 grid generation as it can take up to 2 minutes
  const { data: gridData, error: gridError } = await supabaseLongRunning.functions.invoke('generate-thumbnails', {
    body: { 
      thumbnailPrompts, 
      frames,
      isViral: true,
      creditsUsed
    }
  });

  if (gridError) throw new Error(gridError.message);
  if (gridData?.error) throw new Error(gridData.error);
  
  const gridImage = gridData?.gridImage;
  const prompt = gridData?.prompt || "";
  const generationId = gridData?.generationId;

  if (!gridImage) {
    throw new Error('No grid image received from generate-thumbnails');
  }

  console.log('Step 3: Cropping grid into individual thumbnails...');
  // Step 3: Crop grid into 4 thumbnails
  const thumbnails = await cropGridToThumbnails(gridImage);
  
  // Progressive loading for better UX
  if (onUpdate) {
    for (let i = 0; i < thumbnails.length; i++) {
      await new Promise(resolve => setTimeout(resolve, 200));
      onUpdate(thumbnails.slice(0, i + 1));
    }
  }
  
  return { thumbnails, prompt, generationId };
}

export async function processVideoContent(
  input: { type: "url" | "file"; value: string | File; creditsUsed?: number },
  callbacks: ProcessingCallbacks
): Promise<GenerationResult & { generationId?: string }> {
  const { onProgress, onTranscriptionUpdate, onThumbnailUpdate, onFramesUpdate, onAudioUpdate, onFramesReady } = callbacks;
  
  // Step 0: Extract frames and audio from video
  onProgress(0, "Extracting frames and audio...");

  let audioBase64: string;
  let mimeType = 'audio/webm';
  let extractedFrames: string[] = [];
  let videoDuration = 0;

  if (input.type === "file" && input.value instanceof File) {
    // Extract frames progressively
    const extractionResult = await extractFramesFromVideo(input.value, 6);
    extractedFrames = extractionResult.frames;
    videoDuration = extractionResult.duration;

    // Update frames one by one for visual effect
    if (onFramesUpdate) {
      for (let i = 0; i < extractedFrames.length; i++) {
        await new Promise((resolve) => setTimeout(resolve, 200));
        onFramesUpdate(extractedFrames.slice(0, i + 1));
      }
    }

    // Extract ONLY the audio track (not the whole video)
    let lastPctShown = -1;
    const extracted = await extractAudioFromVideo(input.value, {
      duration: videoDuration,
      timeoutMs: 2 * 60 * 1000,
      onProgress: (ratio) => {
        const pct = Math.round(ratio * 100);
        if (pct !== lastPctShown && pct % 5 === 0) {
          lastPctShown = pct;
          onProgress(0, `Extracting audio (FFmpeg)… ${pct}%`);
        }
      },
    });
    audioBase64 = extracted.base64;
    mimeType = extracted.mimeType;

    // Create audio data URL for preview playback
    if (onAudioUpdate) {
      const audioDataUrl = `data:${mimeType};base64,${audioBase64}`;
      onAudioUpdate(audioDataUrl);
    }

    // Wait for user to confirm/edit frames if callback provided
    if (onFramesReady) {
      extractedFrames = await onFramesReady(extractedFrames);
    }
  } else {
    throw new Error("YouTube URL processing not yet implemented. Please upload a video file.");
  }

  // Step 1: Transcribe with Whisper
  onProgress(1, "Transcribing audio...");
  const transcription = await transcribeAudio(audioBase64, mimeType);
  
  // Update transcription preview
  if (onTranscriptionUpdate) {
    onTranscriptionUpdate(transcription);
  }

  // Step 2: Generate thumbnails
  onProgress(2, "Creating thumbnails...");
  const thumbnailResult = await generateThumbnails(transcription, extractedFrames, undefined, onThumbnailUpdate, input.creditsUsed);

  // Small delay to show completion state
  await new Promise(resolve => setTimeout(resolve, 800));

  return {
    thumbnails: thumbnailResult.thumbnails,
    transcription,
    prompt: thumbnailResult.prompt,
    generationId: thumbnailResult.generationId
  };
}

