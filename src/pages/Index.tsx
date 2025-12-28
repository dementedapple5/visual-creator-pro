import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  ArrowRight,
  Play,
  Quote,
  Check,
  Sparkles,
  Camera,
  Palette,
  Type,
  LayoutGrid,
  Repeat2
} from "lucide-react";
import { InfiniteScrollExamples } from "@/components/landing/InfiniteScrollExamples";
import { HowItWorks } from "@/components/landing/HowItWorks";
import SEO from "@/components/SEO";

const getSubscriptionPlans = (t: (key: string) => string) => [
  {
    name: t("plans.free.name"),
    monthlyPrice: "$0",
    yearlyPrice: "$0",
    priceId: null,
    yearlyPriceId: null,
    productId: null,
    desc: t("plans.free.description"),
    features: [
      t("plans.free.features.oneTimeCredits"),
      t("plans.free.features.emailSupport")
    ]
  },
  {
    name: t("plans.starter.name"),
    monthlyPrice: "$17.99",
    yearlyPrice: "$172.70",
    monthlySavings: null,
    yearlySavings: "20%",
    priceId: "price_1SX0vtISMAOMUNUM7hJ7Mk45",
    yearlyPriceId: "price_1SXHyGISMAOMUNUMx0LrXEZg",
    productId: "prod_TTytxm2oUYxzXe",
    desc: t("plans.starter.description"),
    features: [
      t("plans.starter.features.credits"),
      t("plans.starter.features.headshots"),
      t("plans.starter.features.customization"),
      t("plans.starter.features.support")
    ]
  },
  {
    name: t("plans.pro.name"),
    monthlyPrice: "$29.99",
    yearlyPrice: "$287.90",
    monthlySavings: null,
    yearlySavings: "20%",
    priceId: "price_1SXHwFISMAOMUNUM0syTOyVg",
    yearlyPriceId: "price_1SXI02ISMAOMUNUMd8oTYJPc",
    productId: "prod_TUGTkbIPU5H2pn",
    popular: true,
    desc: t("plans.pro.description"),
    features: [
      t("plans.pro.features.credits"),
      t("plans.pro.features.headshots"),
      t("plans.pro.features.customization"),
      t("plans.pro.features.support")
    ]
  },
  {
    name: t("plans.enterprise.name"),
    monthlyPrice: "$99.99",
    yearlyPrice: "$959.90",
    monthlySavings: null,
    yearlySavings: "20%",
    priceId: "price_1SX0wNISMAOMUNUMTz5N3THc",
    yearlyPriceId: "price_1SXI0FISMAOMUNUMgfSnO0Y0",
    productId: "prod_TTyuNeWPfbeOFz",
    desc: t("plans.enterprise.description"),
    features: [
      t("plans.enterprise.features.credits"),
      t("plans.enterprise.features.headshots"),
      t("plans.enterprise.features.customization"),
      t("plans.enterprise.features.support")
    ]
  }
];

const getRotatingWords = (t: (key: string) => string) => [
  t("landing.rotatingWords.thumbnails"),
  t("landing.rotatingWords.ctrHooks"),
  t("landing.rotatingWords.youtube169"),
  t("landing.rotatingWords.variations"),
  t("landing.rotatingWords.viralCovers")
];

