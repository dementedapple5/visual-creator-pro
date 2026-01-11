import React, { useState } from "react";
import { ChevronDown } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const FAQ = () => {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const faqs = [
    {
      question: "What is Vizion AI Thumbnail Generator?",
      answer: "Vizion is an advanced AI-powered YouTube thumbnail generator that helps content creators design professional, high-CTR thumbnails in seconds. Using Google's Gemini 3 Pro AI, it offers four creation modes: Standard Creation, Quick Create, Sketch to Image, and AI Editor."
    },
    {
      question: "How does the AI thumbnail generator work?",
      answer: "Our AI analyzes viral YouTube thumbnails and trends to create optimized designs. Simply describe what you want, upload your face (optional), and the AI generates professional thumbnails tailored to maximize click-through rates and viewer engagement."
    },
    {
      question: "Can I use my own face in the thumbnails?",
      answer: "Yes! Vizion features advanced face replacement technology. Upload your photo once, and seamlessly integrate your face into any thumbnail design. This is perfect for personal branding and maintaining channel consistency."
    },
    {
      question: "What makes Vizion different from other thumbnail makers?",
      answer: "Vizion offers four unique creation modes in one platform: AI-powered standard creation with layer control, instant Quick Create for speed, Sketch to Image for custom layouts, and a natural language AI Editor. Most tools only offer basic templates, while Vizion provides intelligent, trend-aware generation."
    },
    {
      question: "Is Vizion free to use?",
      answer: "Yes! Vizion offers a free tier that allows you to create YouTube thumbnails and explore all our AI-powered features. Premium plans are available for content creators who need unlimited generations and advanced features."
    },
    {
      question: "What image formats can I export?",
      answer: "Vizion exports thumbnails in high-quality PNG and JPG formats, optimized for YouTube's recommended 1280x720 resolution. All thumbnails are designed to look great on any device, from mobile phones to desktop screens."
    },
    {
      question: "How long does it take to create a thumbnail?",
      answer: "With Quick Create mode, you can generate professional YouTube thumbnails in just 10-15 seconds. Standard Creation mode takes 30-60 seconds for more detailed, layered designs. Sketch to Image typically processes in 20-30 seconds."
    },
    {
      question: "Can I edit thumbnails after they're generated?",
      answer: "Absolutely! Our AI Editor allows you to refine any thumbnail using natural language commands. Simply describe what you want to change, like 'add a red arrow' or 'make the text bigger,' and the AI applies your edits instantly."
    },
    {
      question: "Does Vizion work for languages other than English?",
      answer: "Yes! Vizion supports multiple languages including English and Spanish. You can create thumbnails with text in various languages, making it perfect for international content creators and multilingual channels."
    },
    {
      question: "What types of YouTube videos work best with Vizion?",
      answer: "Vizion works great for all YouTube content types: tutorials, gaming, vlogs, product reviews, educational content, entertainment, business, and more. Our AI adapts to your niche and creates thumbnails optimized for your specific audience."
    },
    {
      question: "Do I need design skills to use Vizion?",
      answer: "No design skills required! Vizion's AI handles all the complex design work. Just describe what you want in plain language, and the AI creates professional thumbnails. However, if you have design experience, you'll love the advanced control options."
    },
    {
      question: "How does Vizion optimize for click-through rate (CTR)?",
      answer: "Our AI analyzes millions of successful YouTube thumbnails to understand what drives clicks. It applies principles like contrast, emotion, clear text, compelling composition, and trend-aware elements to maximize your thumbnail's CTR potential."
    }
  ];

  return (
    <section className="py-24 px-6 relative">
      <div className="container mx-auto max-w-4xl space-y-12 relative z-10">
        <div className="text-center space-y-4">
          <h2 className="text-3xl md:text-5xl font-bold tracking-tight hero-font-secondary">
            Frequently Asked <br className="hidden md:block" />
            Questions
          </h2>
          <p className="text-lg text-muted-foreground">
            Everything you need to know about our AI thumbnail generator
          </p>
        </div>

        <div className="space-y-4">
          {faqs.map((faq, index) => (
            <div
              key={index}
              className="border border-border rounded-lg overflow-hidden bg-background"
            >
              <button
                onClick={() => setOpenIndex(openIndex === index ? null : index)}
                className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-muted/50 transition-colors"
              >
                <h3 className="font-semibold text-base md:text-lg pr-4">
                  {faq.question}
                </h3>
                <motion.div
                  animate={{ rotate: openIndex === index ? 180 : 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <ChevronDown className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                </motion.div>
              </button>
              <AnimatePresence>
                {openIndex === index && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <div className="px-6 pb-4 text-muted-foreground leading-relaxed">
                      {faq.answer}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default FAQ;
