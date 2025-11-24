import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Wand2, Zap, Image as ImageIcon } from "lucide-react";

const Index = () => {
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        navigate("/dashboard");
      }
    });
  }, [navigate]);

  return (
    <div className="min-h-screen bg-gradient-subtle">
      {/* Hero Section */}
      <section className="relative px-6 py-20 md:py-32 animate-fade-in">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center space-y-8">
            <h1 className="text-5xl md:text-7xl font-bold tracking-tight animate-slide-up">
              Create Stunning
              <span className="block bg-gradient-primary bg-clip-text text-transparent">Thumbnails & Covers</span>
            </h1>
            <p className="text-xl md:text-2xl text-muted-foreground max-w-3xl mx-auto animate-slide-up" style={{ animationDelay: '0.1s' }}>
              AI-powered thumbnail generator for YouTube and social media. Generate professional covers in seconds with Google's latest image model.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center pt-8 animate-slide-up" style={{ animationDelay: '0.2s' }}>
              <Button size="lg" onClick={() => navigate("/auth")} className="w-full sm:w-auto bg-gradient-primary hover:shadow-glow transition-all duration-300 hover:scale-105 rounded-full">
                Get Started Free
              </Button>
              <Button size="lg" variant="outline" onClick={() => navigate("/auth")} className="w-full sm:w-auto rounded-full backdrop-blur-sm hover:scale-105 transition-all duration-300">
                Sign In
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="px-6 py-20">
        <div className="container mx-auto max-w-6xl">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-16 animate-fade-in">
            Why Choose Vizion?
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="space-y-4 text-center backdrop-blur-lg bg-card/50 border-glass-border rounded-2xl p-8 hover:shadow-glow transition-all duration-300 hover:scale-105 animate-slide-up group">
              <div className="w-16 h-16 mx-auto bg-gradient-primary rounded-2xl flex items-center justify-center group-hover:animate-float">
                <Wand2 className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-xl font-semibold">AI-Powered</h3>
              <p className="text-muted-foreground">
                Powered by Google's Gemini 3 Pro Image model for high-quality, professional results
              </p>
            </div>
            <div className="space-y-4 text-center backdrop-blur-lg bg-card/50 border-glass-border rounded-2xl p-8 hover:shadow-glow transition-all duration-300 hover:scale-105 animate-slide-up group" style={{ animationDelay: '0.1s' }}>
              <div className="w-16 h-16 mx-auto bg-gradient-secondary rounded-2xl flex items-center justify-center group-hover:animate-float">
                <Zap className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-xl font-semibold">Lightning Fast</h3>
              <p className="text-muted-foreground">
                Generate stunning thumbnails in seconds with our streamlined creation process
              </p>
            </div>
            <div className="space-y-4 text-center backdrop-blur-lg bg-card/50 border-glass-border rounded-2xl p-8 hover:shadow-glow transition-all duration-300 hover:scale-105 animate-slide-up group" style={{ animationDelay: '0.2s' }}>
              <div className="w-16 h-16 mx-auto bg-gradient-accent rounded-2xl flex items-center justify-center group-hover:animate-float">
                <ImageIcon className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-xl font-semibold">Full Control</h3>
              <p className="text-muted-foreground">
                Customize every detail: avatars, products, text styles, expressions, and backgrounds
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="px-6 py-20 animate-fade-in">
        <div className="container mx-auto max-w-4xl text-center space-y-8 backdrop-blur-lg bg-card/50 border-glass-border rounded-2xl p-12">
          <h2 className="text-3xl md:text-5xl font-bold bg-gradient-primary bg-clip-text text-transparent">
            Ready to Create?
          </h2>
          <p className="text-xl text-muted-foreground">
            Join creators using AI to make scroll-stopping thumbnails
          </p>
          <Button size="lg" onClick={() => navigate("/auth")} className="bg-gradient-primary hover:shadow-glow transition-all duration-300 hover:scale-105 rounded-full">
            Start Creating Now
          </Button>
        </div>
      </section>
    </div>
  );
};

export default Index;
