import { useState, useRef, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Play, Pause, Camera, X } from "lucide-react";

interface FrameReplacerModalProps {
  isOpen: boolean;
  onClose: () => void;
  videoFile: File | null;
  onCapture: (dataUrl: string) => void;
  currentIndex: number;
}

export function FrameReplacerModal({
  isOpen,
  onClose,
  videoFile,
  onCapture,
  currentIndex,
}: FrameReplacerModalProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (videoFile && isOpen) {
      const url = URL.createObjectURL(videoFile);
      setVideoUrl(url);
      return () => URL.revokeObjectURL(url);
    }
  }, [videoFile, isOpen]);

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
    }
  };

  const handleSliderChange = (values: number[]) => {
    const newTime = values[0];
    if (videoRef.current) {
      videoRef.current.currentTime = newTime;
      setCurrentTime(newTime);
    }
  };

  const captureFrame = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");

      if (ctx) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
        onCapture(dataUrl);
        onClose();
      }
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl w-[95vw] h-[90vh] flex flex-col p-0 overflow-hidden bg-background border-border">
        <DialogHeader className="p-4 border-b">
          <DialogTitle>Reemplazar Frame {currentIndex + 1}</DialogTitle>
        </DialogHeader>

        <div className="flex-1 relative bg-black flex items-center justify-center overflow-hidden">
          {videoUrl && (
            <video
              ref={videoRef}
              src={videoUrl}
              className="max-w-full max-h-full"
              onTimeUpdate={handleTimeUpdate}
              onLoadedMetadata={handleLoadedMetadata}
              onEnded={() => setIsPlaying(false)}
              playsInline
            />
          )}
          
          <canvas ref={canvasRef} className="hidden" />
        </div>

        <div className="p-4 space-y-4 bg-card">
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              size="icon"
              onClick={togglePlay}
              className="shrink-0"
            >
              {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
            </Button>

            <div className="flex-1 space-y-1">
              <Slider
                value={[currentTime]}
                max={duration}
                step={0.01}
                onValueChange={handleSliderChange}
                className="w-full"
              />
              <div className="flex justify-between text-[10px] text-muted-foreground font-mono">
                <span>{currentTime.toFixed(2)}s</span>
                <span>{duration.toFixed(2)}s</span>
              </div>
            </div>
          </div>

          <DialogFooter className="flex sm:justify-between items-center gap-4">
            <p className="text-xs text-muted-foreground hidden sm:block">
              Navega por el video y captura el momento exacto que prefieras.
            </p>
            <div className="flex gap-2 w-full sm:w-auto">
              <Button variant="ghost" onClick={onClose} className="flex-1 sm:flex-none">
                Cancelar
              </Button>
              <Button onClick={captureFrame} className="flex-1 sm:flex-none gap-2">
                <Camera className="w-4 h-4" />
                Capturar Frame
              </Button>
            </div>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
