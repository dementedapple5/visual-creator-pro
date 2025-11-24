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
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <section className="relative px-6 py-20 md:py-32">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center space-y-8">
            <h1 className="text-5xl md:text-7xl font-bold tracking-tight">
              Create Stunning
              <span className="block text-primary">Thumbnails & Covers</span>
            </h1>
            <p className="text-xl md:text-2xl text-muted-foreground max-w-3xl mx-auto">
              AI-powered thumbnail generator for YouTube and social media. Generate professional covers in seconds with Google's latest image model.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center pt-8">
              <Button size="lg" onClick={() => navigate("/auth")} className="w-full sm:w-auto">
                Get Started Free
              </Button>
              <Button size="lg" variant="outline" onClick={() => navigate("/auth")} className="w-full sm:w-auto">
                Sign In
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="px-6 py-20 bg-card">
        <div className="container mx-auto max-w-6xl">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-16">
            Why Choose ThumbnailCraft?
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="space-y-4 text-center">
              <div className="w-16 h-16 mx-auto bg-primary/10 rounded-lg flex items-center justify-center">
                <Wand2 className="w-8 h-8 text-primary" />
              </div>
              <h3 className="text-xl font-semibold">AI-Powered</h3>
              <p className="text-muted-foreground">
                Powered by Google's Gemini 3 Pro Image model for high-quality, professional results
              </p>
            </div>
            <div className="space-y-4 text-center">
              <div className="w-16 h-16 mx-auto bg-primary/10 rounded-lg flex items-center justify-center">
                <Zap className="w-8 h-8 text-primary" />
              </div>
              <h3 className="text-xl font-semibold">Lightning Fast</h3>
              <p className="text-muted-foreground">
                Generate stunning thumbnails in seconds with our streamlined creation process
              </p>
            </div>
            <div className="space-y-4 text-center">
              <div className="w-16 h-16 mx-auto bg-primary/10 rounded-lg flex items-center justify-center">
                <ImageIcon className="w-8 h-8 text-primary" />
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
      <section className="px-6 py-20">
        <div className="container mx-auto max-w-4xl text-center space-y-8">
          <h2 className="text-3xl md:text-5xl font-bold">
            Ready to Create?
          </h2>
          <p className="text-xl text-muted-foreground">
            Join creators using AI to make scroll-stopping thumbnails
          </p>
          <Button size="lg" onClick={() => navigate("/auth")}>
            Start Creating Now
          </Button>
        </div>
      </section>
    </div>
  );
};

export default Index;
