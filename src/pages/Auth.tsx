import { Auth as SupabaseAuth } from "@supabase/auth-ui-react";
import { ThemeSupa } from "@supabase/auth-ui-shared";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { useEffect } from "react";

const Auth = () => {
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        navigate("/dashboard");
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        navigate("/dashboard");
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  return (
    <div className="min-h-screen bg-gradient-subtle flex items-center justify-center px-4 animate-fade-in">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center animate-slide-up">
          <h1 className="text-3xl font-bold bg-gradient-primary bg-clip-text text-transparent">Welcome to ThumbnailCraft</h1>
          <p className="text-muted-foreground mt-2">Sign in or create an account to get started</p>
        </div>
        <div className="backdrop-blur-lg bg-card/50 border-glass-border p-8 rounded-2xl shadow-glow animate-scale-in">
          <SupabaseAuth
            supabaseClient={supabase}
            appearance={{
              theme: ThemeSupa,
              variables: {
                default: {
                  colors: {
                    brand: "hsl(var(--primary))",
                    brandAccent: "hsl(var(--primary))",
                  },
                },
              },
            }}
            providers={[]}
          />
        </div>
      </div>
    </div>
  );
};

export default Auth;
