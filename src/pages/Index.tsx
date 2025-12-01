import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { CheckCircle2, ArrowRight, Play, Quote, Check } from "lucide-react";

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

const Index = () => {
  const navigate = useNavigate();
  const parallaxRef = useRef<HTMLDivElement>(null);
  const [billingInterval, setBillingInterval] = useState<"monthly" | "yearly">("yearly");

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        navigate("/dashboard");
      }
    });

    const handleScroll = () => {
      if (parallaxRef.current) {
        const scrolled = window.scrollY;
        parallaxRef.current.style.transform = `translateY(${scrolled * 0.5}px)`;
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [navigate]);

  return (
    <div className="min-h-screen bg-background overflow-hidden selection:bg-primary/20 font-sans">
      {/* Dynamic Background */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute inset-0 bg-grid-white/[0.02] bg-[size:50px_50px]" />
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-purple-500/10 rounded-full blur-[120px] animate-float" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-blue-500/10 rounded-full blur-[120px] animate-float-delayed" />
      </div>

      {/* Navigation */}
      <nav className="fixed top-0 w-full z-50 border-b border-white/5 bg-background/50 backdrop-blur-xl transition-all duration-300">
        <div className="container mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-blue-600 flex items-center justify-center shadow-lg shadow-purple-500/20">
              <span className="font-bold text-xl text-white">V</span>
            </div>
            <span className="font-bold text-xl tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-white/60">Vizion</span>
          </div>
          <div className="flex items-center gap-4">
            <Button variant="ghost" className="text-muted-foreground hover:text-white transition-colors hidden sm:flex" onClick={() => navigate("/auth")}>
              Sign In
            </Button>
            <Button onClick={() => navigate("/auth")} className="bg-white text-black hover:bg-white/90 rounded-full px-6 shadow-glow transition-all hover:scale-105">
              Get Started
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 px-6 min-h-screen flex items-center">
        <div className="container mx-auto max-w-7xl grid lg:grid-cols-2 gap-12 items-center">
          <div className="space-y-8 relative z-10 text-center lg:text-left">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 backdrop-blur-md animate-fade-in hover:bg-white/10 transition-colors cursor-default">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
              </span>
              <span className="text-sm text-muted-foreground font-medium">Powered by Gemini 3 Pro</span>
            </div>

            <h1 className="text-5xl md:text-7xl font-bold tracking-tight animate-slide-up-fade leading-[1.1]">
              Create Viral <br />
              <span className="text-gradient bg-gradient-to-r from-purple-400 via-pink-400 to-blue-400">Thumbnails</span> <br />
              in Seconds
            </h1>

            <p className="text-xl text-muted-foreground max-w-2xl mx-auto lg:mx-0 animate-slide-up-fade leading-relaxed" style={{ animationDelay: '0.1s' }}>
              Stop wasting hours on design. Generate professional, click-worthy YouTube thumbnails instantly using our advanced AI models.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start pt-4 animate-slide-up-fade" style={{ animationDelay: '0.2s' }}>
              <Button size="lg" onClick={() => navigate("/auth")} className="h-14 px-8 rounded-full bg-white text-black hover:bg-white/90 text-lg transition-all hover:scale-105 hover:shadow-[0_0_40px_-10px_rgba(255,255,255,0.3)]">
                Start Creating Free
                <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
              <Button size="lg" variant="outline" className="h-14 px-8 rounded-full border-white/10 hover:bg-white/5 backdrop-blur-sm transition-all hover:scale-105">
                <Play className="mr-2 w-5 h-5" />
                Watch Demo
              </Button>
            </div>

            <div className="pt-8 flex items-center justify-center lg:justify-start gap-4 text-sm text-muted-foreground animate-slide-up-fade" style={{ animationDelay: '0.3s' }}>
              <div className="flex -space-x-2">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="w-8 h-8 rounded-full border-2 border-background bg-zinc-800 flex items-center justify-center text-xs font-bold text-white">
                    {String.fromCharCode(64 + i)}
                  </div>
                ))}
              </div>
              <p>Trusted by 10,000+ creators</p>
            </div>
          </div>

          {/* Hero Visual */}
          <div className="relative z-10 animate-slide-up-fade lg:h-[600px] flex items-center justify-center" style={{ animationDelay: '0.4s' }}>
            <div ref={parallaxRef} className="relative w-full max-w-lg aspect-square">
              {/* Using the generated hero image */}
              <img
                src="/hero_glass.png"
                alt="Abstract Glass Hero"
                className="w-full h-full object-contain drop-shadow-2xl animate-float"
              />
              {/* Floating Elements */}
              <div className="absolute -top-10 -right-10 glass-panel p-4 rounded-2xl animate-float-delayed backdrop-blur-xl border border-white/20">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
                    <CheckCircle2 className="w-5 h-5 text-green-400" />
                  </div>
                  <div>
                    <p className="font-bold text-white">Generated!</p>
                    <p className="text-xs text-white/60">0.8s processing time</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-32 px-6 relative z-10">
        <div className="container mx-auto max-w-7xl">
          <div className="text-center mb-24 space-y-4">
            <h2 className="text-3xl md:text-5xl font-bold">Everything you need</h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              Powerful features designed to help you create the perfect thumbnail for your content.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                title: "AI Generation",
                desc: "Describe your idea and let our advanced AI models generate stunning visuals instantly.",
                image: "/feature_ai.png"
              },
              {
                title: "Lightning Fast",
                desc: "Get results in seconds. Iterate quickly and find the perfect design for your video.",
                image: "/ray.png"
              },
              {
                title: "Smart Editing",
                desc: "Fine-tune every detail. Adjust composition, lighting, and style with simple controls.",
                image: "/palette.png"
              }
            ].map((feature, i) => (
              <div key={i} className="group relative h-[400px] rounded-3xl overflow-hidden border border-white/10 bg-zinc-900/50 hover:border-white/20 transition-all duration-500">
                <div className="absolute inset-0">
                  <img
                    src={feature.image}
                    alt={feature.title}
                    className="w-full h-full object-cover opacity-60 group-hover:opacity-80 group-hover:scale-105 transition-all duration-700"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent" />
                </div>

                <div className="absolute bottom-0 left-0 p-8 z-10">
                  <h3 className="text-2xl font-bold mb-3 text-white group-hover:text-purple-400 transition-colors">{feature.title}</h3>
                  <p className="text-white/70 leading-relaxed">
                    {feature.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section className="py-32 bg-white/[0.02] border-y border-white/5 backdrop-blur-sm relative overflow-hidden">
        {/* Fine Grid Texture Background */}
        <div className="absolute inset-0 bg-fine-grid opacity-100" />
        <div className="absolute inset-0 bg-gradient-to-b from-background via-transparent to-background pointer-events-none" />
        
        <div className="relative z-10">
          <div className="text-center mb-16 px-6">
            <h2 className="text-3xl md:text-5xl font-bold mb-6">Loved by Creators</h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              Join thousands of content creators who trust Vizion to create stunning thumbnails.
            </p>
          </div>

          {/* Infinite Scroll Container */}
          <div className="relative">
            {/* Left fade */}
            <div className="absolute left-0 top-0 bottom-0 w-32 bg-gradient-to-r from-background to-transparent z-10 pointer-events-none" />
            {/* Right fade */}
            <div className="absolute right-0 top-0 bottom-0 w-32 bg-gradient-to-l from-background to-transparent z-10 pointer-events-none" />
            
            <div className="overflow-hidden">
              <div className="flex gap-6 animate-scroll-left" style={{ width: 'max-content' }}>
                {/* First set of testimonials */}
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
                    <Quote className="w-8 h-8 text-purple-500 mb-6 opacity-50 group-hover:opacity-100 transition-opacity" />
                    <p className="text-lg text-white/90 mb-6 leading-relaxed">"{testimonial.text}"</p>
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-white font-bold text-sm">
                        {testimonial.avatar}
                      </div>
                      <div>
                        <p className="font-bold text-white">{testimonial.author}</p>
                        <p className="text-sm text-white/50">{testimonial.role}</p>
                      </div>
                    </div>
                  </div>
                ))}
                {/* Duplicated set for seamless loop */}
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
                    <Quote className="w-8 h-8 text-purple-500 mb-6 opacity-50 group-hover:opacity-100 transition-opacity" />
                    <p className="text-lg text-white/90 mb-6 leading-relaxed">"{testimonial.text}"</p>
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-white font-bold text-sm">
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

      {/* Pricing Section */}
      <section className="py-32 px-6 relative">
        <div className="container mx-auto max-w-7xl">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-5xl font-bold mb-6">Simple Pricing</h2>
            <p className="text-muted-foreground text-lg mb-8">Start for free, upgrade when you grow.</p>
            
            {/* Billing Toggle */}
            <div className="flex items-center justify-center gap-4">
              <span className={`text-sm font-medium transition-colors ${billingInterval === "monthly" ? "text-white" : "text-muted-foreground"}`}>
                Monthly
              </span>
              <button
                onClick={() => setBillingInterval(billingInterval === "monthly" ? "yearly" : "monthly")}
                className={`relative inline-flex h-7 w-14 items-center rounded-full transition-colors ${
                  billingInterval === "yearly" ? "bg-purple-500" : "bg-white/20"
                }`}
              >
                <span
                  className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-lg transition-transform ${
                    billingInterval === "yearly" ? "translate-x-8" : "translate-x-1"
                  }`}
                />
              </button>
              <span className={`text-sm font-medium transition-colors ${billingInterval === "yearly" ? "text-white" : "text-muted-foreground"}`}>
                Yearly
              </span>
              {billingInterval === "yearly" && (
                <span className="text-xs font-bold bg-gradient-to-r from-purple-500 to-pink-500 text-white px-3 py-1 rounded-full animate-pulse">
                  Save 20%
                </span>
              )}
            </div>
          </div>

          <div className="grid md:grid-cols-4 gap-6 max-w-6xl mx-auto">
            {subscriptionPlans.map((plan) => {
              const isFree = !plan.priceId;
              const monthlyPrice = parseFloat(plan.monthlyPrice.replace("$", ""));
              const discountedMonthlyPrice = monthlyPrice * 0.8;
              
              return (
                <div 
                  key={plan.name} 
                  className={`relative p-6 rounded-3xl border backdrop-blur-sm flex flex-col transition-all duration-300 hover:scale-105 hover:shadow-xl ${
                    plan.popular 
                      ? 'border-purple-500 bg-purple-500/10 shadow-lg shadow-purple-500/20' 
                      : 'border-white/10 bg-white/5 hover:border-white/20'
                  }`}
                >
                  {plan.popular && (
                    <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 text-white text-sm font-bold shadow-lg">
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
                    className={`w-full h-12 rounded-xl font-bold text-base transition-all ${
                      plan.popular 
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

      {/* Footer */}
      <footer className="border-t border-white/10 py-12 bg-black/40 backdrop-blur-xl">
        <div className="container mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-blue-600 flex items-center justify-center">
              <span className="font-bold text-white">V</span>
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
