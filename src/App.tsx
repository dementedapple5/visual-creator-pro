import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AppLayout } from "./components/AppLayout";
import { ThemeProvider } from "./components/ThemeProvider";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Profile from "./pages/Profile";
import Avatars from "./pages/Avatars";
import CreateNew from "./pages/CreateNew";
import Generations from "./pages/Generations";
import Products from "./pages/Products";
import ProductDetail from "./pages/ProductDetail";
import ThumbnailDetail from "./pages/ThumbnailDetail";
import Backgrounds from "./pages/Backgrounds";
import Titles from "./pages/Titles";
import FontStyles from "./pages/FontStyles";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme" attribute="class" enableSystem disableTransitionOnChange>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<Auth />} />
            <Route
              path="/dashboard"
              element={
                <AppLayout>
                  <Dashboard />
                </AppLayout>
              }
            />
            <Route
              path="/profile"
              element={
                <AppLayout>
                  <Profile />
                </AppLayout>
              }
            />
            <Route
              path="/avatars"
              element={
                <AppLayout>
                  <Avatars />
                </AppLayout>
              }
            />
            <Route
              path="/backgrounds"
              element={
                <AppLayout>
                  <Backgrounds />
                </AppLayout>
              }
            />
            <Route
              path="/titles"
              element={
                <AppLayout>
                  <Titles />
                </AppLayout>
              }
            />
            <Route
              path="/font-styles"
              element={
                <AppLayout>
                  <FontStyles />
                </AppLayout>
              }
            />
            <Route
              path="/create"
              element={
                <AppLayout>
                  <CreateNew />
                </AppLayout>
              }
            />
            <Route
              path="/generations"
              element={
                <AppLayout>
                  <Generations />
                </AppLayout>
              }
            />
            <Route
              path="/products"
              element={
                <AppLayout>
                  <Products />
                </AppLayout>
              }
            />
            <Route
              path="/products/:id"
              element={
                <AppLayout>
                  <ProductDetail />
                </AppLayout>
              }
            />
            <Route
              path="/thumbnail/:id"
              element={
                <AppLayout>
                  <ThumbnailDetail />
                </AppLayout>
              }
            />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
