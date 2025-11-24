import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Upload } from "lucide-react";
import { toast } from "sonner";
import { CreateData } from "@/pages/Create";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";

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
      toast.error("Failed to load products");
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
        <h2 className="text-3xl font-bold mb-2">Add Products</h2>
        <p className="text-muted-foreground">
          Select one or more products to feature in your thumbnail (optional)
          {data.productIds && data.productIds.length > 0 && (
            <span className="ml-2 text-primary font-medium">
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
          <p className="text-sm font-medium mb-1">Add New Product</p>
          <p className="text-xs text-muted-foreground">
            Go to Products page to create a product with title, brand and images
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
        <div className="space-y-6 p-6 bg-card border border-border rounded-lg">
          <h3 className="text-lg font-semibold">Product Customization</h3>
          
          <div>
            <Label htmlFor="product-position">Position</Label>
            <Select 
              value={data.productPosition || "center"} 
              onValueChange={(value) => updateData({ productPosition: value })}
            >
              <SelectTrigger id="product-position">
                <SelectValue placeholder="Select position" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="top-left">Top Left</SelectItem>
                <SelectItem value="top-center">Top Center</SelectItem>
                <SelectItem value="top-right">Top Right</SelectItem>
                <SelectItem value="center-left">Center Left</SelectItem>
                <SelectItem value="center">Center</SelectItem>
                <SelectItem value="center-right">Center Right</SelectItem>
                <SelectItem value="bottom-left">Bottom Left</SelectItem>
                <SelectItem value="bottom-center">Bottom Center</SelectItem>
                <SelectItem value="bottom-right">Bottom Right</SelectItem>
              </SelectContent>
            </Select>
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
