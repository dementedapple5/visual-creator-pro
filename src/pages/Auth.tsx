import { Auth as SupabaseAuth } from "@supabase/auth-ui-react";
import { ThemeSupa } from "@supabase/auth-ui-shared";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { BadgeCheck, ShieldCheck, Sparkles, Zap } from "lucide-react";
import { useTheme } from "next-themes";

const Auth = () => {
  const navigate = useNavigate();
  const { theme } = useTheme();

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

  const handleGoogleSignIn = async () => {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/dashboard`,
      },
    });
  };

  return (
    <div className="min-h-screen bg-background relative overflow-hidden selection:bg-primary/20 text-foreground">
      {/* Landing-style background */}
      <div className="fixed inset-0 pointer-events-none">
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
        <div className="absolute top-[-18%] left-[-10%] w-[50%] h-[50%] bg-rose-500/12 rounded-full blur-[140px]" />
        <div className="absolute bottom-[-18%] right-[-6%] w-[52%] h-[52%] bg-rose-400/10 rounded-full blur-[140px]" />
        <div className="absolute top-1/3 right-[12%] w-48 h-48 rounded-full bg-primary/5 blur-[80px] opacity-30 animate-glow" />
      </div>

      <div className="relative z-10 max-w-6xl mx-auto px-4 md:px-8 py-12 lg:py-20 space-y-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12">
              <img
                src="/favicon.png"
                alt="Vizion logo"
                className="w-full h-full rounded-xl object-contain shadow-lg shadow-primary/30 bg-white/80"
              />
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                Vizion
              </p>
              <p className="text-sm text-foreground/80">Visual Creator Pro</p>
            </div>
          </div>

          <button
            onClick={() => navigate("/")}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors underline underline-offset-4"
          >
            Back to landing
          </button>
        </div>

        <div className="grid lg:grid-cols-[1.05fr_0.95fr] gap-10 items-center">
          <div className="space-y-6 lg:space-y-8">
            <div className="space-y-3 animate-slide-up-fade" style={{ animationDelay: "0.06s" }}>
              <h1 className="text-4xl md:text-5xl font-semibold leading-tight hero-font-primary">
                Welcome back to the <span className="text-gradient">Vizion Control Room</span>
              </h1>
              <p className="text-3xl md:text-4xl hero-font-secondary text-gradient">
                Pick up where you left off with saved assets and flows.
              </p>
            </div>

            <p
              className="text-lg text-muted-foreground/90 max-w-2xl animate-slide-up-fade"
              style={{ animationDelay: "0.12s" }}
            >
              Sign in to unlock your reusable avatars, background recipes, and title banks. Everything is synced,
              encrypted, and ready to generate new visuals in seconds.
            </p>

            <div className="flex items-center gap-4 text-sm text-muted-foreground animate-slide-up-fade" style={{ animationDelay: "0.24s" }}>
              <div className="flex -space-x-3">
                <span className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-400 to-cyan-500 blur-[1px] flex items-center justify-center text-sm font-semibold text-black shadow-lg shadow-emerald-500/30">
                  V
                </span>
                <span className="w-10 h-10 rounded-full bg-gradient-to-br from-rose-400 to-pink-500 blur-[1px] flex items-center justify-center text-sm font-semibold text-black shadow-lg shadow-rose-400/30">
                  Z
                </span>
                <span className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-300 to-rose-400 blur-[1px] flex items-center justify-center text-sm font-semibold text-black shadow-lg shadow-amber-400/30">
                  N
                </span>
              </div>
              <span>Trusted by creators shipping daily with Vizion.</span>
            </div>
          </div>

          <div
            className="glass-panel p-8 rounded-2xl relative overflow-hidden border border-border shadow-2xl animate-slide-up-fade"
            style={{ animationDelay: "0.1s" }}
          >
            <div className="absolute inset-0 bg-gradient-to-br from-foreground/5 via-transparent to-foreground/5 pointer-events-none" />
            <div className="absolute -top-10 -right-10 w-36 h-36 bg-primary/20 rounded-full blur-3xl" />
            <div className="relative space-y-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Sign in</p>
                  <h2 className="text-2xl font-semibold text-foreground">Enter the Vizion studio</h2>
                </div>
              </div>

              <button
                onClick={handleGoogleSignIn}
                className="w-full inline-flex items-center justify-center gap-3 px-4 py-3 rounded-xl bg-foreground text-background font-medium transition-all hover:bg-foreground/90 hover:shadow-lg hover:shadow-foreground/30"
              >
                <img
                  src="/google.png"
                  alt="Google"
                  className="w-6 h-6 rounded-sm"
                />
                Continue with Google
              </button>

              <div className="flex items-center gap-3">
                <span className="h-px flex-1 bg-border" />
                <span className="text-xs text-muted-foreground">or continue with email</span>
                <span className="h-px flex-1 bg-border" />
              </div>

              <SupabaseAuth
                supabaseClient={supabase}
                appearance={{
                  theme: ThemeSupa,
                  variables: {
                    default: {
                      colors: {
                        brand: "hsl(var(--primary))",
                        brandAccent: "hsl(var(--primary))",
                        brandButtonText: "hsl(var(--primary-foreground))",
                        defaultButtonBackground: "transparent",
                        defaultButtonBackgroundHover: "hsl(var(--secondary))",
                        defaultButtonBorder: "hsl(var(--border))",
                        defaultButtonText: "hsl(var(--foreground))",
                        dividerBackground: "hsl(var(--border))",
                        inputBackground: "transparent",
                        inputBorder: "hsl(var(--border))",
                        inputBorderHover: "hsl(var(--primary))",
                        inputBorderFocus: "hsl(var(--primary))",
                        inputText: "hsl(var(--foreground))",
                        inputLabelText: "hsl(var(--muted-foreground))",
                        inputPlaceholder: "hsl(var(--muted-foreground))",
                      },
                      space: {
                        inputPadding: "1rem",
                        buttonPadding: "1rem",
                      },
                      borderWidths: {
                        buttonBorderWidth: "1px",
                        inputBorderWidth: "1px",
                      },
                      radii: {
                        borderRadiusButton: "0.75rem",
                        buttonBorderRadius: "0.75rem",
                        inputBorderRadius: "0.75rem",
                      },
                    },
                  },
                  className: {
                    container: "space-y-4",
                    button: "w-full font-medium transition-all duration-200 hover:scale-[1.01]",
                    input:
                      "bg-background border-border text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-0 transition-all duration-200",
                    label: "text-sm text-muted-foreground mb-1.5 block",
                    loader: "text-primary",
                    anchor:
                      "text-sm text-muted-foreground hover:text-foreground transition-colors underline-offset-4 hover:underline",
                  },
                }}
                providers={[]}
              />

              <p className="text-xs text-muted-foreground text-center">
                By signing in you agree to our terms and keep your assets synced securely.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Auth;
