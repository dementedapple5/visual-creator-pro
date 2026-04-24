import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Upload, X, Link2, ChevronDown, ChevronUp, Image as ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";
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
  const [inputMode, setInputMode] = useState<"file" | "url">("file");
  const [file, setFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState("");
  const [styleReferences, setStyleReferences] = useState<string[]>([]);
  const [isReferencesOpen, setIsReferencesOpen] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isValidHttpUrl = (value: string) => {
    try {
      const parsed = new URL(value.trim());
      return parsed.protocol === "http:" || parsed.protocol === "https:";
    } catch {
      return false;
    }
  };

  const handleSubmit = () => {
    if (inputMode === "file" && file) {
      onSubmit({ 
        type: "file", 
        value: file,
        styleReferences: styleReferences.length > 0 ? styleReferences : undefined
      });
      return;
    }

    if (inputMode === "url" && isValidHttpUrl(videoUrl)) {
      onSubmit({
        type: "url",
        value: videoUrl.trim(),
        styleReferences: styleReferences.length > 0 ? styleReferences : undefined,
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
        setInputMode("file");
        setFile(droppedFile);
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setInputMode("file");
      setFile(e.target.files[0]);
    }
  };

  const clearFile = () => {
    setFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const canSubmit = inputMode === "file" ? !!file : isValidHttpUrl(videoUrl);

  return (
    <div className="w-full max-w-2xl mx-auto space-y-6">
      <div className="p-1 rounded-lg bg-secondary/30 border border-border grid grid-cols-2 gap-1">
        <button
          type="button"
          disabled={isLoading}
          onClick={() => setInputMode("file")}
          className={cn(
            "h-10 rounded-md text-sm font-medium transition-colors",
            inputMode === "file"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {t("quickCreate.input.uploadFile")}
        </button>
        <button
          type="button"
          disabled={isLoading}
          onClick={() => setInputMode("url")}
          className={cn(
            "h-10 rounded-md text-sm font-medium transition-colors",
            inputMode === "url"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {t("quickCreate.input.videoUrl")}
        </button>
      </div>

      {/* Video source input */}
      <AnimatePresence mode="wait">
        {inputMode === "file" ? (
          file ? (
            <motion.div
              key="file-selected"
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
              key="file-dropzone"
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
                  {t("quickCreate.input.dropVideo")}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {t("quickCreate.input.clickToSelect")}
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
          )
        ) : (
          <motion.div
            key="url-input"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-3 p-4 rounded-lg bg-secondary border border-border"
          >
            <div className="flex items-center gap-2 text-muted-foreground">
              <Link2 className="w-4 h-4" />
              <span className="text-sm">{t("quickCreate.input.publicVideoUrl")}</span>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="url"
                value={videoUrl}
                onChange={(e) => setVideoUrl(e.target.value)}
                placeholder={t("quickCreate.input.videoUrlPlaceholder")}
                disabled={isLoading}
                className={cn(
                  "flex-1 h-11 px-3 rounded-md border bg-background text-sm",
                  "focus:outline-none focus:ring-2 focus:ring-primary/40",
                  "disabled:opacity-50"
                )}
              />
              {videoUrl && (
                <button
                  type="button"
                  onClick={() => setVideoUrl("")}
                  disabled={isLoading}
                  className="p-2 rounded-lg hover:bg-muted transition-colors disabled:opacity-50"
                >
                  <X className="w-4 h-4 text-muted-foreground" />
                </button>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {t("quickCreate.input.videoUrlHint")}
            </p>
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
            {t("quickCreate.input.processing")}
          </span>
        ) : (
          t("quickCreate.input.generate")
        )}
      </motion.button>
    </div>
  );
}
