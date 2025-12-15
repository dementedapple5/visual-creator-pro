import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Upload, X, Sparkles, Check, Plus } from "lucide-react";
import { toast } from "sonner";
import { CreateData } from "@/pages/Create";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";

interface StepProductProps {
  data: CreateData;
  updateData: (updates: Partial<CreateData>) => void;
  onNext: () => void;
  onPrev: () => void;
}

interface Product {
  id: string;
  title: string;
  brand: string;
  images: { id: string; image_url: string }[];
}

const POSITIONS = [
  { id: "top-left", label: "Top Left" },
  { id: "top-center", label: "Top Center" },
  { id: "top-right", label: "Top Right" },
  { id: "center-left", label: "Center Left" },
  { id: "center", label: "Center" },
  { id: "center-right", label: "Center Right" },
  { id: "bottom-left", label: "Bottom Left" },
  { id: "bottom-center", label: "Bottom Center" },
  { id: "bottom-right", label: "Bottom Right" },
];

const ProductCustomization = ({ data, updateData }: { data: CreateData; updateData: (updates: Partial<CreateData>) => void }) => {
  const [customPosition, setCustomPosition] = useState("");
  const selectedPositions = data.productPositions || [];
  const isAiMode = selectedPositions.includes("ai-decide");

  const handlePositionToggle = (positionId: string) => {
    if (positionId === "ai-decide") {
      // Toggle AI mode - clears other selections
      if (isAiMode) {
        updateData({ productPositions: [] });
      } else {
        updateData({ productPositions: ["ai-decide"] });
      }
      return;
    }

    // If AI mode is active, switch to manual selection
    if (isAiMode) {
      updateData({ productPositions: [positionId] });
      return;
    }

    const isSelected = selectedPositions.includes(positionId);
    
    if (isSelected) {
      updateData({ productPositions: selectedPositions.filter(p => p !== positionId) });
    } else {
      updateData({ productPositions: [...selectedPositions, positionId] });
    }
  };

  const addCustomPosition = () => {
    if (customPosition.trim() && !selectedPositions.includes(customPosition.trim())) {
      if (isAiMode) {
        updateData({ productPositions: [customPosition.trim()] });
      } else {
        updateData({ productPositions: [...selectedPositions, customPosition.trim()] });
      }
      setCustomPosition("");
    }
  };

  const removePosition = (positionId: string) => {
    updateData({ productPositions: selectedPositions.filter(p => p !== positionId) });
  };

  return (
    <div className="space-y-6 p-6 bg-card border border-border rounded-lg transition-all duration-300 ease-in-out animate-in fade-in slide-in-from-top-2">
      <h3 className="text-lg font-semibold">Element Customization</h3>
      
      <div className="space-y-3">
        <Label>Positions (select multiple for variations)</Label>
        
        {/* AI Decide Option */}
        <button
          onClick={() => handlePositionToggle("ai-decide")}
          className={`w-full p-3 rounded-lg border-2 transition-all flex items-center gap-3 ${
            isAiMode
              ? "border-primary bg-primary/10"
              : "border-border hover:border-primary/50"
          }`}
        >
          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
            isAiMode ? "bg-primary" : "bg-gradient-to-br from-violet-500 to-fuchsia-500"
          }`}>
            {isAiMode ? <Check className="w-4 h-4 text-primary-foreground" /> : <Sparkles className="w-4 h-4 text-white" />}
          </div>
          <div className="text-left">
            <div className="font-medium text-sm">Let AI Decide</div>
            <div className="text-xs text-muted-foreground">AI will choose optimal positions</div>
          </div>
        </button>

        {/* Position Chips */}
        <div className={`flex flex-wrap gap-2 ${isAiMode ? "opacity-50 pointer-events-none" : ""}`}>
          {POSITIONS.map((position) => {
            const isSelected = selectedPositions.includes(position.id);
            return (
              <button
                key={position.id}
                onClick={() => handlePositionToggle(position.id)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                  isSelected
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted hover:bg-muted/80 text-foreground"
                }`}
              >
                {isSelected && <Check className="w-3 h-3 inline mr-1" />}
                {position.label}
              </button>
            );
          })}
        </div>

        {/* Custom Position Input */}
        <div className={`flex gap-2 ${isAiMode ? "opacity-50 pointer-events-none" : ""}`}>
          <Input
            placeholder="Add custom position..."
            value={customPosition}
            onChange={(e) => setCustomPosition(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addCustomPosition()}
            className="flex-1"
          />
          <Button 
            variant="outline" 
            size="icon"
            onClick={addCustomPosition}
            disabled={!customPosition.trim()}
          >
            <Plus className="w-4 h-4" />
          </Button>
        </div>

        {/* Selected Custom Positions */}
        {selectedPositions.filter(p => p !== "ai-decide" && !POSITIONS.find(pos => pos.id === p)).length > 0 && (
          <div className="flex flex-wrap gap-2">
            {selectedPositions
              .filter(p => p !== "ai-decide" && !POSITIONS.find(pos => pos.id === p))
              .map((posId) => (
                <span
                  key={posId}
                  className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-secondary text-secondary-foreground text-sm"
                >
                  {posId}
                  <button onClick={() => removePosition(posId)} className="hover:text-destructive">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
          </div>
        )}
      </div>

      <div>
        <Label htmlFor="product-importance">
          Importance Level: {data.productImportance || 3}
        </Label>
        <Slider
          id="product-importance"
          min={1}
          max={5}
          step={1}
          value={[data.productImportance || 3]}
          onValueChange={([value]) => updateData({ productImportance: value })}
          className="mt-2"
        />
        <p className="text-xs text-muted-foreground mt-1">
          Higher importance = more space in the thumbnail
        </p>
      </div>
    </div>
  );
};

export const StepProduct = ({ data, updateData, onNext, onPrev }: StepProductProps) => {
  const navigate = useNavigate();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      const { data: productData, error } = await supabase
        .from("products")
        .select(`
          *,
          images:product_images(id, image_url)
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setProducts(productData || []);
    } catch (error) {
      console.error("Error fetching products:", error);
      toast.error("Failed to load elements");
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = () => {
    navigate("/products?action=create");
  };

  const handleSelect = (id: string) => {
    const currentIds = data.productIds || [];
    const isSelected = currentIds.includes(id);
    
    if (isSelected) {
      updateData({ productIds: currentIds.filter(pid => pid !== id) });
    } else {
      updateData({ productIds: [...currentIds, id] });
    }
  };

  const handleSkip = () => {
    updateData({ 
      productIds: [],
      productPosition: undefined,
      productImportance: undefined
    });
    onNext();
  };


  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-bold mb-2">Add Elements</h2>
        <p className="text-muted-foreground">
          Select one or more elements to feature in your thumbnail (optional)
          {data.productIds && data.productIds.length > 0 && (
            <span className="ml-2 text-primary font-medium transition-all duration-300 ease-in-out animate-in fade-in">
              {data.productIds.length} selected
            </span>
          )}
        </p>
      </div>

      <div className="mb-6">
        <div 
          onClick={handleUpload}
          className="border-2 border-dashed border-border rounded-lg p-8 text-center cursor-pointer hover:border-primary transition-colors"
        >
          <Upload className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
          <p className="text-sm font-medium mb-1">Add New Element</p>
          <p className="text-xs text-muted-foreground">
            Go to Elements page to create an element with title, optional brand, and images
          </p>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="aspect-square bg-muted animate-pulse rounded-lg" />
          ))}
        </div>
      ) : products.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {products.map((product) => (
            <div key={product.id} className="relative group">
              <div
                onClick={() => handleSelect(product.id)}
                className={`rounded-lg overflow-hidden border-2 cursor-pointer transition-all ${
                  data.productIds?.includes(product.id)
                    ? "border-primary ring-4 ring-primary/20"
                    : "border-border hover:border-primary"
                }`}
              >
                <div className="aspect-square">
                  <img
                    src={product.images[0]?.image_url || "/placeholder.svg"}
                    alt={product.title}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="p-3 bg-card">
                  <p className="font-medium text-sm truncate">{product.title}</p>
                  <p className="text-xs text-muted-foreground truncate">{product.brand}</p>
                  {product.images.length > 1 && (
                    <p className="text-xs text-primary mt-1">+{product.images.length - 1} more</p>
                  )}
                </div>
                {data.productIds?.includes(product.id) && (
                  <div className="absolute top-2 right-2 bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold shadow-lg">
                    {data.productIds.indexOf(product.id) + 1}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {data.productIds && data.productIds.length > 0 && (
        <ProductCustomization data={data} updateData={updateData} />
      )}

      <div className="flex gap-4 pt-8">
        <Button variant="outline" onClick={onPrev}>
          Back
        </Button>
        <Button variant="outline" onClick={handleSkip} className="flex-1">
          Skip
        </Button>
        <Button onClick={onNext} disabled={!data.productIds || data.productIds.length === 0} className="flex-1">
          Continue
        </Button>
      </div>
    </div>
  );
};
