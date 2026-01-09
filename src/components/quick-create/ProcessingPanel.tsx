import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FileText, Image, Sparkles, Film, Music, Play, Pause, Volume2 } from "lucide-react";

interface ProcessingPanelProps {
  currentStep: number;
  transcriptionPreview: string;
  thumbnailPreviews: string[];
  framesPreviews: string[];
  audioPreview: string | null;
}

export function ProcessingPanel({
  currentStep,
  transcriptionPreview,
  thumbnailPreviews,
  framesPreviews,
  audioPreview,
}: ProcessingPanelProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const toggleAudioPlayback = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
    }
  };

  useEffect(() => {
    if (audioPreview && audioRef.current) {
      audioRef.current.src = audioPreview;
    }
  }, [audioPreview]);

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="w-full max-w-3xl mx-auto bg-card/50 backdrop-blur-md border border-border rounded-2xl shadow-xl overflow-hidden flex flex-col"
    >
      <div className="p-4 border-b border-border flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-foreground flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" />
            Real-time preview
          </h3>
          <p className="text-xs text-muted-foreground mt-1">
            Processing progress
          </p>
        </div>
      </div>

      <div className="p-4 space-y-6">
        {/* Step 0: Extracting frames */}
        <AnimatePresence>
          {currentStep >= 0 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-3"
            >
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <Film className="w-4 h-4" />
                <span>Extracted frames</span>
              </div>
              
              {/* Frame previews grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 w-full">
                {[0, 1, 2, 3, 4, 5].map((i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ 
                      opacity: framesPreviews[i] ? 1 : currentStep === 0 ? 0.5 : 0.3,
                      scale: 1
                    }}
                    transition={{ delay: i * 0.1 }}
                    className="aspect-video rounded overflow-hidden bg-muted border border-border"
                  >
                    {framesPreviews[i] ? (
                      <img
                        src={framesPreviews[i]}
                        alt={`Frame ${i + 1}`}
                        className="w-full h-full object-cover"
                      />
                    ) : currentStep === 0 ? (
                      <div className="w-full h-full flex items-center justify-center bg-muted/80">
                        <motion.div
                          animate={{ opacity: [0.3, 0.7, 0.3] }}
                          transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.15 }}
                          className="w-full h-full bg-gradient-to-r from-muted via-muted-foreground/10 to-muted"
                        />
                      </div>
                    ) : (
                      <div className="w-full h-full bg-muted/50" />
                    )}
                  </motion.div>
                ))}
              </div>
              
              {currentStep > 0 && framesPreviews.length > 0 && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-xs text-muted-foreground"
                >
                  {framesPreviews.length} frames selected
                </motion.p>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Step 0.5: Extract audio - FULL WIDTH */}
        <AnimatePresence>
          {currentStep >= 0 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="space-y-3"
            >
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <Music className="w-4 h-4" />
                <span>Audio track</span>
              </div>
              
              {audioPreview ? (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="p-3 bg-muted/50 rounded-lg border border-border w-full min-w-0"
                >
                  <div className="flex items-center gap-3">
                    <button
                      onClick={toggleAudioPlayback}
                      className="w-10 h-10 rounded-full bg-primary flex items-center justify-center hover:bg-primary/90 transition-colors shrink-0"
                    >
                      {isPlaying ? (
                        <Pause className="w-4 h-4 text-primary-foreground" />
                      ) : (
                        <Play className="w-4 h-4 text-primary-foreground ml-0.5" />
                      )}
                    </button>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <Volume2 className="w-3 h-3 text-muted-foreground shrink-0" />
                        <div className="flex-1 h-1.5 bg-muted-foreground/20 rounded-full overflow-hidden">
                          <motion.div
                            className="h-full bg-primary"
                            initial={{ width: "0%" }}
                            animate={{ width: `${progress}%` }}
                            transition={{ type: "spring", bounce: 0, duration: 0.1 }}
                          />
                        </div>
                      </div>
                      <div className="flex justify-between items-center mt-1">
                        <p className="text-[10px] text-muted-foreground truncate">
                          Audio ready for transcription
                        </p>
                        <p className="text-[10px] text-muted-foreground font-mono">
                          {currentTime.toFixed(1)}s / {duration.toFixed(1)}s
                        </p>
                      </div>
                    </div>
                  </div>
                  <audio
                    ref={audioRef}
                    onTimeUpdate={handleTimeUpdate}
                    onLoadedMetadata={handleLoadedMetadata}
                    onEnded={() => setIsPlaying(false)}
                    className="hidden"
                    preload="metadata"
                  />
                </motion.div>
              ) : currentStep === 0 ? (
                <div className="p-3 bg-muted/30 rounded-lg border border-border">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center shrink-0">
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                        className="w-4 h-4 border-2 border-muted-foreground/30 border-t-muted-foreground rounded-full"
                      />
                    </div>
                    <div className="flex-1">
                      <div className="h-1 bg-muted rounded-full overflow-hidden">
                        <motion.div
                          className="h-full bg-muted-foreground/30"
                          animate={{ x: ["-100%", "100%"] }}
                          transition={{ duration: 1.5, repeat: Infinity }}
                        />
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-1">
                        Extracting audio track...
                      </p>
                    </div>
                  </div>
                </div>
              ) : null}
            </motion.div>
          )}
        </AnimatePresence>

        {/* The rest of the content (transcription, etc.) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-6">
            {/* Step 1: Transcription */}
            <AnimatePresence>
              {currentStep >= 1 && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-2"
                >
                  <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                    <FileText className="w-4 h-4" />
                    <span>Transcription</span>
                  </div>
                  
                  {transcriptionPreview ? (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="p-3 bg-muted/50 rounded-lg border border-border w-full min-w-0"
                    >
                      <p className="text-xs text-foreground leading-relaxed line-clamp-4">
                        {transcriptionPreview}
                      </p>
                      {transcriptionPreview.length > 300 && (
                        <p className="text-[10px] text-muted-foreground mt-2">
                          ...and more
                        </p>
                      )}
                    </motion.div>
                  ) : currentStep === 1 ? (
                    <div className="space-y-1.5">
                      <motion.div 
                        animate={{ opacity: [0.4, 0.7, 0.4] }}
                        transition={{ duration: 1.5, repeat: Infinity }}
                        className="h-2 bg-muted rounded" 
                      />
                      <motion.div 
                        animate={{ opacity: [0.4, 0.7, 0.4] }}
                        transition={{ duration: 1.5, repeat: Infinity, delay: 0.2 }}
                        className="h-2 bg-muted rounded w-3/4" 
                      />
                    </div>
                  ) : null}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="space-y-6">
            {/* Step 2: Thumbnails & Titles */}
            <AnimatePresence>
              {currentStep >= 2 && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-3"
                >
                  <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                    <Image className="w-4 h-4" />
                    <span>Generated thumbnails</span>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2 w-full">
                    {[0, 1, 2, 3].map((i) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: i * 0.2 }}
                        className="aspect-video rounded-lg overflow-hidden bg-muted border border-border w-full"
                      >
                        {thumbnailPreviews[i] ? (
                          <img
                            src={thumbnailPreviews[i]}
                            alt={`Thumbnail ${i + 1}`}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full relative bg-muted/30 overflow-hidden">
                            <motion.div
                              className="absolute inset-y-0 left-0 bg-primary/10"
                              initial={{ width: "0%" }}
                              animate={{ width: "100%" }}
                              transition={{
                                duration: 40,
                                repeat: Infinity,
                                ease: "easeInOut",
                                delay: i * 0.5
                              }}
                            />
                            <div className="absolute inset-0 flex items-center justify-center">
                              <Sparkles className="w-4 h-4 text-primary/30 animate-pulse" />
                            </div>
                            <motion.div 
                              className="absolute top-0 bottom-0 w-1 bg-primary/20 blur-[2px]"
                              initial={{ left: "0%" }}
                              animate={{ left: "100%" }}
                              transition={{
                                duration: 40,
                                repeat: Infinity,
                                ease: "easeInOut",
                                delay: i * 0.5
                              }}
                            />
                          </div>
                        )}
                      </motion.div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}
