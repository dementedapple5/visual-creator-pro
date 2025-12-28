import { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import { Zap, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { VideoInput } from "@/components/quick-create/VideoInput";
import { ProcessingState } from "@/components/quick-create/ProcessingState";
import { ProcessingPanel } from "@/components/quick-create/ProcessingPanel";
import { ResultsView } from "@/components/quick-create/ResultsView";
import { processVideoContent } from "@/lib/videoProcessing";
import { uploadDataUrlToStorage, isDataUrl } from "@/lib/imageUtils";
import { toast } from "sonner";
import { getGenerationLimitLabel, getGenerationWindowStart } from "@/lib/generationLimits";

type AppState = "input" | "processing" | "results";

const TypewriterText = ({ texts }: { texts: string[] }) => {
  const [index, setIndex] = useState(0);
  const [displayText, setDisplayText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  
  useEffect(() => {
    const currentFullText = texts[index];
    const timeout = setTimeout(() => {
      if (!isDeleting) {
        if (displayText.length < currentFullText.length) {
          setDisplayText(currentFullText.slice(0, displayText.length + 1));
        } else {
          // Pause at the end
          setTimeout(() => setIsDeleting(true), 2000);
        }
      } else {
        if (displayText.length > 0) {
          setDisplayText(currentFullText.slice(0, displayText.length - 1));
        } else {
          setIsDeleting(false);
          setIndex((prev) => (prev + 1) % texts.length);
        }
      }
    }, isDeleting ? 50 : 100);
    
    return () => clearTimeout(timeout);
  }, [displayText, isDeleting, index, texts]);

  return (
    <span className="inline-flex items-center">
      {displayText}
      <motion.span
        animate={{ opacity: [0, 1, 0] }}
        transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}
        className="ml-1 inline-block w-[3px] h-[1.2em] bg-primary rounded-full"
      />
    </span>
  );
};

const QuickCreate = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [appState, setAppState] = useState<AppState>("input");
  const [processingStep, setProcessingStep] = useState(0);
  const [processingMessage, setProcessingMessage] = useState("");
  const [thumbnails, setThumbnails] = useState<string[]>([]);
  const [titles, setTitles] = useState<string[]>([]);
  const [transcription, setTranscription] = useState<string>("");
  const [prompt, setPrompt] = useState<string>("");
  const [isSaving, setIsSaving] = useState(false);
  
  // Preview states during processing
  const [transcriptionPreview, setTranscriptionPreview] = useState("");
  const [thumbnailPreviews, setThumbnailPreviews] = useState<string[]>([]);
  const [titlePreviews, setTitlePreviews] = useState<string[]>([]);
  const [framesPreviews, setFramesPreviews] = useState<string[]>([]);
  const [audioPreview, setAudioPreview] = useState<string | null>(null);
  const submitInFlightRef = useRef(false);

  useEffect(() => {
    checkUser();
  }, []);

  const checkUser = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate("/auth");
    }
  };

  const handleSubmit = async (input: { type: "url" | "file"; value: string | File; isViral: boolean }) => {
    // Prevent duplicate submits (double click, lag, etc.)
    if (submitInFlightRef.current) return;
    submitInFlightRef.current = true;

    try {
    // Check credits before starting
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error(t("quickCreate.errors.signInFirst"));
      navigate("/auth");
      return;
    }

    const { data: subscriptionData } = await supabase.functions.invoke("check-subscription");
    const monthlyLimit = subscriptionData?.monthly_limit || 1;
    const countStartDate = getGenerationWindowStart(subscriptionData || {});
    const isSuperAdmin = subscriptionData?.is_super_admin === true;

    const { data: usageData } = await supabase
      .from("generations")
      .select("credits_used")
      .eq("user_id", user.id)
      .in("status", ["completed", "processing"])
      .gte("created_at", countStartDate);

    const usedGenerations = usageData?.reduce((acc, curr) => acc + (curr.credits_used || 0), 0) || 0;
    const requiredCredits = 2; // Quick Create uses 2 credits (4 thumbnails)

    if (!isSuperAdmin && usedGenerations + requiredCredits > monthlyLimit) {
      const limitType = getGenerationLimitLabel(subscriptionData || {});
      toast.error(`${limitType} ${t("quickCreate.errors.limitReached")}`);
      return;
    }

    // 1. Create initial generation record
    const { data: generationData, error: initialGenError } = await supabase
      .from("generations")
      .insert({
        user_id: user.id,
        status: "processing",
        credits_used: requiredCredits,
        mode: "create",
      })
      .select("id")
      .single();

    if (initialGenError) {
      console.warn("Could not create initial generation record:", initialGenError);
      toast.error(t("quickCreate.errors.couldNotStart"));
      return;
    }

    const generationId = generationData?.id;

    setAppState("processing");
    setProcessingStep(0);
    setProcessingMessage(t("quickCreate.success.preparing"));
    setTranscriptionPreview("");
    setThumbnailPreviews([]);
    setTitlePreviews([]);
    setFramesPreviews([]);
    setAudioPreview(null);

    try {
      const result = await processVideoContent(input, {
        onProgress: (step, message) => {
          setProcessingStep(step);
          setProcessingMessage(message);
        },
        onFramesUpdate: (frames) => {
          setFramesPreviews(frames);
        },
        onAudioUpdate: (audio) => {
          setAudioPreview(audio);
        },
        onTranscriptionUpdate: (text) => {
          setTranscriptionPreview(text);
        },
        onThumbnailUpdate: (thumbs) => {
          setThumbnailPreviews(thumbs);
        },
        onTitleUpdate: (newTitles) => {
          setTitlePreviews(newTitles);
        }
      });

      // 2. Update generation record to completed
      if (generationId) {
        const { error: genUpdateError } = await supabase
          .from("generations")
          .update({
            status: "completed",
            prompt: result.prompt || "",
            image_url: result.thumbnails[0] || null, // Use first thumbnail as preview in history
            completed_at: new Date().toISOString(),
          })
          .eq("id", generationId);

        if (genUpdateError) {
          console.warn("Could not update generation record:", genUpdateError);
        }
      }

      setThumbnails(result.thumbnails);
      setTitles(result.titles);
      setTranscription(result.transcription);
      setPrompt(result.prompt || "");
      setAppState("results");
    } catch (error) {
      console.error("Processing error:", error);
      
      // 3. Mark generation as failed
      if (generationId) {
        await supabase
          .from("generations")
          .update({
            status: "failed",
            error_message: error instanceof Error ? error.message : "Error processing video",
            completed_at: new Date().toISOString(),
          })
          .eq("id", generationId);
      }

      toast.error(error instanceof Error ? error.message : t("quickCreate.errors.errorProcessing"));
      setAppState("input");
    }
    } finally {
      submitInFlightRef.current = false;
    }
  };

  const handleReset = () => {
    setAppState("input");
    setProcessingStep(0);
    setProcessingMessage("");
    setThumbnails([]);
    setTitles([]);
    setTranscription("");
    setPrompt("");
    setTranscriptionPreview("");
    setThumbnailPreviews([]);
    setTitlePreviews([]);
    setFramesPreviews([]);
    setAudioPreview(null);
  };

  const handleSave = async (index?: number) => {
    const thumbnailsToSave = typeof index === "number" ? [thumbnails[index]] : thumbnails;
    
    if (thumbnailsToSave.length === 0) {
      toast.error(t("quickCreate.errors.noThumbnailsToSave"));
      return;
    }

    setIsSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No user found");

      // Upload data URLs to storage and get public URLs
      const uploadedUrls = await Promise.all(
        thumbnailsToSave.map(async (url, idx) => {
          if (isDataUrl(url)) {
            const currentIdx = typeof index === "number" ? index + 1 : idx + 1;
            const total = thumbnailsToSave.length;
            console.log(`Uploading thumbnail ${currentIdx}/${total}...`);
            return await uploadDataUrlToStorage(url, supabase, user.id);
          }
          return url;
        })
      );

      // Save each thumbnail to the thumbnails table
      const insertPromises = uploadedUrls.map((image_url) => {
        return supabase.from("thumbnails").insert({
          user_id: user.id,
          image_url,
          title: "",
          subtitle: "",
          text_position: "",
          text_style: "",
          visual_style: "Quick Create",
          background_type: "",
          background_value: "",
          aspect_ratio: "16:9",
        });
      });

      const results = await Promise.all(insertPromises);
      const anyError = results.find((r) => r.error);
      if (anyError?.error) {
        throw anyError.error;
      }

      toast.success(
        thumbnailsToSave.length === 1 
          ? t("quickCreate.success.thumbnailSaved")
          : t("quickCreate.success.thumbnailsSaved", { count: thumbnails.length })
      );
    } catch (e) {
      console.error("Error saving thumbnails:", e);
      toast.error(t("quickCreate.errors.errorSaving"));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Visual background elements */}
      <div className="absolute inset-0 bg-fine-grid opacity-20 pointer-events-none" />
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/10 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-primary/5 blur-[120px] rounded-full pointer-events-none" />
      
      <main className="relative pt-8 pb-16 px-6">
        <AnimatePresence mode="wait">
          {appState === "input" && (
            <motion.div
              key="input"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, y: -20 }}
              className="min-h-[calc(100vh-10rem)] flex flex-col items-center justify-center relative"
            >
              {/* Hero */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-center mb-12 max-w-4xl mx-auto"
              >
                <motion.div 
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.1 }}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary mb-8 border border-primary/20 backdrop-blur-sm"
                >
                  <Sparkles className="w-4 h-4" />
                  <span className="text-sm font-medium tracking-wide uppercase">{t("quickCreate.badge")}</span>
                </motion.div>
                
                <h1 className="text-5xl sm:text-7xl lg:text-8xl font-bold text-foreground mb-8 tracking-tighter leading-[0.9] flex flex-col items-center">
                  <motion.span
                    initial={{ x: -20, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    transition={{ duration: 0.7, ease: "easeOut" }}
                    className="hero-font-primary"
                  >
                    {t("quickCreate.heroTitle")}
                  </motion.span>
                  <motion.span
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ duration: 0.5, delay: 0.3 }}
                    className="text-primary hero-font-secondary italic my-2 text-4xl sm:text-6xl"
                  >
                    {t("quickCreate.heroAnd")}
                  </motion.span>
                  <motion.span
                    initial={{ x: 20, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    transition={{ duration: 0.7, ease: "easeOut" }}
                    className="hero-font-primary"
                  >
                    {t("quickCreate.heroTitles")}
                  </motion.span>
                  
                  <div className="mt-6 text-muted-foreground hero-font-primary text-3xl sm:text-5xl font-medium tracking-tight h-[1.2em]">
                    <TypewriterText texts={[
                      t("quickCreate.typewriterTexts.inSeconds"),
                      t("quickCreate.typewriterTexts.effortlessly"),
                      t("quickCreate.typewriterTexts.withAI")
                    ]} />
                  </div>
                </h1>
                
                <motion.p 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.8 }}
                  className="text-xl text-muted-foreground max-w-xl mx-auto font-light leading-relaxed mb-12"
                >
                  {t("quickCreate.description")}
                </motion.p>
              </motion.div>

              <VideoInput onSubmit={handleSubmit} isLoading={appState === "processing"} />

              {/* Features */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="mt-16 flex flex-wrap items-center justify-center gap-8 text-sm text-muted-foreground"
              >
                {[
                  t("quickCreate.features.analyzeContent"),
                  t("quickCreate.features.fourThumbnails"),
                  t("quickCreate.features.optimizedTitles"),
                ].map((feature) => (
                  <div key={feature} className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground" />
                    <span>{feature}</span>
                  </div>
                ))}
              </motion.div>
            </motion.div>
          )}

          {appState === "processing" && (
            <motion.div
              key="processing"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, y: -20 }}
              className="min-h-[calc(100vh-10rem)] flex gap-6 relative z-10"
            >
              {/* Main processing state */}
              <div className="flex-1 flex items-center justify-center">
                <ProcessingState currentStep={processingStep} message={processingMessage} />
              </div>
              
              {/* Side panel with previews */}
              <ProcessingPanel
                currentStep={processingStep}
                transcriptionPreview={transcriptionPreview}
                thumbnailPreviews={thumbnailPreviews}
                titlePreviews={titlePreviews}
                framesPreviews={framesPreviews}
                audioPreview={audioPreview}
              />
            </motion.div>
          )}

          {appState === "results" && (
            <motion.div
              key="results"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="relative z-10"
            >
              <ResultsView
                thumbnails={thumbnails}
                titles={titles}
                transcription={transcription}
                onReset={handleReset}
                onSave={handleSave}
                isSaving={isSaving}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
};

export default QuickCreate;

