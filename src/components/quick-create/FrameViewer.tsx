import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ChevronLeft, ChevronRight } from "lucide-react";

interface FrameViewerProps {
  frames: string[];
  initialIndex: number;
  isOpen: boolean;
  onClose: () => void;
}

export function FrameViewer({ frames, initialIndex, isOpen, onClose }: FrameViewerProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);

  useEffect(() => {
    setCurrentIndex(initialIndex);
  }, [initialIndex]);

  const goToPrevious = () => {
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : frames.length - 1));
  };

  const goToNext = () => {
    setCurrentIndex((prev) => (prev < frames.length - 1 ? prev + 1 : 0));
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-background/90 backdrop-blur-sm"
        onClick={onClose}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full bg-muted hover:bg-muted/80 transition-colors"
        >
          <X className="w-6 h-6 text-foreground" />
        </button>

        {/* Frame counter */}
        <div className="absolute top-4 left-1/2 -translate-x-1/2 px-4 py-2 rounded-full bg-muted text-sm font-medium text-foreground">
          Frame {currentIndex + 1} de {frames.length}
        </div>

        {/* Navigation buttons */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            goToPrevious();
          }}
          className="absolute left-4 p-3 rounded-full bg-muted hover:bg-muted/80 transition-colors"
        >
          <ChevronLeft className="w-6 h-6 text-foreground" />
        </button>

        <button
          onClick={(e) => {
            e.stopPropagation();
            goToNext();
          }}
          className="absolute right-4 p-3 rounded-full bg-muted hover:bg-muted/80 transition-colors"
        >
          <ChevronRight className="w-6 h-6 text-foreground" />
        </button>

        {/* Main image */}
        <motion.div
          key={currentIndex}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          transition={{ duration: 0.2 }}
          className="max-w-4xl max-h-[80vh] mx-4"
          onClick={(e) => e.stopPropagation()}
        >
          <img
            src={frames[currentIndex]}
            alt={`Frame ${currentIndex + 1}`}
            className="w-full h-full object-contain rounded-lg shadow-2xl"
          />
        </motion.div>

        {/* Thumbnail strip */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 p-2 rounded-xl bg-muted/80 backdrop-blur-sm">
          {frames.map((frame, i) => (
            <button
              key={i}
              onClick={(e) => {
                e.stopPropagation();
                setCurrentIndex(i);
              }}
              className={`w-16 h-9 rounded overflow-hidden border-2 transition-all ${
                i === currentIndex
                  ? "border-primary scale-110"
                  : "border-transparent opacity-60 hover:opacity-100"
              }`}
            >
              <img
                src={frame}
                alt={`Thumbnail ${i + 1}`}
                className="w-full h-full object-cover"
              />
            </button>
          ))}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

