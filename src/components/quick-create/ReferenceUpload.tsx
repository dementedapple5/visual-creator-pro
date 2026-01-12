import { useState, useRef, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Upload, X, Image as ImageIcon, Plus } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface ReferenceUploadProps {
  onReferencesChange: (references: string[]) => void;
  maxReferences?: number;
}

export function ReferenceUpload({ onReferencesChange, maxReferences = 6 }: ReferenceUploadProps) {
  const { t } = useTranslation();
  const [references, setReferences] = useState<string[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback((files: FileList) => {
    const newRefs = [...references];
    const remainingSlots = maxReferences - newRefs.length;
    
    if (remainingSlots <= 0) {
      toast.error(t("quickCreate.references.limitReached", { count: maxReferences }));
      return;
    }

    const filesArray = Array.from(files).slice(0, remainingSlots);
    
    filesArray.forEach(file => {
      if (!file.type.startsWith("image/")) {
        toast.error(t("quickCreate.errors.invalidFileType"));
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target?.result as string;
        if (dataUrl) {
          setReferences(prev => {
            const updated = [...prev, dataUrl];
            onReferencesChange(updated);
            return updated;
          });
        }
      };
      reader.readAsDataURL(file);
    });
  }, [references, maxReferences, onReferencesChange, t]);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFiles(e.target.files);
    }
  };

  const handlePaste = useCallback((e: ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    const files: File[] = [];
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf("image") !== -1) {
        const file = items[i].getAsFile();
        if (file) files.push(file);
      }
    }

    if (files.length > 0) {
      const dataTransfer = new DataTransfer();
      files.forEach(file => dataTransfer.items.add(file));
      handleFiles(dataTransfer.files);
    }
  }, [handleFiles]);

  useEffect(() => {
    window.addEventListener("paste", handlePaste);
    return () => {
      window.removeEventListener("paste", handlePaste);
    };
  }, [handlePaste]);

  const removeReference = (index: number) => {
    setReferences(prev => {
      const updated = prev.filter((_, i) => i !== index);
      onReferencesChange(updated);
      return updated;
    });
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <AnimatePresence mode="popLayout">
          {references.map((ref, index) => (
            <motion.div
              key={ref}
              layout
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="relative aspect-video rounded-lg overflow-hidden border border-border group"
            >
              <img src={ref} alt={`Reference ${index + 1}`} className="w-full h-full object-cover" />
              <button
                onClick={() => removeReference(index)}
                className="absolute top-1 right-1 p-1.5 rounded-full bg-background/80 text-foreground opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-sm"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </motion.div>
          ))}
          
          {references.length < maxReferences && (
            <motion.div
              layout
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={cn(
                "relative aspect-video flex flex-col items-center justify-center gap-2 my-[16px]",
                "rounded-lg border-2 border-dashed cursor-pointer transition-all duration-200",
                dragActive
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-muted-foreground hover:bg-secondary/50"
              )}
            >
              <Plus className="w-6 h-6 text-muted-foreground" />
              <span className="text-xs text-muted-foreground font-medium text-center px-2">
                {t("quickCreate.references.dropHint")}
              </span>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={handleFileChange}
                className="hidden"
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      
      {references.length === 0 && (
        <p className="text-xs text-muted-foreground text-center">
          {t("quickCreate.references.description")}
        </p>
      )}
    </div>
  );
}
