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
import { compressAndConvertToJpg } from "@/lib/imageUtils";
import { AvatarPositionSelector } from "@/components/AvatarPositionSelector";

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
  const selectedPositions = data.productPositions || [];

  return (
    <div className="space-y-6 p-6 bg-card border border-border rounded-lg transition-all duration-300 ease-in-out animate-in fade-in slide-in-from-top-2">
      <h3 className="text-lg font-semibold">Element Customization</h3>
      
      <div className="space-y-3">
        <Label>Positions (select multiple for variations)</Label>
        
        <AvatarPositionSelector
          options={POSITIONS.map(p => ({ value: p.id, label: p.label }))}
          value={selectedPositions}
          onChange={(next) => updateData({ productPositions: next })}
          showAiDecide
          aiLabel="Let AI Decide"
          aiDescription="AI will choose optimal positions"
        />
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
  const [uploadingCustom, setUploadingCustom] = useState(false);

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

  const handleCustomElementUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      setUploadingCustom(true);
      const file = event.target.files?.[0];
      if (!file) return;

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No user found");

      const compressedBlob = await compressAndConvertToJpg(file);
      const fileName = `${user.id}/temp/element_${Date.now()}.jpg`;

      const { error: uploadError } = await supabase.storage
        .from("thumbnails")
        .upload(fileName, compressedBlob, {
          contentType: "image/jpeg",
        });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("thumbnails")
        .getPublicUrl(fileName);

      const newCustomId = `custom-${Date.now()}`;
      const nextCustomElements = [
        ...(data.customProductElements || []),
        { id: newCustomId, url: publicUrl },
      ];

      // Auto-select the newly uploaded element
      const nextProductIds = Array.from(new Set([...(data.productIds || []), newCustomId]));

      updateData({
        customProductElements: nextCustomElements,
        productIds: nextProductIds,
      });

      toast.success("Element uploaded");
    } catch (error) {
      console.error("Error uploading custom element:", error);
      toast.error("Failed to upload element");
    } finally {
      setUploadingCustom(false);
      // allow uploading same file twice
      event.target.value = "";
    }
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

  const handleRemoveCustomElement = (customId: string) => {
    updateData({
      customProductElements: (data.customProductElements || []).filter((e) => e.id !== customId),
      productIds: (data.productIds || []).filter((pid) => pid !== customId),
    });
  };

  const handleSkip = () => {
    updateData({ 
      productIds: [],
      productPosition: undefined,
      productImportance: undefined,
      productPositions: undefined,
      customProductElements: [],
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="border-2 border-dashed border-border rounded-lg p-8 text-center cursor-pointer hover:border-primary transition-colors">
            <input
              type="file"
              accept="image/*"
              onChange={handleCustomElementUpload}
              disabled={uploadingCustom}
              className="hidden"
            />
            <Upload className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-sm font-medium mb-1">
              {uploadingCustom ? "Uploading..." : "Upload Element Image (no save)"}
            </p>
            <p className="text-xs text-muted-foreground">
              Upload an image temporarily and it will be sent to the model via URL
            </p>
          </label>

          <div
            onClick={handleUpload}
            className="border-2 border-dashed border-border rounded-lg p-8 text-center cursor-pointer hover:border-primary transition-colors"
          >
            <Upload className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-sm font-medium mb-1">Add New Element (save to library)</p>
            <p className="text-xs text-muted-foreground">
              Go to Elements page to create an element with title, optional brand, and images
            </p>
          </div>
        </div>
      </div>

      {/* Custom elements uploaded in this wizard */}
      {data.customProductElements && data.customProductElements.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {data.customProductElements.map((el) => (
            <div key={el.id} className="relative group">
              <div
                onClick={() => handleSelect(el.id)}
                className={`rounded-lg overflow-hidden border-2 cursor-pointer transition-all ${
                  data.productIds?.includes(el.id)
                    ? "border-primary ring-4 ring-primary/20"
                    : "border-border hover:border-primary"
                }`}
              >
                <div className="aspect-square">
                  <img
                    src={el.url}
                    alt="Custom element"
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="p-3 bg-card">
                  <p className="font-medium text-sm truncate">Custom Element</p>
                  <p className="text-xs text-muted-foreground truncate">Temporary upload</p>
                </div>
                {data.productIds?.includes(el.id) && (
                  <div className="absolute top-2 right-2 bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold shadow-lg">
                    {data.productIds.indexOf(el.id) + 1}
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleRemoveCustomElement(el.id);
                }}
                className="absolute top-2 left-2 bg-destructive text-destructive-foreground rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                aria-label="Remove custom element"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}

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
