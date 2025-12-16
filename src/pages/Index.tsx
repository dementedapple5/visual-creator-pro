import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
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

const subscriptionPlans = [
  {
    name: "Free",
    monthlyPrice: "$0",
    yearlyPrice: "$0",
    priceId: null,
    yearlyPriceId: null,
    productId: null,
    desc: "Perfect for trying out Vizion",
    features: [
      "1 thumbnail/day",
      "HD resolution",
      "Email support"
    ]
  },
  {
    name: "Starter",
    monthlyPrice: "$17.99",
    yearlyPrice: "$172.70",
    monthlySavings: null,
    yearlySavings: "20%",
    priceId: "price_1SX0vtISMAOMUNUM7hJ7Mk45",
    yearlyPriceId: "price_1SXHyGISMAOMUNUMx0LrXEZg",
    productId: "prod_TTytxm2oUYxzXe",
    desc: "For casual creators",
    features: [
      "50 HD thumbnails/month",
      "2K resolution",
      "Email support"
    ]
  },
  {
    name: "Pro",
    monthlyPrice: "$29.99",
    yearlyPrice: "$287.90",
    monthlySavings: null,
    yearlySavings: "20%",
    priceId: "price_1SXHwFISMAOMUNUM0syTOyVg",
    yearlyPriceId: "price_1SXI02ISMAOMUNUMd8oTYJPc",
    productId: "prod_TUGTkbIPU5H2pn",
    popular: true,
    desc: "For serious creators",
    features: [
      "100 HD thumbnails/month",
      "2K resolution",
      "Priority support"
    ]
  },
  {
    name: "Enterprise",
    monthlyPrice: "$99.99",
    yearlyPrice: "$959.90",
    monthlySavings: null,
    yearlySavings: "20%",
    priceId: "price_1SX0wNISMAOMUNUMTz5N3THc",
    yearlyPriceId: "price_1SXI0FISMAOMUNUMgfSnO0Y0",
    productId: "prod_TTyuNeWPfbeOFz",
    desc: "For teams and agencies",
    features: [
      "300 HD thumbnails/month",
      "4K resolution",
      "24/7 support"
    ]
  }
];

const rotatingWords = [
  "Thumbnails",
  "Viral Covers",
  "Channel Art",
  "Video Intros",
  "Hooks"
];

const bentoFeatures = [
  {
    title: "Guided thumbnail builder",
    desc: "Move through avatar, elements, text, and background without losing context.",
    icon: Sparkles,
    badge: "Create flow",
    span: "lg:col-span-3",
    steps: [
      { title: "Avatar stage", detail: "Pick saved faces or upload, set expressions, place them." },
      { title: "Elements board", detail: "Drop up to 3 elements or uploads and choose positions." },
      { title: "Canvas controls", detail: "Live preview, remix, and download from the same screen." }
    ],
    footnote: "Aspect ratios ready: 16:9, 9:16, 1:1, 4:3."
  },
  {
    title: "Avatar capture & reuse",
    desc: "Upload images or grab frames from a video, then reuse them anywhere in Create.",
    icon: Camera,
    badge: "Face library",
    span: "lg:col-span-3",
    stats: [
      { label: "Imports", value: "Images", sub: "PNG/JPG auto-compressed for upload" },
      { label: "Capture", value: "Video frames", sub: "Pause and save the still you want" },
      { label: "Limits", value: "1 free slot", sub: "Add more when subscribed" },
      { label: "Control", value: "Delete anytime", sub: "Cleans up storage + record" }
    ],
    footnote: "Works with avatar-based backgrounds, expressions, and positioning."
  },
  {
    title: "Background recipes",
    desc: "Save gradients, solids, uploads, avatar-sourced scenes, or prompt text and reapply.",
    icon: Palette,
    badge: "Reusable",
    span: "lg:col-span-2",
    swatches: [
      { label: "Gradient", colors: ["#FF6B9D", "#C239B3"] },
      { label: "Solid", colors: ["#0EA5E9"] },
      { label: "Upload / Avatar", colors: ["linear-gradient(135deg, #0f172a, #6366f1)"] }
    ],
    chips: ["Gradient", "Solid color", "Image upload", "From avatar", "Custom prompt"],
    footnote: "Apply from the Backgrounds library or inside the Create flow."
  },
  {
    title: "Title bank & placement",
    desc: "Keep headline/subtitle pairs with text style and placement ready to drop in.",
    icon: Type,
    badge: "Text presets",
    span: "lg:col-span-2",
    sample: {
      title: "Launch the new drop",
      subtitle: "Swap fonts & positions without retyping",
      tags: ["Bold & Large", "Top center", "Saved to reuse"]
    }
  },
  {
    title: "Elements board",
    desc: "Attach up to 3 elements or uploads, then set per-element placement.",
    icon: LayoutGrid,
    badge: "3 slots",
    span: "lg:col-span-2",
    stats: [
      { label: "Positions", value: "9 options", sub: "Top/center/bottom presets" },
      { label: "Sources", value: "Catalog + uploads", sub: "Mix element records and custom PNGs" }
    ],
    chips: ["Per-element placement", "Order indicators", "Works with elements or custom files"]
  },
  {
    title: "Remix & exports",
    desc: "Regenerate from any output with extra instructions, then download instantly.",
    icon: Repeat2,
    badge: "Outputs",
    span: "lg:col-span-4",
    steps: [
      { title: "Remix prompt", detail: "Adjust color, text, or layout from the active preview." },
      { title: "Downloads", detail: "One-click PNG export from the canvas gallery." }
    ],
    stats: [
      { label: "Limits enforced", value: "Quota aware", sub: "Free: 1/day • Starter: 50/mo • Pro: 100/mo" }
    ],
    footnote: "Each generation saves to your thumbnails list automatically."
  }
];