const getBentoFeatures = (t: (key: string) => string) => [
  {
    title: t("features.yourIdentityAutomated.title"),
    desc: t("features.yourIdentityAutomated.description"),
    icon: Camera,
    badge: t("features.yourIdentityAutomated.badge"),
    span: "lg:col-span-3",
    steps: [
      { title: t("features.yourIdentityAutomated.steps.faceLibrary.title"), detail: t("features.yourIdentityAutomated.steps.faceLibrary.detail") },
      { title: t("features.yourIdentityAutomated.steps.lightingMatch.title"), detail: t("features.yourIdentityAutomated.steps.lightingMatch.detail") },
      { title: t("features.yourIdentityAutomated.steps.noNewShoots.title"), detail: t("features.yourIdentityAutomated.steps.noNewShoots.detail") }
    ],
    footnote: t("features.yourIdentityAutomated.footnote")
  },
  {
    title: t("features.designThatGetsClicks.title"),
    desc: t("features.designThatGetsClicks.description"),
    icon: Sparkles,
    badge: t("features.designThatGetsClicks.badge"),
    span: "lg:col-span-3",
    stats: [
      { label: t("features.designThatGetsClicks.stats.format.label"), value: t("features.designThatGetsClicks.stats.format.value"), sub: t("features.designThatGetsClicks.stats.format.sub") },
      { label: t("features.designThatGetsClicks.stats.contrast.label"), value: t("features.designThatGetsClicks.stats.contrast.value"), sub: t("features.designThatGetsClicks.stats.contrast.sub") },
      { label: t("features.designThatGetsClicks.stats.readability.label"), value: t("features.designThatGetsClicks.stats.readability.value"), sub: t("features.designThatGetsClicks.stats.readability.sub") },
      { label: t("features.designThatGetsClicks.stats.presets.label"), value: t("features.designThatGetsClicks.stats.presets.value"), sub: t("features.designThatGetsClicks.stats.presets.sub") }
    ],
    footnote: t("features.designThatGetsClicks.footnote")
  },
  {
    title: t("features.stylesThatHook.title"),
    desc: t("features.stylesThatHook.description"),
    icon: Palette,
    badge: t("features.stylesThatHook.badge"),
    span: "lg:col-span-2",
    swatches: [
      { label: t("features.stylesThatHook.swatches.gamingPro"), colors: ["#FF0000", "#000000"] },
      { label: t("features.stylesThatHook.swatches.cleanIRL"), colors: ["#FFFFFF", "#F3F4F6"] },
      { label: t("features.stylesThatHook.swatches.aiScenery"), colors: ["linear-gradient(135deg, #6366f1, #a855f7)"] }
    ],
    chips: [
      t("features.stylesThatHook.chips.aiBackgrounds"),
      t("features.stylesThatHook.chips.proFilters"),
      t("features.stylesThatHook.chips.autoContrast"),
      t("features.stylesThatHook.chips.smartLayers")
    ],
    footnote: t("features.stylesThatHook.footnote")
  },
  {
    title: t("features.textThatCutsThroughNoise.title"),
    desc: t("features.textThatCutsThroughNoise.description"),
    icon: Type,
    badge: t("features.textThatCutsThroughNoise.badge"),
    span: "lg:col-span-2",
    sample: {
      title: t("features.textThatCutsThroughNoise.sample.title"),
      subtitle: t("features.textThatCutsThroughNoise.sample.subtitle"),
      tags: [
        t("features.textThatCutsThroughNoise.sample.tags.boldContrast"),
        t("features.textThatCutsThroughNoise.sample.tags.proShadows"),
        t("features.textThatCutsThroughNoise.sample.tags.readyToUse")
      ]
    }
  },
  {
    title: t("features.smartLayouts.title"),
    desc: t("features.smartLayouts.description"),
    icon: LayoutGrid,
    badge: t("features.smartLayouts.badge"),
    span: "lg:col-span-2",
    stats: [
      { label: t("features.smartLayouts.stats.rules.label"), value: t("features.smartLayouts.stats.rules.value"), sub: t("features.smartLayouts.stats.rules.sub") },
      { label: t("features.smartLayouts.stats.slots.label"), value: t("features.smartLayouts.stats.slots.value"), sub: t("features.smartLayouts.stats.slots.sub") }
    ],
    chips: [
      t("features.smartLayouts.chips.autoAlign"),
      t("features.smartLayouts.chips.layerOrder"),
      t("features.smartLayouts.chips.smartScaling")
    ]
  },
  {
    title: t("features.remixAndScale.title"),
    desc: t("features.remixAndScale.description"),
    icon: Repeat2,
    badge: t("features.remixAndScale.badge"),
    span: "lg:col-span-4",
    steps: [
      { title: t("features.remixAndScale.steps.aiRemix.title"), detail: t("features.remixAndScale.steps.aiRemix.detail") },
      { title: t("features.remixAndScale.steps.oneClickExport.title"), detail: t("features.remixAndScale.steps.oneClickExport.detail") }
    ],
    stats: [
      { label: t("features.remixAndScale.stats.productivity.label"), value: t("features.remixAndScale.stats.productivity.value"), sub: t("features.remixAndScale.stats.productivity.sub") }
    ],
    footnote: t("features.remixAndScale.footnote")
  }
];

