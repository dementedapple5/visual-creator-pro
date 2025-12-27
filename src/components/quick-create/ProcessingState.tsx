import { motion } from "framer-motion";
import { Film, FileText, Wand2, Grid3X3 } from "lucide-react";

const steps = [
  { icon: Film, label: "Analyzing video", description: "Extracting key frames" },
  { icon: FileText, label: "Transcribing", description: "Processing audio" },
  { icon: Grid3X3, label: "Creating thumbnails", description: "Designing visuals" },
];

interface ProcessingStateProps {
  currentStep: number;
  message?: string;
}

export function ProcessingState({ currentStep, message }: ProcessingStateProps) {
  return (
    <div className="w-full max-w-xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-12"
      >
        <h2 className="text-2xl font-semibold text-foreground mb-2">
          Processing your video
        </h2>
        <p className="text-muted-foreground">
          This usually takes less than a minute
        </p>
      </motion.div>

      <div className="space-y-4">
        {steps.map((step, index) => {
          const isActive = index === currentStep;
          const isComplete = index < currentStep;
          const isPending = index > currentStep;

          return (
            <motion.div
              key={step.label}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
              className={`
                relative flex items-center gap-4 p-4 rounded-xl
                transition-all duration-300
                ${isActive ? "bg-secondary" : ""}
              `}
            >
              {/* Icon */}
              <div
                className={`
                  w-12 h-12 rounded-xl flex items-center justify-center
                  transition-all duration-300
                  ${isComplete ? "bg-primary" : isActive ? "bg-muted" : "bg-muted/50"}
                `}
              >
                {isActive ? (
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                  >
                    <step.icon
                      className={`w-5 h-5 ${isComplete ? "text-primary-foreground" : "text-foreground"}`}
                    />
                  </motion.div>
                ) : (
                  <step.icon
                    className={`w-5 h-5 ${
                      isComplete ? "text-primary-foreground" : isPending ? "text-muted-foreground" : "text-foreground"
                    }`}
                  />
                )}
              </div>

              {/* Text */}
              <div className="flex-1">
                <p
                  className={`
                    font-medium transition-colors duration-300
                    ${isComplete || isActive ? "text-foreground" : "text-muted-foreground"}
                  `}
                >
                  {step.label}
                </p>
                <p className="text-sm text-muted-foreground">{step.description}</p>
              </div>

              {/* Status */}
              <div className="flex items-center">
                {isComplete && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="w-6 h-6 rounded-full bg-primary flex items-center justify-center"
                  >
                    <svg
                      className="w-3.5 h-3.5 text-primary-foreground"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={3}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </motion.div>
                )}
                {isActive && (
                  <div className="flex gap-1">
                    {[0, 1, 2].map((i) => (
                      <motion.div
                        key={i}
                        animate={{ opacity: [0.3, 1, 0.3] }}
                        transition={{
                          duration: 1,
                          repeat: Infinity,
                          delay: i * 0.2,
                        }}
                        className="w-1.5 h-1.5 rounded-full bg-foreground"
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* Connecting line */}
              {index < steps.length - 1 && (
                <div
                  className={`
                    absolute left-[2.25rem] top-16 w-0.5 h-4
                    transition-colors duration-300
                    ${isComplete ? "bg-primary" : "bg-border"}
                  `}
                />
              )}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

