import { useState } from "react";
import { motion } from "framer-motion";
import { Copy, Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface TitleCardProps {
  title: string;
  index: number;
}

export function TitleCard({ title, index }: TitleCardProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(title);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.1 }}
      className="group flex items-center gap-4 p-4 rounded-xl bg-secondary hover:bg-muted transition-all duration-200"
    >
      {/* Number */}
      <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center text-sm font-medium text-muted-foreground shrink-0">
        {index + 1}
      </div>

      {/* Title */}
      <p className="flex-1 text-foreground font-medium text-balance">{title}</p>

      {/* Copy button */}
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={handleCopy}
        className={cn(
          "flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium",
          "transition-all duration-200 shrink-0",
          copied
            ? "bg-primary text-primary-foreground"
            : "bg-muted text-muted-foreground hover:text-foreground hover:bg-border"
        )}
      >
        {copied ? (
          <>
            <Check className="w-3.5 h-3.5" />
            Copied
          </>
        ) : (
          <>
            <Copy className="w-3.5 h-3.5" />
            Copy
          </>
        )}
      </motion.button>
    </motion.div>
  );
}