const Index = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [billingInterval, setBillingInterval] = useState<"monthly" | "yearly">("yearly");
  const rotatingWords = getRotatingWords(t);
  const [displayedWord, setDisplayedWord] = useState(rotatingWords[0].slice(0, 1));
  const [wordIndex, setWordIndex] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);

  // Reset displayed word when language changes
  useEffect(() => {
    const newWords = getRotatingWords(t);
    setDisplayedWord(newWords[0].slice(0, 1));
    setWordIndex(0);
    setIsDeleting(false);
  }, [t]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        navigate("/dashboard");
      }
    });
  }, [navigate]);

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

  const subscriptionPlans = getSubscriptionPlans(t);
  const bentoFeatures = getBentoFeatures(t);

  useEffect(() => {
    const currentWord = rotatingWords[wordIndex];
    let timeout: number;

    if (!isDeleting && displayedWord === currentWord) {
      timeout = window.setTimeout(() => setIsDeleting(true), 1200);
    } else if (isDeleting && displayedWord === "") {
      timeout = window.setTimeout(() => {
        setIsDeleting(false);
        setWordIndex((prev) => (prev + 1) % rotatingWords.length);
      }, 280);
    } else {
      timeout = window.setTimeout(() => {
        const nextLength = displayedWord.length + (isDeleting ? -1 : 1);
        setDisplayedWord(currentWord.slice(0, nextLength));
      }, isDeleting ? 45 : 90);
    }

    return () => clearTimeout(timeout);
  }, [displayedWord, isDeleting, wordIndex]);

  const baseUrl = typeof window !== "undefined" 
    ? `${window.location.protocol}//${window.location.host}`
    : "https://vizion.app";

  // Schema.org structured data for SEO
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "name": "Vizion",
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
      "ratingCount": "1250"
    },
    "description": t("landing.heroTagline"),
    "url": baseUrl,
    "screenshot": `${baseUrl}/favicon.png`,
    "featureList": [
      "AI-Powered Thumbnail Generation",
      "YouTube 16:9 Format",
      "Face Library & Recognition",
      "Custom Backgrounds",
      "Text Styling",
      "High CTR Optimization"
    ]
  };

  return (
    <div className="min-h-screen bg-background overflow-hidden selection:bg-primary/20 font-sans relative">
      <SEO
        title={`${t("landing.heroTitle")} ${t("landing.heroSubtitle")} | Vizion`}
        description={t("landing.heroTagline")}
        keywords="YouTube thumbnails, thumbnail generator, AI thumbnails, YouTube thumbnail maker, social media covers, thumbnail design, CTR optimization, video thumbnails, YouTube SEO, thumbnail creator, Gemini AI, high CTR thumbnails"
        image="/favicon.png"
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute inset-0 bg-grid-white/[0.03] dark:bg-grid-white/[0.03]" />
        <div className="absolute inset-0 clip-grid">
          {Array.from({ length: 10 }).map((_, index) => (
            <span
              key={index}
              className="clip-column"
              style={{ ["--delay" as any]: `${index * 0.12}s` }}
            />
          ))}
        </div>
        <div className="absolute top-[-18%] left-[-8%] w-[48%] h-[48%] bg-rose-500/12 rounded-full blur-[140px]" />
        <div className="absolute bottom-[-18%] right-[-4%] w-[50%] h-[50%] bg-rose-400/10 rounded-full blur-[140px]" />
      </div>

      <nav className="fixed top-0 w-full z-50 border-b border-border bg-background/60 backdrop-blur-xl transition-all duration-300">
        <div className="container mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10">
              <img
                src="/favicon.png"
                alt="Vizion - AI-Powered YouTube Thumbnail Generator Logo"
                className="w-full h-full rounded-xl  object-contain shadow-lg shadow-primary/20 bg-white/80"
              />
            </div>
            <span className="font-bold text-xl tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-foreground to-foreground/60">
              VIZION
            </span>
          </div>
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              className="text-muted-foreground hover:text-foreground transition-colors hidden sm:flex beam-button"
              onClick={() => navigate("/auth")}
            >
              {t("landing.signIn")}
            </Button>
            <Button
              onClick={() => navigate("/auth")}
              className="bg-foreground text-background hover:bg-foreground/90 rounded-full px-6 shadow-glow transition-all beam-button"
            >
              {t("landing.getStarted")}
            </Button>
          </div>
        </div>
      </nav>

      <section className="relative pt-32 pb-24 px-6 min-h-[90vh] flex items-center overflow-hidden">
        {/* Floating Thumbnails Background */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none z-0 opacity-[0.15] dark:opacity-[0.1]">
          <div className="absolute top-[15%] -left-[5%] w-[300px] h-[168px] rotate-[-12deg] blur-[1px] animate-float" style={{ animationDelay: '0s' }}>
            <img 
              src="/examples/ex_1.png" 
              alt="Example YouTube thumbnail created with Vizion AI thumbnail generator showing high CTR design"
              className="w-full h-full object-cover rounded-2xl shadow-2xl border border-white/10" 
            />
          </div>
          <div className="absolute top-[45%] -right-[8%] w-[320px] h-[180px] rotate-[8deg] blur-[0.5px] animate-float" style={{ animationDelay: '1.5s' }}>
            <img 
              src="/examples/ex_2.png" 
              alt="AI-generated YouTube thumbnail example with professional design and high click-through rate"
              className="w-full h-full object-cover rounded-2xl shadow-2xl border border-white/10" 
            />
          </div>
          <div className="absolute bottom-[10%] left-[10%] w-[280px] h-[157px] rotate-[-5deg] blur-[2px] animate-float" style={{ animationDelay: '3s' }}>
            <img 
              src="/examples/ex_3.png" 
              alt="Vizion thumbnail generator example showcasing viral YouTube thumbnail design"
              className="w-full h-full object-cover rounded-2xl shadow-2xl border border-white/10" 
            />
          </div>
          <div className="absolute top-[10%] right-[15%] w-[260px] h-[146px] rotate-[15deg] blur-[3px] animate-float" style={{ animationDelay: '4.5s' }}>
            <img 
              src="/examples/ex_4.png" 
              alt="Professional YouTube thumbnail created with AI-powered Vizion thumbnail maker"
              className="w-full h-full object-cover rounded-2xl shadow-2xl border border-white/10" 
            />
          </div>
          <div className="absolute bottom-[20%] right-[20%] w-[340px] h-[191px] rotate-[-8deg] blur-[4px] opacity-40 animate-float" style={{ animationDelay: '2s' }}>
            <img 
              src="/examples/ex_5.png" 
              alt="High-converting YouTube thumbnail example generated with Vizion AI technology"
              className="w-full h-full object-cover rounded-2xl shadow-2xl border border-white/10" 
            />
          </div>
        </div>

        <div className="container mx-auto max-w-7xl grid grid-cols-1 lg:grid-cols-2 gap-12 items-center relative z-10">
          <div className="flex flex-col items-center lg:items-start text-center lg:text-left gap-10">
            {/* YouTube Badge */}
            <div
              className="flex items-center gap-3 mb-2"
              data-animate
              style={{ ["--delay" as any]: "0s" }}
            >
              <span className="px-4 py-1.5 rounded-full bg-gradient-to-r from-[#FF0000] to-[#CC0000] text-white text-sm font-bold shadow-lg shadow-red-500/30 flex items-center gap-2">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
                </svg>
                {t("landing.heroBadge")}
              </span>
              <span className="px-4 py-1.5 rounded-full bg-secondary border border-border text-foreground text-sm font-medium">
                {t("landing.heroFormatBadge")}
              </span>
            </div>

            <div className="space-y-4 w-full">
              <h1 className="text-3xl md:text-5xl xl:text-6xl leading-[1.05] tracking-tight w-full">
                <span
                  className="hero-font-primary text-balance block w-full"
                  data-animate
                  style={{ ["--delay" as any]: "0.05s" }}
                >
                  {t("landing.heroTitle")}
                </span>
                <span
                  className="hero-font-secondary text-gradient text-balance block w-full pb-2"
                  data-animate
                  style={{ ["--delay" as any]: "0.15s" }}
                >
                  {t("landing.heroSubtitle")}
                </span>
                <span
                  className="flex flex-wrap justify-center lg:justify-start items-center gap-3 text-lg md:text-xl text-muted-foreground/90 hero-type w-full"
                  data-animate
                  style={{ ["--delay" as any]: "0.25s" }}
                >
                  {t("landing.heroDescription")}
                  <span className="typewriter text-foreground">{displayedWord}</span>
                  <span className="type-caret" aria-hidden="true" />
                </span>
              </h1>
            </div>

            <p
              className="text-lg md:text-xl text-muted-foreground max-w-4xl w-full leading-relaxed"
              data-animate
              style={{ ["--delay" as any]: "0.35s" }}
            >
              {t("landing.heroTagline")}
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start pt-2">
              <Button
                size="lg"
                onClick={() => navigate("/auth")}
                className="h-14 px-8 rounded-full bg-foreground text-background hover:bg-foreground/90 text-lg transition-all beam-button shadow-glow shadow-primary/20"
                data-animate
                style={{ ["--delay" as any]: "0.45s" }}
              >
                {t("landing.startCreatingFree")}
                <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
            </div>
          </div>

          <div className="relative flex justify-center items-center lg:block" data-animate style={{ ["--delay" as any]: "0.5s" }}>
            <div className="relative w-full max-w-[600px] aspect-square lg:aspect-auto">
              <video
                autoPlay
                loop
                muted
                playsInline
                className="w-full h-auto object-contain pointer-events-none drop-shadow-2xl"
                aria-label="Vizion AI thumbnail generator demo video showing how to create YouTube thumbnails"
              >
                <source src="/web.webm" type="video/webm" />
              </video>
            </div>
          </div>
        </div>
      </section>

      {/* YouTube Feed Preview Section */}
      <section className="py-20 px-6 relative z-10 bg-muted/30 border-y border-border">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-12 space-y-3" data-animate>
            <h2 className="text-3xl md:text-4xl font-bold">
              {t("landing.youtubeFeedPreview.title")}
            </h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              {t("landing.youtubeFeedPreview.description")}
            </p>
          </div>

          {/* YouTube Feed Simulation */}
          <div className="max-w-4xl mx-auto" data-animate style={{ ["--delay" as any]: "0.1s" }}>
            <div className="bg-background rounded-2xl border border-border p-6 md:p-8 shadow-2xl">
              {/* YouTube-like header */}
              <div className="flex items-center gap-3 mb-6 pb-4 border-b border-border">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#FF0000] to-[#CC0000] flex items-center justify-center">
                  <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                  </svg>
                </div>
                <div className="h-4 w-32 bg-muted rounded"></div>
              </div>

              {/* Video Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  { image: "ex_1.png", key: "video1" },
                  { image: "ex_2.png", key: "video2" },
                  { image: "ex_3.png", key: "video3" },
                  { image: "ex_4.png", key: "video4" }
                ].map((video, idx) => {
                  const videoData = t(`landing.youtubeFeedPreview.videos.${video.key}`, { returnObjects: true }) as { title: string; channel: string };
                  return (
                    <div key={idx} className="group cursor-pointer">
                      <div className="relative aspect-video rounded-lg overflow-hidden bg-muted mb-2 border border-border shadow-lg transition-transform duration-300 group-hover:scale-[1.02]">
                        <img
                          src={`/examples/${video.image}`}
                          alt={`${videoData.title} - YouTube thumbnail example created with Vizion AI thumbnail generator`}
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute bottom-2 right-2 px-1.5 py-0.5 bg-black/80 text-white text-xs rounded">
                          10:24
                        </div>
                      </div>
                      <div className="space-y-1">
                        <h3 className="text-sm font-semibold text-foreground line-clamp-2 group-hover:text-primary transition-colors">
                          {videoData.title}
                        </h3>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <div className="w-6 h-6 rounded-full bg-muted"></div>
                          <span>{videoData.channel}</span>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          <span>1.2M views</span> · <span>2 days ago</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </section>

      <InfiniteScrollExamples />

      <HowItWorks />

      <section className="py-28 px-6 relative z-10">
        <div className="container mx-auto max-w-7xl">
          <div className="text-center mb-16 space-y-3">
            <h2 className="text-3xl md:text-5xl font-bold" data-animate>
              {t("landing.powerUpTitle")}
            </h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto" data-animate style={{ ["--delay" as any]: "0.1s" }}>
              {t("landing.powerUpDescription")}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-6">
            {bentoFeatures.map((feature, idx) => {
              const Icon = feature.icon;
              return (
                <div
                  key={feature.title}
                  className={`relative overflow-hidden rounded-3xl border border-border bg-card/40 backdrop-blur-xl p-6 flex flex-col gap-4 ${feature.span}`}
                  data-animate
                  style={{ ["--delay" as any]: `${0.05 * idx}s` }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Icon className="w-5 h-5 text-foreground" />
                      <h3 className="text-xl font-semibold text-foreground">{feature.title}</h3>
                    </div>
                    <span className="px-3 py-1 rounded-full bg-secondary text-xs text-foreground whitespace-nowrap">{feature.badge}</span>
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed">{feature.desc}</p>
                  {feature.steps && (
                    <div className="space-y-3">
                      {feature.steps.map((step, stepIdx) => (
                        <div key={step.title} className="flex gap-3 items-start">
                          <span className="h-7 w-7 rounded-full bg-secondary/50 border border-border text-foreground/80 text-xs flex items-center justify-center">
                            {stepIdx + 1}
                          </span>
                          <div className="space-y-1">
                            <p className="text-sm font-semibold text-foreground">{step.title}</p>
                            {step.detail && <p className="text-xs text-muted-foreground leading-relaxed">{step.detail}</p>}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {feature.stats && (
                    <div className="grid grid-cols-2 gap-3">
                      {feature.stats.map((stat) => (
                        <div key={stat.label} className="rounded-2xl border border-border bg-muted/50 p-3">
                          <p className="text-xs text-muted-foreground">{stat.label}</p>
                          <p className="text-base font-semibold text-foreground">{stat.value}</p>
                          {stat.sub && <p className="text-[11px] text-muted-foreground mt-1 leading-tight">{stat.sub}</p>}
                        </div>
                      ))}
                    </div>
                  )}

                  {feature.swatches && (
                    <div className="flex flex-wrap gap-2">
                      {feature.swatches.map((swatch) => {
                        const background =
                          swatch.colors.length > 1 || swatch.colors[0].startsWith("linear-gradient")
                            ? swatch.colors[0].startsWith("linear-gradient")
                              ? swatch.colors[0]
                              : `linear-gradient(135deg, ${swatch.colors.join(",")})`
                            : swatch.colors[0];

                        return (
                          <div key={swatch.label} className="flex items-center gap-2 rounded-xl border border-border bg-muted/50 px-3 py-2">
                            <span className="h-6 w-6 rounded-lg border border-border" style={{ background }} />
                            <span className="text-xs text-foreground/80">{swatch.label}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {feature.sample && (
                    <div className="rounded-2xl border border-border bg-muted/50 p-4 space-y-2">
                      <p className="text-sm font-semibold text-foreground">{feature.sample.title}</p>
                      <p className="text-xs text-foreground/70">{feature.sample.subtitle}</p>
                      {feature.sample.tags && (
                        <div className="flex flex-wrap gap-2 pt-1">
                          {feature.sample.tags.map((tag) => (
                            <span key={tag} className="text-[11px] px-2.5 py-1 rounded-full bg-secondary border border-border text-foreground/80">
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {feature.chips && (
                    <div className="flex flex-wrap gap-2">
                      {feature.chips.map((chip) => (
                        <span key={chip} className="text-xs px-3 py-1 rounded-full bg-secondary border border-border text-foreground/80">
                          {chip}
                        </span>
                      ))}
                    </div>
                  )}

                  {feature.footnote && <p className="text-xs text-muted-foreground leading-relaxed">{feature.footnote}</p>}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="py-28 bg-muted/20 border-y border-border backdrop-blur-sm relative overflow-hidden">
        <div className="absolute inset-0 bg-fine-grid opacity-100 dark:opacity-100" />
        <div className="absolute inset-0 bg-gradient-to-b from-background via-transparent to-background pointer-events-none" />

        <div className="relative z-10">
          <div className="text-center mb-16 px-6">
            <h2 className="text-3xl md:text-5xl font-bold mb-6" data-animate>
              {t("landing.lovedByCreators")}
            </h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto" data-animate style={{ ["--delay" as any]: "0.1s" }}>
              {t("landing.lovedByCreatorsDescription")}
            </p>
          </div>

          <div className="relative">
            <div className="absolute left-0 top-0 bottom-0 w-32 bg-gradient-to-r from-background to-transparent z-10 pointer-events-none" />
            <div className="absolute right-0 top-0 bottom-0 w-32 bg-gradient-to-l from-background to-transparent z-10 pointer-events-none" />

            <div className="overflow-hidden" data-animate style={{ ["--delay" as any]: "0.2s" }}>
              <div className="flex gap-6 animate-scroll-left" style={{ width: 'max-content' }}>
                {[
                  {
                    text: t("testimonials.testimonial1.text"),
                    author: t("testimonials.testimonial1.author"),
                    role: t("testimonials.testimonial1.role"),
                    avatar: "SJ"
                  },
                  {
                    text: t("testimonials.testimonial2.text"),
                    author: t("testimonials.testimonial2.author"),
                    role: t("testimonials.testimonial2.role"),
                    avatar: "MC"
                  },
                  {
                    text: t("testimonials.testimonial3.text"),
                    author: t("testimonials.testimonial3.author"),
                    role: t("testimonials.testimonial3.role"),
                    avatar: "JL"
                  },
                  {
                    text: t("testimonials.testimonial4.text"),
                    author: t("testimonials.testimonial4.author"),
                    role: t("testimonials.testimonial4.role"),
                    avatar: "DP"
                  },
                  {
                    text: t("testimonials.testimonial5.text"),
                    author: t("testimonials.testimonial5.author"),
                    role: t("testimonials.testimonial5.role"),
                    avatar: "EW"
                  },
                  {
                    text: t("testimonials.testimonial6.text"),
                    author: t("testimonials.testimonial6.author"),
                    role: t("testimonials.testimonial6.role"),
                    avatar: "AR"
                  }
                ].map((testimonial, i) => (
                  <div key={`first-${i}`} className="flex-shrink-0 w-[400px] glass-panel p-8 rounded-2xl hover:bg-muted/50 transition-all duration-300 hover:scale-[1.02] cursor-default group">
                    <Quote className="w-8 h-8 text-primary mb-6 opacity-50 group-hover:opacity-100 transition-opacity" />
                    <p className="text-lg text-foreground/90 mb-6 leading-relaxed">"{testimonial.text}"</p>
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-rose-500 to-pink-600 flex items-center justify-center text-white font-bold text-sm">
                        {testimonial.avatar}
                      </div>
                      <div>
                        <p className="font-bold text-foreground">{testimonial.author}</p>
                        <p className="text-sm text-muted-foreground">{testimonial.role}</p>
                      </div>
                    </div>
                  </div>
                ))}
                {[
                  {
                    text: t("testimonials.testimonial1.text"),
                    author: t("testimonials.testimonial1.author"),
                    role: t("testimonials.testimonial1.role"),
                    avatar: "SJ"
                  },
                  {
                    text: t("testimonials.testimonial2.text"),
                    author: t("testimonials.testimonial2.author"),
                    role: t("testimonials.testimonial2.role"),
                    avatar: "MC"
                  },
                  {
                    text: t("testimonials.testimonial3.text"),
                    author: t("testimonials.testimonial3.author"),
                    role: t("testimonials.testimonial3.role"),
                    avatar: "JL"
                  },
                  {
                    text: t("testimonials.testimonial4.text"),
                    author: t("testimonials.testimonial4.author"),
                    role: t("testimonials.testimonial4.role"),
                    avatar: "DP"
                  },
                  {
                    text: t("testimonials.testimonial5.text"),
                    author: t("testimonials.testimonial5.author"),
                    role: t("testimonials.testimonial5.role"),
                    avatar: "EW"
                  },
                  {
                    text: t("testimonials.testimonial6.text"),
                    author: t("testimonials.testimonial6.author"),
                    role: t("testimonials.testimonial6.role"),
                    avatar: "AR"
                  }
                ].map((testimonial, i) => (
                  <div key={`second-${i}`} className="flex-shrink-0 w-[400px] glass-panel p-8 rounded-2xl hover:bg-muted/50 transition-all duration-300 hover:scale-[1.02] cursor-default group">
                    <Quote className="w-8 h-8 text-primary mb-6 opacity-50 group-hover:opacity-100 transition-opacity" />
                    <p className="text-lg text-foreground/90 mb-6 leading-relaxed">"{testimonial.text}"</p>
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-rose-500 to-pink-600 flex items-center justify-center text-white font-bold text-sm">
                        {testimonial.avatar}
                      </div>
                      <div>
                        <p className="font-bold text-foreground">{testimonial.author}</p>
                        <p className="text-sm text-muted-foreground">{testimonial.role}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="py-28 px-6 relative">
        <div className="container mx-auto max-w-7xl">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-5xl font-bold mb-6" data-animate>
              {t("landing.simplePricing")}
            </h2>
            <p className="text-muted-foreground text-lg mb-8" data-animate style={{ ["--delay" as any]: "0.1s" }}>
              {t("landing.simplePricingDescription")}
            </p>

            <div className="flex items-center justify-center gap-4" data-animate style={{ ["--delay" as any]: "0.2s" }}>
              <span className={`text-sm font-medium transition-colors ${billingInterval === "monthly" ? "text-foreground" : "text-muted-foreground"}`}>
                {t("common.monthly")}
              </span>
              <button
                onClick={() => setBillingInterval(billingInterval === "monthly" ? "yearly" : "monthly")}
                className={`relative inline-flex h-7 w-14 items-center rounded-full transition-colors ${billingInterval === "yearly" ? "bg-primary" : "bg-muted"
                  }`}
              >
                <span
                  className={`inline-block h-5 w-5 transform rounded-full bg-background shadow-lg transition-transform ${billingInterval === "yearly" ? "translate-x-8" : "translate-x-1"
                    }`}
                />
              </button>
              <span className={`text-sm font-medium transition-colors ${billingInterval === "yearly" ? "text-foreground" : "text-muted-foreground"}`}>
                {t("common.yearly")}
              </span>
              {billingInterval === "yearly" && (
                <span className="text-xs font-bold bg-gradient-to-r from-rose-500 to-pink-500 text-white px-3 py-1 rounded-full animate-pulse">
                  {t("landing.save20")}
                </span>
              )}
            </div>
          </div>

          <div className="grid md:grid-cols-4 gap-6 max-w-6xl mx-auto">
            {subscriptionPlans.map((plan, idx) => {
              const isFree = !plan.priceId;
              const monthlyPrice = parseFloat(plan.monthlyPrice.replace("$", ""));
              const discountedMonthlyPrice = monthlyPrice * 0.8;

              return (
                <div
                  key={plan.name}
                  className={`relative p-6 rounded-3xl border backdrop-blur-sm flex flex-col transition-all duration-300 hover:scale-[1.02] hover:shadow-xl ${plan.popular
                    ? 'border-primary bg-primary/10 shadow-lg shadow-primary/20'
                    : 'border-border bg-card/50 hover:border-foreground/20'
                    }`}
                  data-animate
                  style={{ ["--delay" as any]: `${0.08 * idx}s` }}
                >
                  {plan.popular && (
                    <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-gradient-to-r from-rose-500 to-pink-500 text-white text-sm font-bold shadow-lg">
                      {t("common.mostPopular")}
                    </div>
                  )}
                  <div className="mb-6">
                    <h3 className="text-xl font-bold mb-3">{plan.name}</h3>
                    <div className="min-h-[80px]">
                      {billingInterval === "monthly" ? (
                        <div className="flex items-baseline gap-1">
                          <span className="text-4xl font-bold text-foreground">{plan.monthlyPrice}</span>
                          {!isFree && <span className="text-muted-foreground">{t("landing.perMonth")}</span>}
                        </div>
                      ) : (
                        <>
                          {!isFree ? (
                            <>
                              <div className="flex items-baseline gap-2">
                                <span className="text-lg text-muted-foreground line-through">
                                  {plan.monthlyPrice}
                                </span>
                                <span className="text-4xl font-bold text-foreground">
                                  ${discountedMonthlyPrice.toFixed(2)}
                                </span>
                              </div>
                              <span className="text-muted-foreground text-sm">{t("landing.perMonth")}</span>
                              <div className="text-xs text-muted-foreground mt-1">
                                {t("landing.billedAnnually")} {plan.yearlyPrice}
                              </div>
                            </>
                          ) : (
                            <div className="flex items-baseline gap-1">
                              <span className="text-4xl font-bold text-foreground">{plan.monthlyPrice}</span>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                    <p className="text-muted-foreground mt-2 text-sm">{plan.desc}</p>
                  </div>
                  <ul className="space-y-3 mb-6 flex-1">
                    {plan.features.map((feature, j) => (
                      <li key={j} className="flex items-start gap-3">
                        <Check className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                        <span className="text-sm text-foreground/80">{feature}</span>
                      </li>
                    ))}
                  </ul>
                  <Button
                    className={`w-full h-12 rounded-xl font-bold text-base transition-all beam-button ${plan.popular
                      ? 'bg-primary text-primary-foreground hover:bg-primary/90 hover:shadow-lg'
                      : 'bg-secondary hover:bg-secondary/80 text-foreground border border-border'
                      }`}
                    onClick={() => navigate("/auth")}
                  >
                    {isFree ? t("common.getStartedButton") : t("common.startNow")}
                  </Button>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <footer className="border-t border-border py-12 bg-background/40 backdrop-blur-xl">
        <div className="container mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8">
              <img
                src="/favicon.png"
                alt="Vizion - AI-Powered YouTube Thumbnail Generator Logo"
                className="w-full h-full rounded-lg object-contain shadow-md shadow-primary/20"
              />
            </div>
            <span className="font-bold text-lg">Vizion</span>
          </div>
          <div className="text-sm text-muted-foreground">
            {t("footer.copyright")}
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;
