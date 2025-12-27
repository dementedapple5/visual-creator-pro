import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Sparkles, Save } from "lucide-react";
import { ThumbnailCard } from "./ThumbnailCard";
import { Button } from "@/components/ui/button";

interface ResultsViewProps {
  thumbnails: string[];
  transcription?: string;
  onReset: () => void;
  onSave?: (index?: number) => void;
  isSaving?: boolean;
}

export function ResultsView({ thumbnails, transcription, onReset, onSave, isSaving }: ResultsViewProps) {
  const handleDownload = (index: number) => {
    const src = thumbnails[index];
    if (!src) return;

    const link = document.createElement("a");
    link.href = src;
    link.download = `thumbnail-${index + 1}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    console.log(`Downloading thumbnail ${index + 1}`);
  };

  return (
    <div className="w-full max-w-5xl mx-auto">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between mb-12"
      >
        <button
          onClick={onReset}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="text-sm font-medium">Start over</span>
        </button>

        <div className="flex items-center gap-4">
          {onSave && (
            <Button
              onClick={() => onSave()}
              disabled={isSaving}
              variant="default"
              className="gap-2"
            >
              <Save className="w-4 h-4" />
              {isSaving ? "Saving..." : "Save all"}
            </Button>
          )}
          <div className="flex items-center gap-2 text-muted-foreground">
            <Sparkles className="w-4 h-4" />
            <span className="text-sm">Generated with AI</span>
          </div>
        </div>
      </motion.div>

      {/* Thumbnails Section */}
      <motion.section
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="mb-16"
      >
        <h2 className="text-xl font-semibold text-foreground mb-6">
          Thumbnails
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {thumbnails.map((src, index) => (
            <ThumbnailCard
              key={index}
              src={src}
              index={index}
              onDownload={() => handleDownload(index)}
              onSave={() => onSave?.(index)}
              isSaving={isSaving}
            />
          ))}
        </div>
      </motion.section>

      {/* Generate Again */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="mt-12 pt-8 border-t border-border text-center"
      >
        <p className="text-sm text-muted-foreground mb-4">
          Not convinced? You can generate again.
        </p>
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={onReset}
          className="px-6 py-3 rounded-xl bg-secondary text-foreground font-medium hover:bg-muted transition-colors"
        >
          Generate new options
        </motion.button>
      </motion.div>
    </div>
  );
}

