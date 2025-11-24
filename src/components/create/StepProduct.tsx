import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Upload } from "lucide-react";
import { toast } from "sonner";
import { CreateData } from "@/pages/Create";

interface StepProductProps {
  data: CreateData;
  updateData: (updates: Partial<CreateData>) => void;
  onNext: () => void;
  onPrev: () => void;
}

interface Product {
  id: string;
  name: string;
  image_url: string;
}

export const StepProduct = ({ data, updateData, onNext, onPrev }: StepProductProps) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      const { data: productData, error } = await supabase
        .from("products")
        .select("*")
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

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      setUploading(true);
      const file = event.target.files?.[0];
      if (!file) return;

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No user found");

      const fileExt = file.name.split(".").pop();
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("products")
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("products")
        .getPublicUrl(fileName);

      const { error: dbError } = await supabase
        .from("products")
        .insert({ 
          user_id: user.id, 
          name: file.name,
          image_url: publicUrl 
        });

      if (dbError) throw dbError;

      toast.success("Product uploaded");
      fetchProducts();
    } catch (error) {
      console.error("Error uploading product:", error);
      toast.error("Failed to upload product");
    } finally {
      setUploading(false);
    }
  };

  const handleSelect = (id: string) => {
    updateData({ productId: id });
  };

  const handleSkip = () => {
    updateData({ productId: undefined });
    onNext();
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-bold mb-2">Add a Product</h2>
        <p className="text-muted-foreground">
          Feature a product in your thumbnail (optional)
        </p>
      </div>

      <div className="mb-6">
        <label htmlFor="product-upload">
          <div className="border-2 border-dashed border-border rounded-lg p-8 text-center cursor-pointer hover:border-primary transition-colors">
            <Upload className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Click to upload product image
            </p>
          </div>
          <input
            id="product-upload"
            type="file"
            accept="image/*"
            onChange={handleUpload}
            disabled={uploading}
            className="hidden"
          />
        </label>
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
            <div
              key={product.id}
              onClick={() => handleSelect(product.id)}
              className={`aspect-square rounded-lg overflow-hidden border-2 cursor-pointer transition-all ${
                data.productId === product.id
                  ? "border-primary ring-4 ring-primary/20"
                  : "border-border hover:border-primary"
              }`}
            >
              <img
                src={product.image_url}
                alt={product.name}
                className="w-full h-full object-cover"
              />
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-4 pt-8">
        <Button variant="outline" onClick={onPrev}>
          Back
        </Button>
        <Button variant="outline" onClick={handleSkip} className="flex-1">
          Skip
        </Button>
        <Button onClick={onNext} disabled={!data.productId} className="flex-1">
          Continue
        </Button>
      </div>
    </div>
  );
};
