import { useState } from "react";
import { motion } from "framer-motion";
import { Download, Check, Save, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface ThumbnailCardProps {
  src: string;
  index: number;
  onDownload: () => void;
  onSave?: () => void;
  isSaving?: boolean;
}

export function ThumbnailCard({ src, index, onDownload, onSave, isSaving }: ThumbnailCardProps) {
  const [isDownloading, setIsDownloading] = useState(false);
  const [localSaving, setLocalSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(false);

  const handleDownload = async () => {
    onDownload();
    setIsDownloading(true);
    setTimeout(() => {
      setIsDownloading(false);
    }, 2000);
  };

  const handleSave = async () => {
    if (!onSave || isSaved) return;
    setLocalSaving(true);
    try {
      await onSave();
      setIsSaved(true);
    } catch (error) {
      console.error("Error saving individually:", error);
    } finally {
      setLocalSaving(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
      className="group relative aspect-video rounded-xl overflow-hidden bg-muted shadow-md hover:shadow-xl transition-all duration-300"
    >
      <img
        src={src}
        alt={`Thumbnail option ${index + 1}`}
        className="w-full h-full object-cover"
      />
      
      {/* Overlay */}
      <div className="absolute inset-0 bg-foreground/0 group-hover:bg-foreground/60 transition-all duration-300 flex flex-col items-center justify-center gap-3">
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={handleDownload}
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-lg w-32 justify-center",
            "bg-background text-foreground font-medium text-sm",
            "opacity-0 group-hover:opacity-100 transition-opacity duration-300",
            "shadow-lg"
          )}
        >
          {isDownloading ? (
            <>
              <Check className="w-4 h-4" />
              <span>Done</span>
            </>
          ) : (
            <>
              <Download className="w-4 h-4" />
              <span>Download</span>
            </>
          )}
        </motion.button>

        {onSave && (
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleSave}
            disabled={localSaving || isSaved}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-lg w-32 justify-center",
              "bg-primary text-primary-foreground font-medium text-sm",
              "opacity-0 group-hover:opacity-100 transition-opacity duration-300",
              "shadow-lg disabled:opacity-50"
            )}
          >
            {localSaving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : isSaved ? (
              <>
                <Check className="w-4 h-4" />
                <span>Saved</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>Save</span>
              </>
            )}
          </motion.button>
        )}
      </div>

      {/* Number badge */}
      <div className="absolute top-3 left-3 w-7 h-7 rounded-lg bg-background/90 backdrop-blur-sm flex items-center justify-center text-sm font-medium text-foreground shadow-sm">
        {index + 1}
      </div>
    </motion.div>
  );
}

