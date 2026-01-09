import { motion } from "framer-motion";
import { Plus, Camera, Check } from "lucide-react";
import { Button } from "@/components/ui/button";

interface FrameSelectorProps {
  frames: string[];
  onFrameClick: (index: number) => void;
  onContinue: () => void;
}

export function FrameSelector({ frames, onFrameClick, onContinue }: FrameSelectorProps) {
  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h3 className="text-xl font-semibold text-foreground">
          Selecciona los frames para tus thumbnails
        </h3>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">
          Hemos seleccionado estos momentos automáticamente. Haz clic en cualquiera para cambiarlo por otro momento del video.
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-w-4xl mx-auto">
        {Array.from({ length: 6 }).map((_, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="group relative aspect-video rounded-xl overflow-hidden bg-muted border border-border hover:border-primary transition-all cursor-pointer"
            onClick={() => onFrameClick(i)}
          >
            {frames[i] ? (
              <>
                <img
                  src={frames[i]}
                  alt={`Frame ${i + 1}`}
                  className="w-full h-full object-cover transition-transform group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <div className="flex flex-col items-center gap-1">
                    <Camera className="w-5 h-5 text-white" />
                    <span className="text-[10px] font-medium text-white uppercase tracking-wider">Cambiar</span>
                  </div>
                </div>
                <div className="absolute top-2 left-2 px-1.5 py-0.5 rounded bg-black/60 backdrop-blur-md text-[10px] font-bold text-white">
                  {i + 1}
                </div>
              </>
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Plus className="w-6 h-6 text-muted-foreground" />
              </div>
            )}
          </motion.div>
        ))}
      </div>

      <div className="flex justify-center pt-4">
        <Button 
          size="lg" 
          onClick={onContinue} 
          className="rounded-full px-8 gap-2 bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/20"
        >
          <Check className="w-5 h-5" />
          Continuar con estos frames
        </Button>
      </div>
    </div>
  );
}
