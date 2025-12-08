import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { extractStoragePath } from "@/lib/imageUtils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

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

interface Thumbnail {
  id: string;
  title: string | null;
  image_url: string;
  created_at: string;
}

const ProductDetail = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const [product, setProduct] = useState<Product | null>(null);
  const [thumbnails, setThumbnails] = useState<Thumbnail[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  useEffect(() => {
    checkUser();
    fetchProduct();
    fetchThumbnails();
  }, [id]);

  const checkUser = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate("/auth");
    }
  };

  const fetchProduct = async () => {
    try {
      const { data, error } = await supabase
        .from("products")
        .select(`
          *,
          images:product_images(id, image_url)
        `)
        .eq("id", id)
        .single();

      if (error) throw error;
      setProduct(data);
    } catch (error) {
      console.error("Error fetching product:", error);
      toast.error("Failed to load element");
      navigate("/products");
    } finally {
      setLoading(false);
    }
  };

  const fetchThumbnails = async () => {
    try {
      const { data, error } = await supabase
        .from("thumbnails")
        .select("*")
        .eq("product_id", id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setThumbnails(data || []);
    } catch (error) {
      console.error("Error fetching thumbnails:", error);
    }
  };

  const handleDelete = async () => {
    if (!product) return;

    try {
      // Delete product images from storage
      const storagePaths = product.images
        .map((img) => extractStoragePath(img.image_url, "products"))
        .filter((path): path is string => path !== null);

      if (storagePaths.length > 0) {
        const { error: storageError } = await supabase.storage
          .from("products")
          .remove(storagePaths);

        if (storageError) {
          console.error("Error deleting from storage:", storageError);
        }
      }

      // Delete product (cascade will delete images from DB)
      const { error } = await supabase
        .from("products")
        .delete()
        .eq("id", product.id);

      if (error) throw error;

      toast.success("Element deleted");
      navigate("/products");
    } catch (error) {
      console.error("Error deleting product:", error);
      toast.error("Failed to delete element");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b border-border bg-card">
          <div className="container mx-auto px-6 py-4">
            <div className="flex items-center gap-4">
              <Button variant="ghost" onClick={() => navigate("/products")}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
            </div>
          </div>
        </header>
        <main className="container mx-auto px-6 py-12">
          <div className="animate-pulse space-y-6">
            <div className="h-8 bg-muted rounded w-1/3" />
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="aspect-square bg-muted rounded-lg" />
              ))}
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (!product) return null;

  return (
    <div className="min-h-screen">
      <main className="container mx-auto px-6 py-12 pl-20 max-w-6xl space-y-8">
        <div className="flex justify-between items-center">
          <Button variant="ghost" onClick={() => navigate("/products")}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Elements
          </Button>
          <Button variant="destructive" onClick={() => setShowDeleteDialog(true)}>
            <Trash2 className="w-4 h-4 mr-2" />
            Delete Element
          </Button>
        </div>
        {/* Product Details */}
        <div className="space-y-4">
          <div>
            <h1 className="text-3xl font-bold mb-2">{product.title}</h1>
            <p className="text-xl text-muted-foreground">{product.brand}</p>
            <p className="text-sm text-muted-foreground mt-2">
              Created on {new Date(product.created_at).toLocaleDateString()}
            </p>
          </div>
        </div>

        {/* Element Images */}
        <div className="space-y-4">
          <h2 className="text-2xl font-semibold">Element Images ({product.images.length})</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {product.images.map((image, index) => (
              <div key={image.id} className="relative group">
                <div className="aspect-square rounded-lg overflow-hidden border border-border">
                  <img
                    src={image.image_url}
                    alt={`${product.title} ${index + 1}`}
                    className="w-full h-full object-cover"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Thumbnails with this element */}
        <div className="space-y-4">
          <h2 className="text-2xl font-semibold">
            Thumbnails using this element ({thumbnails.length})
          </h2>
          {thumbnails.length === 0 ? (
            <div className="text-center py-12 bg-card border border-border rounded-lg">
              <p className="text-muted-foreground">No thumbnails created with this element yet</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {thumbnails.map((thumbnail) => (
                <div
                  key={thumbnail.id}
                  className="group cursor-pointer bg-card border border-border rounded-lg overflow-hidden hover:shadow-lg transition-shadow"
                  onClick={() => navigate(`/thumbnail/${thumbnail.id}`)}
                >
                  <div className="aspect-video overflow-hidden">
                    <img
                      src={thumbnail.image_url}
                      alt={thumbnail.title || "Thumbnail"}
                      className="w-full h-full object-cover transition-transform group-hover:scale-105"
                    />
                  </div>
                  <div className="p-4">
                    <p className="font-medium truncate">{thumbnail.title || "Untitled"}</p>
                    <p className="text-sm text-muted-foreground">
                      {new Date(thumbnail.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Element?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the element "{product.title}" and all its images. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default ProductDetail;
