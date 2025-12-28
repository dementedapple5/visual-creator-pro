import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { motion, useInView } from "framer-motion";

const QuickCreateScroll = () => {
  const { t } = useTranslation();
  const [activeStep, setActiveStep] = useState(0);

  const steps = [
    {
      image: "/examples/quick_create/quick_create_1.png",
      title: t("landing.quickCreateScroll.step1.title"),
      subtitle: t("landing.quickCreateScroll.step1.subtitle")
    },
    {
      image: "/examples/quick_create/quick_create_2.png",
      title: t("landing.quickCreateScroll.step2.title"),
      subtitle: t("landing.quickCreateScroll.step2.subtitle")
    },
    {
      image: "/examples/quick_create/quick_create_3.png",
      title: t("landing.quickCreateScroll.step3.title"),
      subtitle: t("landing.quickCreateScroll.step3.subtitle")
    }
  ];

  return (
    <section className="relative py-16 md:py-20 overflow-hidden">
      {steps.map((step, index) => {
        const stepRef = useRef<HTMLDivElement>(null);
        const isInView = useInView(stepRef, { 
          amount: 0.5,
          once: false
        });

        useEffect(() => {
          if (isInView) {
            setActiveStep(index);
          }
        }, [isInView, index]);

        return (
          <div
            key={index}
            ref={stepRef}
            className="relative h-screen flex flex-col items-center justify-center snap-start"
          >
            {/* Content container */}
            <div className="relative w-full flex-1 flex flex-col items-center justify-center px-6 py-20 gap-8">
              {/* Image container */}
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={isInView ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                className="relative w-full max-w-6xl mx-auto flex-shrink-0"
              >
                <div className="relative">
                  <motion.img
                    src={step.image}
                    alt={`Quick Create Step ${index + 1}`}
                    className="w-full h-auto rounded-2xl shadow-2xl border border-border/50"
                    style={{
                      filter: "drop-shadow(0 25px 50px -12px rgba(0, 0, 0, 0.25))"
                    }}
                  />
                  {/* Glow effect */}
                  <motion.div 
                    className="absolute inset-0 -z-10 bg-primary/10 blur-3xl rounded-2xl"
                    initial={{ opacity: 0 }}
                    animate={isInView ? { opacity: 0.5 } : { opacity: 0 }}
                    transition={{ duration: 1, delay: 0.3 }}
                  />
                </div>
              </motion.div>

              {/* Text content - appears after image is visible */}
              <motion.div
                initial={{ opacity: 0, y: 40 }}
                animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 40 }}
                transition={{ duration: 0.8, delay: 0.4, ease: [0.16, 1, 0.3, 1] }}
                className="w-full max-w-4xl mx-auto text-center flex-shrink-0"
              >
                <div className="space-y-4">
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={isInView ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.9 }}
                    transition={{ duration: 0.5, delay: 0.6 }}
                    className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4 border border-primary/20 backdrop-blur-sm"
                  >
                    <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                    Step {index + 1} of {steps.length}
                  </motion.div>
                  <motion.h3
                    initial={{ opacity: 0, y: 20 }}
                    animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
                    transition={{ duration: 0.6, delay: 0.7 }}
                    className="text-3xl md:text-5xl lg:text-6xl font-bold text-foreground mb-4"
                  >
                    {step.title}
                  </motion.h3>
                  <motion.p
                    initial={{ opacity: 0, y: 20 }}
                    animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
                    transition={{ duration: 0.6, delay: 0.8 }}
                    className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed"
                  >
                    {step.subtitle}
                  </motion.p>
                </div>
              </motion.div>
            </div>
          </div>
        );
      })}
    </section>
  );
};

export default QuickCreateScroll;
