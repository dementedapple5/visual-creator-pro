import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, ArrowLeft, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { compressAndConvertToJpg } from "@/lib/imageUtils";

interface ProductImage {
  id: string;
  image_url: string;
}

interface Product {
  id: string;
  title: string;
  brand: string;
  created_at: string;
  images: ProductImage[];
}

const Products = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [title, setTitle] = useState("");
  const [brand, setBrand] = useState("");
  const [uploadedImages, setUploadedImages] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [subscription, setSubscription] = useState<{ subscribed: boolean } | null>(null);

  useEffect(() => {
    checkUser();
    fetchProducts();
    checkSubscription();
    
    if (searchParams.get("action") === "create") {
      setShowDialog(true);
      setSearchParams({});
    }
  }, []);

  const checkSubscription = async () => {
    const { data } = await supabase.functions.invoke("check-subscription");
    if (data) {
      setSubscription(data);
    }
  };

  const checkUser = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate("/auth");
    }
  };

  const fetchProducts = async () => {
    try {
      const { data, error } = await supabase
        .from("products")
        .select(`
          *,
          images:product_images(id, image_url)
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setProducts(data || []);
    } catch (error) {
      console.error("Error fetching products:", error);
      toast.error(t("products.errors.failedLoad"));
    } finally {
      setLoading(false);
    }
  };

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      setUploading(true);
      const files = event.target.files;
      if (!files) return;

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No user found");

      const uploadPromises = Array.from(files).map(async (file) => {
        const compressedBlob = await compressAndConvertToJpg(file);
        const fileName = `${user.id}/${Date.now()}-${Math.random()}.jpg`;

        const { error: uploadError } = await supabase.storage
          .from("products")
          .upload(fileName, compressedBlob, {
            contentType: "image/jpeg",
          });

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from("products")
          .getPublicUrl(fileName);

        return publicUrl;
      });

      const urls = await Promise.all(uploadPromises);
      setUploadedImages([...uploadedImages, ...urls]);
      toast.success(t("products.errors.imagesUploaded", { count: urls.length }));
    } catch (error) {
      console.error("Error uploading images:", error);
      toast.error(t("products.errors.failedUpload"));
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveImage = (index: number) => {
    setUploadedImages(uploadedImages.filter((_, i) => i !== index));
  };

  const handleCreateProduct = async () => {
    const titleValue = title.trim();
    const brandValue = brand.trim();

    if (!titleValue || uploadedImages.length === 0) {
      toast.error(t("products.errors.addTitleAndImage"));
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No user found");

      // Check free tier limit
      if (!subscription?.subscribed && products.length >= 3) {
        toast.error(t("products.errors.freeLimit"));
        return;
      }

      const { data: product, error: productError } = await supabase
        .from("products")
        .insert({
          user_id: user.id,
          title: titleValue,
          brand: brandValue,
        })
        .select()
        .single();

      if (productError) throw productError;

      const imageInserts = uploadedImages.map((url) => ({
        product_id: product.id,
        user_id: user.id,
        image_url: url,
      }));

      const { error: imagesError } = await supabase
        .from("product_images")
        .insert(imageInserts);

      if (imagesError) throw imagesError;

      toast.success(t("products.errors.createdSuccess"));
      setShowDialog(false);
      setTitle("");
      setBrand("");
      setUploadedImages([]);
      fetchProducts();
    } catch (error) {
      console.error("Error creating product:", error);
      toast.error(t("products.errors.failedCreate"));
    }
  };

  return (
    <div className="min-h-screen">
      <main className="container mx-auto px-6 py-4">
        <div className="mb-6 flex justify-between items-center">
          <h1 className="text-2xl font-bold">{t("products.title")}</h1>
          <Button 
            onClick={() => setShowDialog(true)}
            disabled={!subscription?.subscribed && products.length >= 3}
          >
            <Plus className="w-4 h-4 mr-2" />
            {t("products.addElement")}
            {!subscription?.subscribed && products.length >= 3 && t("products.limitReached")}
          </Button>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="bg-card border border-border rounded-lg p-4">
                <div className="aspect-square bg-muted animate-pulse rounded-lg mb-4" />
                <div className="h-4 bg-muted animate-pulse rounded mb-2" />
                <div className="h-3 bg-muted animate-pulse rounded w-2/3" />
              </div>
            ))}
          </div>
        ) : products.length === 0 ? (
          <div className="text-center py-20 bg-card border border-border rounded-lg">
            <h3 className="text-xl font-semibold mb-2">{t("products.noElements")}</h3>
            <p className="text-muted-foreground mb-6">{t("products.createFirst")}</p>
            <Button onClick={() => setShowDialog(true)}>
              <Plus className="w-4 h-4 mr-2" />
              {t("products.createElement")}
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {products.map((product) => (
              <div
                key={product.id}
                className="group cursor-pointer bg-card border border-border rounded-lg overflow-hidden hover:shadow-lg transition-shadow"
                onClick={() => navigate(`/products/${product.id}`)}
              >
                <div className="aspect-square overflow-hidden">
                  <img
                    src={product.images[0]?.image_url || "/placeholder.svg"}
                    alt={product.title}
                    className="w-full h-full object-cover transition-transform group-hover:scale-105"
                    crossOrigin="anonymous"
                  />
                </div>
                <div className="p-4">
                  <h3 className="font-semibold text-lg truncate">{product.title}</h3>
                  <p className="text-sm text-muted-foreground truncate">{product.brand}</p>
                  <div className="flex items-center justify-between mt-2">
                    <p className="text-xs text-muted-foreground">
                      {product.images.length} {product.images.length !== 1 ? t("products.imagesPlural") : t("products.images")}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(product.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("products.createNewElement")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-6 py-4">
            <div className="space-y-2">
              <Label htmlFor="title">{t("products.elementTitle")}</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={t("products.enterTitle")}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="brand">{t("products.brand")}</Label>
              <Input
                id="brand"
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
                placeholder={t("products.enterBrand")}
              />
            </div>
            <div className="space-y-2">
              <Label>{t("products.elementImages")}</Label>
              <label htmlFor="images-upload">
                <div className="border-2 border-dashed border-border rounded-lg p-8 text-center cursor-pointer hover:border-primary transition-colors">
                  <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    {t("products.clickToUpload")}
                  </p>
                </div>
                <input
                  id="images-upload"
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleImageUpload}
                  disabled={uploading}
                  className="hidden"
                />
              </label>
            </div>
            {uploadedImages.length > 0 && (
              <div className="grid grid-cols-3 gap-4">
                {uploadedImages.map((url, index) => (
                  <div key={index} className="relative group">
                    <img
                      src={url}
                      alt={`Element ${index + 1}`}
                      className="w-full aspect-square object-cover rounded-lg"
                      crossOrigin="anonymous"
                    />
                    <button
                      onClick={() => handleRemoveImage(index)}
                      className="absolute top-2 right-2 bg-destructive text-destructive-foreground rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="flex gap-4">
              <Button variant="outline" onClick={() => setShowDialog(false)} className="flex-1">
                {t("common.cancel")}
              </Button>
              <Button onClick={handleCreateProduct} className="flex-1">
                {t("products.createElement")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Products;
