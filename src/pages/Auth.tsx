import { Auth as SupabaseAuth } from "@supabase/auth-ui-react";
import { ThemeSupa } from "@supabase/auth-ui-shared";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { Wand2 } from "lucide-react";

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
    <div className="min-h-screen bg-background flex items-center justify-center px-4 overflow-hidden relative selection:bg-primary/20">
      {/* Background Gradients */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-purple-500/10 rounded-full blur-[120px] animate-pulse" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-500/10 rounded-full blur-[120px] animate-pulse" style={{ animationDelay: '2s' }} />
      </div>

      <div className="w-full max-w-md space-y-8 relative z-10">
        <div className="text-center animate-slide-up-fade">
          <div className="flex justify-center mb-6">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-blue-600 flex items-center justify-center shadow-lg shadow-purple-500/20">
              <Wand2 className="w-6 h-6 text-white" />
            </div>
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Welcome back</h1>
          <p className="text-muted-foreground mt-2">Sign in to your account to continue</p>
        </div>

        <div className="glass-panel p-8 rounded-2xl animate-slide-up-fade" style={{ animationDelay: '0.1s' }}>
          <SupabaseAuth
            supabaseClient={supabase}
            appearance={{
              theme: ThemeSupa,
              variables: {
                default: {
                  colors: {
                    brand: 'white',
                    brandAccent: '#e5e5e5',
                    brandButtonText: 'black',
                    defaultButtonBackground: 'transparent',
                    defaultButtonBackgroundHover: 'rgba(255,255,255,0.1)',
                    defaultButtonBorder: 'rgba(255,255,255,0.1)',
                    defaultButtonText: 'white',
                    dividerBackground: 'rgba(255,255,255,0.1)',
                    inputBackground: 'rgba(255,255,255,0.05)',
                    inputBorder: 'rgba(255,255,255,0.1)',
                    inputBorderHover: 'rgba(255,255,255,0.2)',
                    inputBorderFocus: 'white',
                    inputText: 'white',
                    inputLabelText: 'rgba(255,255,255,0.7)',
                    inputPlaceholder: 'rgba(255,255,255,0.4)',
                  },
                  space: {
                    inputPadding: '1rem',
                    buttonPadding: '1rem',
                  },
                  borderWidths: {
                    buttonBorderWidth: '1px',
                    inputBorderWidth: '1px',
                  },
                  radii: {
                    borderRadiusButton: '0.75rem',
                    buttonBorderRadius: '0.75rem',
                    inputBorderRadius: '0.75rem',
                  },
                },
              },
              className: {
                container: 'space-y-4',
                button: 'w-full font-medium transition-all duration-200 hover:scale-[1.02]',
                input: 'bg-white/5 border-white/10 text-white placeholder:text-white/40 focus:border-white/50 focus:ring-0 transition-all duration-200',
                label: 'text-sm text-muted-foreground mb-1.5 block',
                loader: 'text-white',
                anchor: 'text-sm text-muted-foreground hover:text-white transition-colors underline-offset-4 hover:underline',
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
