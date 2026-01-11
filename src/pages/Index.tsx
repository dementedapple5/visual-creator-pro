import React, { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  ArrowRight,
  Sparkles,
  Zap,
  PenTool,
  Layers,
  Check,
  Play,
  Pause,
  MoreVertical,
  CheckCircle2
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import SEO from "@/components/SEO";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import FAQ from "@/components/landing/FAQ";

const Index = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [billingInterval, setBillingInterval] = useState<"monthly" | "yearly">("yearly");
  const [activeFeature, setActiveFeature] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const videoRef = useRef<HTMLVideoElement>(null);

  const togglePlayPause = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleGoogleSignIn = async () => {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/dashboard`,
      },
    });
  };

  // Auth check
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        navigate("/dashboard");
      }
    });
  }, [navigate]);

  // Intersection Observer for animations
  useEffect(() => {
    const elements = Array.from(document.querySelectorAll<HTMLElement>("[data-animate]"));
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
          }
        });
      },
      { threshold: 0.2, rootMargin: "0px 0px -10% 0px" }
    );

    elements.forEach((el) => observer.observe(el));
    return () => elements.forEach((el) => observer.unobserve(el));
  }, []);

  const features = [
    {
      title: "Standard Creation",
      subtitle: "AI-Powered Precision",
      description: "Describe your vision and let our advanced AI build it layer by layer. Perfect for creators who want specific results without the manual work.",
      video: "/videos/create.webm",
      icon: Sparkles,
      color: "bg-blue-500/10 text-blue-500",
      points: ["Smart Layer Generation", "Auto-Composition", "Face Replacement"]
    },
    {
      title: "Quick Create",
      subtitle: "Speed Mode",
      description: "Need a thumbnail in seconds? Just type a topic or paste your video title. Our AI analyzes trends and generates high-CTR options instantly.",
      video: "/videos/quick-create.webm",
      icon: Zap,
      color: "bg-amber-500/10 text-amber-500",
      points: ["1-Click Generation", "Trend Analysis", "Instant Variations"]
    },
    {
      title: "Sketch to Image",
      subtitle: "Draw Your Idea",
      description: "Have a specific layout in mind? Roughly sketch it out, and watch as our AI transforms your scribbles into a professional, polished thumbnail.",
      video: "/videos/sketch-create.webm",
      icon: PenTool,
      color: "bg-rose-500/10 text-rose-500",
      points: ["Rough Sketch Recognition", "Style Transfer", "Layout Preservation"]
    },
    {
      title: "AI Editor",
      subtitle: "Prompt-Based Refinement",
      description: "Perfect your thumbnail using natural language. Simply describe changes, reference your avatars, or ask to add specific elements like 'add a red arrow'.",
      video: "/videos/edit-thumbnail.webm",
      icon: Layers,
      color: "bg-purple-500/10 text-purple-500",
      points: ["Prompt-Driven Edits", "Avatar Integration", "Smart Element Placement"]
    }
  ];

  const exampleImages = [
    {
      src: "/examples/ex_1.webp",
      title: "5 HISTORIAS TERRORIFICAS - Basadas en Hechos Reales",
      channel: "Terror Nocturno",
      views: "1.2M views",
      time: "2 days ago",
      duration: "15:24",
      avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=1",
      verified: true
    },
    {
      src: "/examples/ex_2.webp",
      title: "DJI Osmo Action 6 - ¿Mejor que mi iPhone?",
      channel: "Aventura Digital",
      views: "856K views",
      time: "5 hours ago",
      duration: "12:05",
      avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=2",
      verified: true
    },
    {
      src: "/examples/ex_3.webp",
      title: "100x Your Online Sales - Easiest Way to Scale",
      channel: "E-commerce Empire",
      views: "2.4M views",
      time: "1 week ago",
      duration: "08:45",
      avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=3",
      verified: true
    },
    {
      src: "/examples/ex_4.webp",
      title: "Como conseguir una hipoteca Joven",
      channel: "Wealth Tips",
      views: "450K views",
      time: "3 days ago",
      duration: "10:30",
      avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=4",
      verified: false
    },
    {
      src: "/examples/ex_5.webp",
      title: "This Helped me To Make My 1st Million",
      channel: "Entrepreneur Mindset",
      views: "5.1M views",
      time: "1 month ago",
      duration: "22:15",
      avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=5",
      verified: true
    },
    {
      src: "/examples/ex_6.webp",
      title: "Como Vender en Shopify - ¡Aumenta tus Ventas Hoy!",
      channel: "Emprendedor Online",
      views: "920K views",
      time: "2 weeks ago",
      duration: "14:50",
      avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=6",
      verified: true
    },
    {
      src: "/examples/ex_7.webp",
      title: "iPhone 16 Pro vs Sony FX30 - Test de Cámara Extremo",
      channel: "Tech Review",
      views: "1.1M views",
      time: "10 days ago",
      duration: "18:20",
      avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=7",
      verified: false
    },
    {
      src: "/examples/ex_9.webp",
      title: "100x Your Online Sales - No Ads, Free Strategy!",
      channel: "Marketing Pro",
      
      views: "320K views",
      time: "6 days ago",
      duration: "25:10",
      avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=8",
      verified: true
    },
    {
      src: "/examples/ex_0.webp",
      title: "VENEZUELA LIBRE: ¿Qué está pasando realmente?",
      channel: "Noticias Global",
      views: "2.8M views",
      time: "2 months ago",
      duration: "30:45",
      avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=9",
      verified: true
    },
  ];

  return (
    <div className="min-h-screen bg-background font-sans selection:bg-primary/20 relative">
      {/* Global Background Blobs */}
      <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-slate-200/40 dark:bg-slate-800/20 rounded-full blur-[120px] animate-blob"></div>
        <div className="absolute top-[20%] right-[-5%] w-[40%] h-[40%] bg-zinc-200/30 dark:bg-zinc-800/10 rounded-full blur-[100px] animate-blob" style={{ animationDelay: '2s' }}></div>
        <div className="absolute bottom-[10%] left-[5%] w-[45%] h-[45%] bg-gray-200/40 dark:bg-gray-800/20 rounded-full blur-[120px] animate-blob" style={{ animationDelay: '4s' }}></div>
        <div className="absolute top-[50%] left-[50%] -translate-x-1/2 -translate-y-1/2 w-[60%] h-[60%] bg-slate-100/20 dark:bg-slate-900/10 rounded-full blur-[150px]"></div>
      </div>

      <SEO
        title="AI YouTube Thumbnail Generator - Vizion"
        description="Create viral YouTube thumbnails instantly with AI. 4 powerful modes: Standard, Quick, Sketch & Editor. Professional results in seconds."
        keywords="YouTube thumbnail generator, AI thumbnail creator, thumbnail maker, viral thumbnails, CTR optimization, YouTube thumbnail tool"
        image="/hero.webp"
        jsonLd={{
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "SoftwareApplication",
              "name": "Vizion AI Thumbnail Generator",
              "applicationCategory": "DesignApplication",
              "operatingSystem": "Web",
              "offers": {
                "@type": "Offer",
                "price": "0",
                "priceCurrency": "USD"
              },
              "aggregateRating": {
                "@type": "AggregateRating",
                "ratingValue": "4.8",
                "ratingCount": "2500"
              },
              "description": "Create viral YouTube thumbnails instantly with AI. Professional thumbnail generator with 4 powerful creation modes.",
              "image": "https://vizionai.app/hero.webp",
              "url": "https://vizionai.app",
              "author": {
                "@type": "Organization",
                "name": "Vizion"
              },
              "featureList": [
                "AI-powered thumbnail generation",
                "Quick thumbnail creator",
                "Sketch to thumbnail conversion",
                "Smart thumbnail editor",
                "Face replacement technology",
                "High CTR optimization"
              ]
            },
            {
              "@type": "FAQPage",
              "mainEntity": [
                {
                  "@type": "Question",
                  "name": "What is Vizion AI Thumbnail Generator?",
                  "acceptedAnswer": {
                    "@type": "Answer",
                    "text": "Vizion is an advanced AI-powered YouTube thumbnail generator that helps content creators design professional, high-CTR thumbnails in seconds. Using Google's Gemini 3 Pro AI, it offers four creation modes: Standard Creation, Quick Create, Sketch to Image, and AI Editor."
                  }
                },
                {
                  "@type": "Question",
                  "name": "How does the AI thumbnail generator work?",
                  "acceptedAnswer": {
                    "@type": "Answer",
                    "text": "Our AI analyzes viral YouTube thumbnails and trends to create optimized designs. Simply describe what you want, upload your face (optional), and the AI generates professional thumbnails tailored to maximize click-through rates and viewer engagement."
                  }
                },
                {
                  "@type": "Question",
                  "name": "Is Vizion free to use?",
                  "acceptedAnswer": {
                    "@type": "Answer",
                    "text": "Yes! Vizion offers a free tier that allows you to create YouTube thumbnails and explore all our AI-powered features. Premium plans are available for content creators who need unlimited generations and advanced features."
                  }
                },
                {
                  "@type": "Question",
                  "name": "How long does it take to create a thumbnail?",
                  "acceptedAnswer": {
                    "@type": "Answer",
                    "text": "With Quick Create mode, you can generate professional YouTube thumbnails in just 10-15 seconds. Standard Creation mode takes 30-60 seconds for more detailed, layered designs."
                  }
                }
              ]
            },
            {
              "@type": "WebSite",
              "name": "Vizion",
              "url": "https://vizionai.app",
              "potentialAction": {
                "@type": "SearchAction",
                "target": "https://vizionai.app/search?q={search_term_string}",
                "query-input": "required name=search_term_string"
              }
            }
          ]
        }}
      />

      {/* Navigation */}
      <nav className="fixed top-0 w-full z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="container mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img src="/logo.png" alt="Vizion AI - YouTube Thumbnail Generator Logo" className="w-8 h-8 rounded-lg" />
            <span className="font-bold text-lg tracking-tight">Vizion</span>
          </div>
          <div className="flex items-center gap-4">
            <Button onClick={() => navigate("/auth")} className="rounded px-6 flex items-center gap-2">
              Get Started
              <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-6 relative overflow-hidden">
        {/* Faded Grid Background */}
        <div 
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: `linear-gradient(to right, rgba(120,120,120,0.1) 1px, transparent 1px),
                              linear-gradient(to bottom, rgba(120,120,120,0.1) 1px, transparent 1px)`,
            backgroundSize: '40px 40px',
            maskImage: 'radial-gradient(ellipse 80% 50% at 50% 0%, black, transparent)',
            WebkitMaskImage: 'radial-gradient(ellipse 80% 50% at 50% 0%, black, transparent)'
          }}
        />
        <div className="container mx-auto max-w-7xl grid grid-cols-1 lg:grid-cols-2 gap-12 items-center relative z-10">
          <div className="text-left space-y-8">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-secondary/50 border border-border text-sm font-medium animate-slide-up-fade">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
              </span>
              v2.0 Now Live
            </div>

            <h1 className="text-4xl md:text-6xl lg:text-8xl font-black tracking-tight text-balance animate-slide-up-fade hero-font-primary" style={{ animationDelay: "0.1s" }}>
              The All-in-One <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-500 via-rose-500 to-purple-600 animate-gradient-x">
                AI Thumbnail Studio
              </span>
            </h1>

            <p className="text-xl text-muted-foreground max-w-2xl leading-relaxed animate-slide-up-fade" style={{ animationDelay: "0.2s" }}>
              Stop struggling with complex design tools. Create viral-ready YouTube thumbnails in seconds using our suite of <a href="#demos" className="text-primary hover:underline font-semibold">4 powerful AI modes</a>. Perfect for content creators, YouTubers, and digital marketers.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-start gap-4 pt-4 animate-fade-in-up" style={{ animationDelay: "0.3s" }}>
              <Button 
                size="lg" 
                className="w-full sm:w-auto h-12 px-8 rounded text-base shadow-lg shadow-primary/20 flex items-center gap-3" 
                style={{ backgroundColor: 'white', color: 'black' }}
                onClick={handleGoogleSignIn}
              >
                <img src="/google.png" alt="Sign in with Google" className="w-5 h-5" />
                Start with Google
              </Button>
              <Button size="lg" variant="outline" className="w-full sm:w-auto h-12 px-8 rounded text-base backdrop-blur-sm" onClick={() => document.getElementById('demos')?.scrollIntoView({ behavior: 'smooth' })}>
                <Play className="mr-2 w-4 h-4 fill-current" />
                Watch Demos
              </Button>
            </div>
          </div>

          {/* Hero Visual */}
          <div className="relative aspect-square lg:aspect-[4/3] animate-fade-in-up" style={{ animationDelay: "0.4s" }}>
            <img
              src="/hero.webp"
              alt="AI-powered YouTube thumbnail generator showing multiple creation modes and examples"
              className="w-full h-full object-contain object-center"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-background/20 via-transparent to-transparent pointer-events-none"></div>
          </div>
        </div>
      </section>

      {/* Feature Showcase Section */}
      <section id="demos" className="py-24 px-6 relative overflow-hidden">
        <div className="container mx-auto max-w-6xl space-y-12 relative z-10">
          <div className="text-center space-y-4 max-w-3xl mx-auto" data-animate>
            <h2 className="text-3xl md:text-5xl font-bold tracking-tight hero-font-secondary">
              Four Ways to Create <br className="hidden md:block" />
              YouTube Thumbnails
            </h2>
            <p className="text-lg text-muted-foreground">From automated AI generation to professional prompt-based editing, we have the perfect thumbnail creation tool for your workflow.</p>
          </div>

          <div className="space-y-0 border border-border rounded overflow-hidden shadow-2xl bg-background">
            {/* Horizontal Tabs */}
            <div className="grid grid-cols-2 md:grid-cols-4">
              {features.map((feature, index) => (
                <button
                  key={index}
                  onClick={() => {
                    setActiveFeature(index);
                    setIsPlaying(true);
                  }}
                  className={`relative px-6 py-4 transition-all duration-300 text-left border-b border-border ${activeFeature === index
                    ? "bg-muted/50"
                    : "bg-background hover:bg-muted/30"
                    } ${index % 2 === 0 ? "border-r" : "md:border-r"} ${index === 3 ? "md:border-r-0" : ""}`}
                >
                  <div className="space-y-1">
                    <h3 className={`font-bold transition-colors ${activeFeature === index ? "text-foreground" : "text-muted-foreground"
                      }`}>
                      {feature.title}
                    </h3>
                    <p className={`text-xs leading-relaxed line-clamp-1 transition-colors ${activeFeature === index ? "text-muted-foreground" : "text-muted-foreground/60"
                      }`}>
                      {feature.subtitle}
                    </p>
                  </div>
                  {activeFeature === index && (
                    <motion.div
                      layoutId="tab-indicator"
                      className="absolute bottom-0 left-0 right-0 h-1"
                      style={{ backgroundColor: 'rgba(255, 45, 85, 1)' }}
                      transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                    />
                  )}
                </button>
              ))}
            </div>

            {/* Video Container */}
            <div className="relative aspect-video">
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeFeature}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.3 }}
                  className="relative aspect-video"
                >
                  <video
                    ref={videoRef}
                    key={features[activeFeature].video}
                    autoPlay
                    loop
                    muted
                    playsInline
                    className="w-full h-full object-contain bg-black"
                    onPlay={() => setIsPlaying(true)}
                    onPause={() => setIsPlaying(false)}
                  >
                    <source src={features[activeFeature].video} type="video/webm" />
                  </video>
                </motion.div>
              </AnimatePresence>

              {/* Play/Pause Button */}
              <button
                onClick={togglePlayPause}
                className="absolute bottom-4 right-4 w-10 h-10 rounded-lg bg-background/80 backdrop-blur-sm border border-border flex items-center justify-center text-foreground hover:bg-background transition-colors shadow-lg"
              >
                {isPlaying ? (
                  <Pause className="w-4 h-4" />
                ) : (
                  <Play className="w-4 h-4 ml-0.5" />
                )}
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Examples Gallery */}
      <section id="examples" className="py-24 px-6 relative">
        <div className="container mx-auto max-w-7xl space-y-12 relative z-10">
          <div className="text-center space-y-4 max-w-3xl mx-auto mb-16" data-animate>
            <h2 className="text-3xl md:text-5xl font-bold tracking-tight hero-font-secondary">
              YouTube Thumbnails <br className="hidden md:block" />
              Created with Vizion AI
            </h2>
            <p className="text-lg text-muted-foreground">High-CTR thumbnails generated across different niches and styles using our AI thumbnail generator.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-4 gap-y-10">
            {exampleImages.map((item, index) => (
              <div key={index} className="group cursor-pointer flex flex-col gap-3">
                {/* Thumbnail Container */}
                <div className="relative aspect-video rounded-xl overflow-hidden bg-muted">
                  <img
                    src={item.src}
                    alt={`AI-generated YouTube thumbnail example: ${item.title}`}
                    className="w-full h-full object-cover transform transition-transform duration-500 group-hover:scale-105"
                  />
                  <div className="absolute bottom-2 right-2 bg-black/80 text-white text-[10px] font-bold px-1.5 py-0.5 rounded">
                    {item.duration}
                  </div>
                </div>

                {/* Metadata */}
                <div className="flex gap-3">
                  <Avatar className="w-9 h-9 flex-shrink-0">
                    <AvatarImage src={item.avatar} />
                    <AvatarFallback>{item.channel[0]}</AvatarFallback>
                  </Avatar>
                  
                  <div className="flex flex-col flex-grow pr-4">
                    <h3 className="font-semibold text-sm line-clamp-2 leading-snug group-hover:text-primary transition-colors">
                      {item.title}
                    </h3>
                    <div className="mt-1 flex flex-col">
                      <div className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
                        {item.channel}
                        {item.verified && <CheckCircle2 className="w-3 h-3 fill-muted-foreground text-background" />}
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {item.views} • {item.time}
                      </div>
                    </div>
                  </div>

                  <button className="opacity-0 group-hover:opacity-100 p-1 hover:bg-muted rounded-full transition-all h-fit">
                    <MoreVertical className="w-4 h-4 text-muted-foreground" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits Section - SEO Content */}
      <section className="py-24 px-6 relative overflow-hidden">
        <div className="container mx-auto max-w-6xl space-y-16 relative z-10">
          <div className="text-center space-y-4 max-w-3xl mx-auto" data-animate>
            <h2 className="text-3xl md:text-5xl font-bold tracking-tight hero-font-secondary">
              Why Choose <br className="hidden md:block" />
              Vizion AI Thumbnail Generator?
            </h2>
            <p className="text-lg text-muted-foreground">The most powerful and easy-to-use YouTube thumbnail creator for content creators</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            <div className="space-y-3 p-6 rounded border border-border bg-background hover:shadow-lg transition-shadow">
              <div className="w-12 h-12 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <Sparkles className="w-6 h-6 text-blue-500" />
              </div>
              <h3 className="text-xl font-bold">AI-Powered Design</h3>
              <p className="text-muted-foreground">
                Our advanced AI thumbnail generator uses Google's Gemini 3 Pro to create stunning, high-converting YouTube thumbnails that boost your CTR and views.
              </p>
            </div>

            <div className="space-y-3 p-6 rounded border border-border bg-background hover:shadow-lg transition-shadow">
              <div className="w-12 h-12 rounded-lg bg-amber-500/10 flex items-center justify-center">
                <Zap className="w-6 h-6 text-amber-500" />
              </div>
              <h3 className="text-xl font-bold">Create in Seconds</h3>
              <p className="text-muted-foreground">
                Generate professional YouTube thumbnails in seconds, not hours. Perfect for busy content creators and YouTubers who need quick, quality results.
              </p>
            </div>

            <div className="space-y-3 p-6 rounded border border-border bg-background hover:shadow-lg transition-shadow">
              <div className="w-12 h-12 rounded-lg bg-rose-500/10 flex items-center justify-center">
                <PenTool className="w-6 h-6 text-rose-500" />
              </div>
              <h3 className="text-xl font-bold">Sketch to Thumbnail</h3>
              <p className="text-muted-foreground">
                Draw a rough sketch and watch our AI transform it into a polished, professional YouTube thumbnail. Perfect for creators with specific layout ideas.
              </p>
            </div>

            <div className="space-y-3 p-6 rounded border border-border bg-background hover:shadow-lg transition-shadow">
              <div className="w-12 h-12 rounded-lg bg-purple-500/10 flex items-center justify-center">
                <Layers className="w-6 h-6 text-purple-500" />
              </div>
              <h3 className="text-xl font-bold">Smart Editing</h3>
              <p className="text-muted-foreground">
                Edit your thumbnails using natural language. Just describe what you want to change, and our AI thumbnail editor makes it happen instantly.
              </p>
            </div>

            <div className="space-y-3 p-6 rounded border border-border bg-background hover:shadow-lg transition-shadow">
              <div className="w-12 h-12 rounded-lg bg-green-500/10 flex items-center justify-center">
                <Check className="w-6 h-6 text-green-500" />
              </div>
              <h3 className="text-xl font-bold">High CTR Optimization</h3>
              <p className="text-muted-foreground">
                Our AI analyzes viral YouTube thumbnails to ensure your designs are optimized for maximum click-through rates and viewer engagement.
              </p>
            </div>

            <div className="space-y-3 p-6 rounded border border-border bg-background hover:shadow-lg transition-shadow">
              <div className="w-12 h-12 rounded-lg bg-orange-500/10 flex items-center justify-center">
                <Sparkles className="w-6 h-6 text-orange-500" />
              </div>
              <h3 className="text-xl font-bold">Face Replacement</h3>
              <p className="text-muted-foreground">
                Upload your face once and seamlessly integrate it into any thumbnail design. Perfect for personal branding and channel consistency.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <FAQ />

      {/* CTA Section */}
      <section className="py-32 px-6 relative overflow-hidden">
        <div className="absolute inset-0 bg-slate-950/5 dark:bg-white/5 backdrop-blur-[2px] pointer-events-none border-y border-border/50"></div>
        <div className="container mx-auto max-w-4xl text-center relative z-10 space-y-8" data-animate>
          <h2 className="text-3xl md:text-6xl font-bold tracking-tight hero-font-secondary text-balance">
            Ready to create <br />
            viral YouTube thumbnails?
          </h2>
          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">
            Join thousands of YouTubers and content creators who are growing their channels with Vizion's AI thumbnail generator. Start creating professional thumbnails for free today.
          </p>
          <Button
            size="lg"
            className="h-14 px-10 rounded text-lg font-bold bg-foreground text-background hover:bg-foreground/90 flex items-center gap-3 mx-auto shadow-2xl"
            onClick={handleGoogleSignIn}
          >
            <img src="/google.png" alt="Start with Google Sign-in" className="w-6 h-6" />
            Get Started with Google
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-6 border-t border-border bg-muted/30">
        <div className="container mx-auto flex flex-col md:flex-row justify-between items-center gap-6 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <span className="font-bold text-foreground">Vizion</span>
            <span>© {new Date().getFullYear()}</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;