const Index = () => {
  const navigate = useNavigate();
  const [billingInterval, setBillingInterval] = useState<"monthly" | "yearly">("yearly");
  const [displayedWord, setDisplayedWord] = useState(rotatingWords[0].slice(0, 1));
  const [wordIndex, setWordIndex] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);

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

  return (
    <div className="min-h-screen bg-background overflow-hidden selection:bg-primary/20 font-sans relative">
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute inset-0 bg-grid-white/[0.03]" />
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

      <nav className="fixed top-0 w-full z-50 border-b border-white/5 bg-background/60 backdrop-blur-xl transition-all duration-300">
        <div className="container mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10">
              <img
                src="/favicon.png"
                alt="Vizion logo"
                className="w-full h-full rounded-xl  object-contain shadow-lg shadow-primary/20 bg-white/80"
              />
            </div>
            <span className="font-bold text-xl tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-white/60">
              VIZION
            </span>
          </div>
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              className="text-muted-foreground hover:text-white transition-colors hidden sm:flex beam-button"
              onClick={() => navigate("/auth")}
            >
              Sign In
            </Button>
            <Button
              onClick={() => navigate("/auth")}
              className="bg-white text-black hover:bg-white/90 rounded-full px-6 shadow-glow transition-all beam-button"
            >
              Get Started
            </Button>
          </div>
        </div>
      </nav>

      <section className="relative pt-32 pb-24 px-6 min-h-[80vh] flex items-center">
        <div className="container mx-auto max-w-5xl flex flex-col items-center text-center gap-10">
          <div
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 backdrop-blur-md"
            data-animate
          >
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-70"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400"></span>
            </span>
            <span className="text-sm text-muted-foreground font-medium">Gemini 3 Pro + Vizion Render</span>
          </div>

          <div className="space-y-4 w-full">
            <h1 className="text-4xl md:text-6xl xl:text-7xl leading-[1.05] tracking-tight w-full">
              <span
                className="hero-font-primary text-balance block w-full"
                data-animate
                style={{ ["--delay" as any]: "0.05s" }}
              >
                Create Viral YouTube
              </span>
              <span
                className="hero-font-secondary text-gradient text-balance block w-full pb-2"
                data-animate
                style={{ ["--delay" as any]: "0.15s" }}
              >
                thumbnails that get clicks
              </span>
              <span
                className="flex flex-wrap justify-center items-center gap-3 text-lg md:text-xl text-muted-foreground/90 hero-type w-full"
                data-animate
                style={{ ["--delay" as any]: "0.25s" }}
              >
                Fast & Professional
                <span className="typewriter text-white">{displayedWord}</span>
                <span className="type-caret" aria-hidden="true" />
              </span>
            </h1>
          </div>

          <p
            className="text-lg md:text-xl text-muted-foreground max-w-4xl w-full leading-relaxed"
            data-animate
            style={{ ["--delay" as any]: "0.35s" }}
          >
            The specialized design tool for YouTubers. Upload your face, drag in elements, and generate high-CTR thumbnails in seconds. No generic templates—just results.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center pt-2">
            <Button
              size="lg"
              onClick={() => navigate("/auth")}
              className="h-14 px-8 rounded-full bg-white text-black hover:bg-white/90 text-lg transition-all beam-button"
              data-animate
              style={{ ["--delay" as any]: "0.45s" }}
            >
              Start Creating Free
              <ArrowRight className="ml-2 w-5 h-5" />
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="h-14 px-8 rounded-full border-white/10 hover:bg-white/5 backdrop-blur-sm transition-all beam-button"
              data-animate
              style={{ ["--delay" as any]: "0.55s" }}
            >
              <Play className="mr-2 w-5 h-5" />
              Watch Demo
            </Button>
          </div>
        </div>
      </section>

      <InfiniteScrollExamples />

      <HowItWorks />

      <section className="py-28 px-6 relative z-10">
        <div className="container mx-auto max-w-7xl">
          <div className="text-center mb-16 space-y-3">
            <h2 className="text-3xl md:text-5xl font-bold" data-animate>
              What you can do in Vizion today
            </h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto" data-animate style={{ ["--delay" as any]: "0.1s" }}>
              Build thumbnails with the pieces you already have—avatars, backgrounds, titles, elements—and keep every step in one place.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-6">
            {bentoFeatures.map((feature, idx) => {
              const Icon = feature.icon;
              return (
                <div
                  key={feature.title}
                  className={`relative overflow-hidden rounded-3xl border border-white/10 bg-white/[0.04] backdrop-blur-xl p-6 flex flex-col gap-4 ${feature.span}`}
                  data-animate
                  style={{ ["--delay" as any]: `${0.05 * idx}s` }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Icon className="w-5 h-5 text-white" />
                      <h3 className="text-xl font-semibold text-white">{feature.title}</h3>
                    </div>
                    <span className="px-3 py-1 rounded-full bg-white/10 text-xs text-white">{feature.badge}</span>
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed">{feature.desc}</p>
                  {feature.steps && (
                    <div className="space-y-3">
                      {feature.steps.map((step, stepIdx) => (
                        <div key={step.title} className="flex gap-3 items-start">
                          <span className="h-7 w-7 rounded-full bg-white/5 border border-white/10 text-white/80 text-xs flex items-center justify-center">
                            {stepIdx + 1}
                          </span>
                          <div className="space-y-1">
                            <p className="text-sm font-semibold text-white">{step.title}</p>
                            {step.detail && <p className="text-xs text-muted-foreground leading-relaxed">{step.detail}</p>}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {feature.stats && (
                    <div className="grid grid-cols-2 gap-3">
                      {feature.stats.map((stat) => (
                        <div key={stat.label} className="rounded-2xl border border-white/10 bg-white/5 p-3">
                          <p className="text-xs text-muted-foreground">{stat.label}</p>
                          <p className="text-base font-semibold text-white">{stat.value}</p>
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
                          <div key={swatch.label} className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                            <span className="h-6 w-6 rounded-lg border border-white/10" style={{ background }} />
                            <span className="text-xs text-white/80">{swatch.label}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {feature.sample && (
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-2">
                      <p className="text-sm font-semibold text-white">{feature.sample.title}</p>
                      <p className="text-xs text-white/70">{feature.sample.subtitle}</p>
                      {feature.sample.tags && (
                        <div className="flex flex-wrap gap-2 pt-1">
                          {feature.sample.tags.map((tag) => (
                            <span key={tag} className="text-[11px] px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-white/80">
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
                        <span key={chip} className="text-xs px-3 py-1 rounded-full bg-white/5 border border-white/10 text-white/80">
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

      <section className="py-28 bg-white/[0.02] border-y border-white/5 backdrop-blur-sm relative overflow-hidden">
        <div className="absolute inset-0 bg-fine-grid opacity-100" />
        <div className="absolute inset-0 bg-gradient-to-b from-background via-transparent to-background pointer-events-none" />

        <div className="relative z-10">
          <div className="text-center mb-16 px-6">
            <h2 className="text-3xl md:text-5xl font-bold mb-6" data-animate>
              Loved by Creators
            </h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto" data-animate style={{ ["--delay" as any]: "0.1s" }}>
              Join thousands of content creators who trust Vizion to create stunning thumbnails.
            </p>
          </div>

          <div className="relative">
            <div className="absolute left-0 top-0 bottom-0 w-32 bg-gradient-to-r from-background to-transparent z-10 pointer-events-none" />
            <div className="absolute right-0 top-0 bottom-0 w-32 bg-gradient-to-l from-background to-transparent z-10 pointer-events-none" />

            <div className="overflow-hidden" data-animate style={{ ["--delay" as any]: "0.2s" }}>
              <div className="flex gap-6 animate-scroll-left" style={{ width: 'max-content' }}>
                {[
                  {
                    text: "Vizion has completely changed my workflow. I used to spend hours on thumbnails, now it takes minutes.",
                    author: "Sarah Jenkins",
                    role: "Tech YouTuber (500k subs)",
                    avatar: "SJ"
                  },
                  {
                    text: "The quality of the AI generation is mind-blowing. It understands exactly what I want from a simple prompt.",
                    author: "Mike Chen",
                    role: "Gaming Streamer",
                    avatar: "MC"
                  },
                  {
                    text: "Finally, a tool that actually helps me get more clicks. My CTR has increased by 40% since using Vizion.",
                    author: "Jessica Lee",
                    role: "Lifestyle Vlogger",
                    avatar: "JL"
                  },
                  {
                    text: "I've tried every thumbnail tool out there. Vizion is the only one that consistently delivers professional results.",
                    author: "David Park",
                    role: "Finance Educator",
                    avatar: "DP"
                  },
                  {
                    text: "The speed is incredible. I can iterate through dozens of ideas in the time it used to take me to make one.",
                    author: "Emma Wilson",
                    role: "Travel Creator",
                    avatar: "EW"
                  },
                  {
                    text: "My subscribers always comment on how great my thumbnails look now. This tool is a game changer.",
                    author: "Alex Rivera",
                    role: "Music Producer",
                    avatar: "AR"
                  }
                ].map((testimonial, i) => (
                  <div key={`first-${i}`} className="flex-shrink-0 w-[400px] glass-panel p-8 rounded-2xl hover:bg-white/10 transition-all duration-300 hover:scale-[1.02] cursor-default group">
                    <Quote className="w-8 h-8 text-primary mb-6 opacity-50 group-hover:opacity-100 transition-opacity" />
                    <p className="text-lg text-white/90 mb-6 leading-relaxed">"{testimonial.text}"</p>
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-rose-500 to-pink-600 flex items-center justify-center text-white font-bold text-sm">
                        {testimonial.avatar}
                      </div>
                      <div>
                        <p className="font-bold text-white">{testimonial.author}</p>
                        <p className="text-sm text-white/50">{testimonial.role}</p>
                      </div>
                    </div>
                  </div>
                ))}
                {[
                  {
                    text: "Vizion has completely changed my workflow. I used to spend hours on thumbnails, now it takes minutes.",
                    author: "Sarah Jenkins",
                    role: "Tech YouTuber (500k subs)",
                    avatar: "SJ"
                  },
                  {
                    text: "The quality of the AI generation is mind-blowing. It understands exactly what I want from a simple prompt.",
                    author: "Mike Chen",
                    role: "Gaming Streamer",
                    avatar: "MC"
                  },
                  {
                    text: "Finally, a tool that actually helps me get more clicks. My CTR has increased by 40% since using Vizion.",
                    author: "Jessica Lee",
                    role: "Lifestyle Vlogger",
                    avatar: "JL"
                  },
                  {
                    text: "I've tried every thumbnail tool out there. Vizion is the only one that consistently delivers professional results.",
                    author: "David Park",
                    role: "Finance Educator",
                    avatar: "DP"
                  },
                  {
                    text: "The speed is incredible. I can iterate through dozens of ideas in the time it used to take me to make one.",
                    author: "Emma Wilson",
                    role: "Travel Creator",
                    avatar: "EW"
                  },
                  {
                    text: "My subscribers always comment on how great my thumbnails look now. This tool is a game changer.",
                    author: "Alex Rivera",
                    role: "Music Producer",
                    avatar: "AR"
                  }
                ].map((testimonial, i) => (
                  <div key={`second-${i}`} className="flex-shrink-0 w-[400px] glass-panel p-8 rounded-2xl hover:bg-white/10 transition-all duration-300 hover:scale-[1.02] cursor-default group">
                    <Quote className="w-8 h-8 text-primary mb-6 opacity-50 group-hover:opacity-100 transition-opacity" />
                    <p className="text-lg text-white/90 mb-6 leading-relaxed">"{testimonial.text}"</p>
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-rose-500 to-pink-600 flex items-center justify-center text-white font-bold text-sm">
                        {testimonial.avatar}
                      </div>
                      <div>
                        <p className="font-bold text-white">{testimonial.author}</p>
                        <p className="text-sm text-white/50">{testimonial.role}</p>
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
              Simple Pricing
            </h2>
            <p className="text-muted-foreground text-lg mb-8" data-animate style={{ ["--delay" as any]: "0.1s" }}>
              Start for free, upgrade when you grow.
            </p>

            <div className="flex items-center justify-center gap-4" data-animate style={{ ["--delay" as any]: "0.2s" }}>
              <span className={`text-sm font-medium transition-colors ${billingInterval === "monthly" ? "text-white" : "text-muted-foreground"}`}>
                Monthly
              </span>
              <button
                onClick={() => setBillingInterval(billingInterval === "monthly" ? "yearly" : "monthly")}
                className={`relative inline-flex h-7 w-14 items-center rounded-full transition-colors ${billingInterval === "yearly" ? "bg-primary" : "bg-white/20"
                  }`}
              >
                <span
                  className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-lg transition-transform ${billingInterval === "yearly" ? "translate-x-8" : "translate-x-1"
                    }`}
                />
              </button>
              <span className={`text-sm font-medium transition-colors ${billingInterval === "yearly" ? "text-white" : "text-muted-foreground"}`}>
                Yearly
              </span>
              {billingInterval === "yearly" && (
                <span className="text-xs font-bold bg-gradient-to-r from-rose-500 to-pink-500 text-white px-3 py-1 rounded-full animate-pulse">
                  Save 20%
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
                    : 'border-white/10 bg-white/5 hover:border-white/20'
                    }`}
                  data-animate
                  style={{ ["--delay" as any]: `${0.08 * idx}s` }}
                >
                  {plan.popular && (
                    <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-gradient-to-r from-rose-500 to-pink-500 text-white text-sm font-bold shadow-lg">
                      Most Popular
                    </div>
                  )}
                  <div className="mb-6">
                    <h3 className="text-xl font-bold mb-3">{plan.name}</h3>
                    <div className="min-h-[80px]">
                      {billingInterval === "monthly" ? (
                        <div className="flex items-baseline gap-1">
                          <span className="text-4xl font-bold text-white">{plan.monthlyPrice}</span>
                          {!isFree && <span className="text-muted-foreground">/month</span>}
                        </div>
                      ) : (
                        <>
                          {!isFree ? (
                            <>
                              <div className="flex items-baseline gap-2">
                                <span className="text-lg text-muted-foreground line-through">
                                  {plan.monthlyPrice}
                                </span>
                                <span className="text-4xl font-bold text-white">
                                  ${discountedMonthlyPrice.toFixed(2)}
                                </span>
                              </div>
                              <span className="text-muted-foreground text-sm">/month</span>
                              <div className="text-xs text-muted-foreground mt-1">
                                Billed annually at {plan.yearlyPrice}
                              </div>
                            </>
                          ) : (
                            <div className="flex items-baseline gap-1">
                              <span className="text-4xl font-bold text-white">{plan.monthlyPrice}</span>
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
                        <span className="text-sm text-white/80">{feature}</span>
                      </li>
                    ))}
                  </ul>
                  <Button
                    className={`w-full h-12 rounded-xl font-bold text-base transition-all beam-button ${plan.popular
                      ? 'bg-white text-black hover:bg-white/90 hover:shadow-lg'
                      : 'bg-white/10 hover:bg-white/20 text-white border border-white/10'
                      }`}
                    onClick={() => navigate("/auth")}
                  >
                    {isFree ? "Get Started" : "Start Now"}
                  </Button>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <footer className="border-t border-white/10 py-12 bg-black/40 backdrop-blur-xl">
        <div className="container mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8">
              <img
                src="/favicon.png"
                alt="Vizion logo"
                className="w-full h-full rounded-lg object-contain shadow-md shadow-primary/20"
              />
            </div>
            <span className="font-bold text-lg">Vizion</span>
          </div>
          <div className="text-sm text-muted-foreground">
            © 2024 Vizion AI. All rights reserved.
          </div>
          <div className="flex gap-8 text-sm text-muted-foreground">
            <a href="#" className="hover:text-white transition-colors">Privacy</a>
            <a href="#" className="hover:text-white transition-colors">Terms</a>
            <a href="#" className="hover:text-white transition-colors">Twitter</a>
            <a href="#" className="hover:text-white transition-colors">Discord</a>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;
