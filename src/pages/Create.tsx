import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { StepAvatar } from "@/components/create/StepAvatar";
import { StepProduct } from "@/components/create/StepProduct";
import { StepText } from "@/components/create/StepText";
import { StepExpression } from "@/components/create/StepExpression";
import { StepVisualStyle } from "@/components/create/StepVisualStyle";
import { StepTextStyle } from "@/components/create/StepTextStyle";
import { StepBackground } from "@/components/create/StepBackground";
import { StepGenerate } from "@/components/create/StepGenerate";

export interface CreateData {
  avatarId?: string;
  productId?: string;
  title?: string;
  subtitle?: string;
  expression?: string;
  visualStyle?: string;
  textStyle?: string;
  backgroundType?: string;
  backgroundValue?: string;
  aspectRatio?: string;
}

const Create = () => {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(1);
  const [data, setData] = useState<CreateData>({});

  useEffect(() => {
    checkUser();
  }, []);

  const checkUser = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate("/auth");
    }
  };

  const updateData = (updates: Partial<CreateData>) => {
    setData((prev) => ({ ...prev, ...updates }));
  };

  const nextStep = () => {
    setCurrentStep((prev) => Math.min(prev + 1, 8));
  };

  const prevStep = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 1));
  };

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return <StepAvatar data={data} updateData={updateData} onNext={nextStep} />;
      case 2:
        return <StepProduct data={data} updateData={updateData} onNext={nextStep} onPrev={prevStep} />;
      case 3:
        return <StepText data={data} updateData={updateData} onNext={nextStep} onPrev={prevStep} />;
      case 4:
        return data.avatarId ? (
          <StepExpression data={data} updateData={updateData} onNext={nextStep} onPrev={prevStep} />
        ) : (
          <StepVisualStyle data={data} updateData={updateData} onNext={nextStep} onPrev={prevStep} />
        );
      case 5:
        return <StepVisualStyle data={data} updateData={updateData} onNext={nextStep} onPrev={prevStep} />;
      case 6:
        return <StepTextStyle data={data} updateData={updateData} onNext={nextStep} onPrev={prevStep} />;
      case 7:
        return <StepBackground data={data} updateData={updateData} onNext={nextStep} onPrev={prevStep} />;
      case 8:
        return <StepGenerate data={data} updateData={updateData} onPrev={prevStep} />;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" onClick={() => navigate("/dashboard")}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
            <h1 className="text-2xl font-bold">Create Thumbnail</h1>
          </div>
        </div>
      </header>

      {/* Progress Bar */}
      <div className="border-b border-border bg-card">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Step {currentStep} of 8</span>
            <span className="text-sm text-muted-foreground">{Math.round((currentStep / 8) * 100)}%</span>
          </div>
          <div className="w-full bg-muted rounded-full h-2">
            <div
              className="bg-primary h-2 rounded-full transition-all duration-300"
              style={{ width: `${(currentStep / 8) * 100}%` }}
            />
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="container mx-auto px-6 py-12 max-w-4xl">
        {renderStep()}
      </main>
    </div>
  );
};

export default Create;
