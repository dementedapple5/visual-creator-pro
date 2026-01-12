import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Upload, X, Zap, ChevronDown, ChevronUp, Image as ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { ReferenceUpload } from "./ReferenceUpload";
import { useTranslation } from "react-i18next";

interface VideoInputProps {
  onSubmit: (input: { 
    type: "url" | "file"; 
    value: string | File;
    styleReferences?: string[];
  }) => void;
  isLoading?: boolean;
}

export function VideoInput({ onSubmit, isLoading }: VideoInputProps) {
  const { t } = useTranslation();
  const [file, setFile] = useState<File | null>(null);
  const [styleReferences, setStyleReferences] = useState<string[]>([]);
  const [isReferencesOpen, setIsReferencesOpen] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = () => {
    if (file) {
      onSubmit({ 
        type: "file", 
        value: file,
        styleReferences: styleReferences.length > 0 ? styleReferences : undefined
      });
    }
  };

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
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile.type.startsWith("video/")) {
        setFile(droppedFile);
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const clearFile = () => {
    setFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const canSubmit = !!file;

  return (
    <div className="w-full max-w-2xl mx-auto space-y-6">
      {/* File Upload */}
      <AnimatePresence mode="wait">
        {file ? (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex items-center gap-3 p-4 rounded-lg bg-secondary border border-border"
          >
            <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
              <Upload className="w-5 h-5 text-muted-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">{file.name}</p>
              <p className="text-xs text-muted-foreground">
                {(file.size / (1024 * 1024)).toFixed(2)} MB
              </p>
            </div>
            <button
              onClick={clearFile}
              disabled={isLoading}
              className="p-2 rounded-lg hover:bg-muted transition-colors disabled:opacity-50"
            >
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={cn(
              "relative flex flex-col items-center justify-center gap-3 p-8",
              "rounded-lg border-2 border-dashed cursor-pointer",
              "transition-all duration-200",
              dragActive
                ? "border-foreground bg-muted/50"
                : "border-border hover:border-muted-foreground hover:bg-secondary/50"
            )}
          >
            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
              <Upload className="w-5 h-5 text-muted-foreground" />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-foreground">
                Drop your video here
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                or click to select
              </p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="video/*"
              onChange={handleFileChange}
              className="hidden"
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Style References (Optional) */}
      <div className="border border-border rounded-lg bg-secondary/30 overflow-hidden">
        <button
          onClick={() => setIsReferencesOpen(!isReferencesOpen)}
          className="w-full flex items-center justify-between p-4 hover:bg-secondary/50 transition-colors"
        >
          <div className="flex items-center gap-2">
            <ImageIcon className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium text-foreground">
              {t("quickCreate.references.title")}
            </span>
            {styleReferences.length > 0 && (
              <span className="ml-2 px-2 py-0.5 rounded-full bg-primary/20 text-primary text-[10px] font-bold uppercase tracking-wider">
                {styleReferences.length}
              </span>
            )}
          </div>
          {isReferencesOpen ? (
            <ChevronUp className="w-4 h-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          )}
        </button>
        
        <AnimatePresence>
          {isReferencesOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="px-4 pb-4 overflow-hidden"
            >
              <ReferenceUpload onReferencesChange={setStyleReferences} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Submit Button */}
      <motion.button
        whileHover={{ scale: canSubmit && !isLoading ? 1.01 : 1 }}
        whileTap={{ scale: canSubmit && !isLoading ? 0.99 : 1 }}
        onClick={handleSubmit}
        disabled={!canSubmit || isLoading}
        className={cn(
          "w-full h-14 rounded-lg font-medium text-base",
          "transition-all duration-200",
          canSubmit && !isLoading
            ? "bg-primary text-primary-foreground hover:opacity-90 shadow-lg"
            : "bg-muted text-muted-foreground cursor-not-allowed"
        )}
      >
        {isLoading ? (
          <span className="flex items-center justify-center gap-2">
            <motion.span
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
              className="w-5 h-5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full"
            />
            Processing...
          </span>
        ) : (
          "Generate thumbnails and titles"
        )}
      </motion.button>
    </div>
  );
}

