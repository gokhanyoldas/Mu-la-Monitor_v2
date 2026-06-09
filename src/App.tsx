import { useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { lazy, Suspense } from "react";

const Index          = lazy(() => import("./pages/Index"));
const SocialIntel    = lazy(() => import("./pages/SocialIntel"));
const OSINTDashboard = lazy(() => import("./pages/OSINTDashboard"));
const DistrictPage   = lazy(() => import("./pages/DistrictPage"));
const NotFound       = lazy(() => import("./pages/NotFound"));

const PageLoader = () => (
  <div className="min-h-screen bg-background flex items-center justify-center">
    <div className="text-center">
      <div className="w-10 h-10 rounded-lg bg-primary/20 border border-primary/30 flex items-center justify-center mx-auto mb-3 animate-pulse">
        <span className="text-primary font-mono font-bold">M</span>
      </div>
      <p className="text-[10px] font-mono text-muted-foreground">Sayfa yükleniyor...</p>
    </div>
  </div>
);
import { intelligenceHub } from "@/lib/intelligence-hub";
import { AnomalyPanel } from "@/components/intelligence/AnomalyPanel";
import { AIStrategyPanel } from "@/components/intelligence/AIStrategyPanel";
import { DataQualityDashboard } from "@/components/DataQualityDashboard";
import { RealtimeAlertBanner } from "@/components/RealtimeAlertBanner";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { AuthPage } from "@/components/auth/AuthPage";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 2, staleTime: 5 * 60 * 1000 } },
});

function AppContent() {
  const { isAuthenticated, enterAsGuest } = useAuth();

  useEffect(() => {
    intelligenceHub.start();
    return () => { intelligenceHub.stop(); };
  }, []);

  if (!isAuthenticated) {
    return <AuthPage onAuth={enterAsGuest} />;
  }

  return (
    <BrowserRouter>
      <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route path="/" element={<Index />} />
        <Route path="/sosyal-istihbarat" element={<SocialIntel />} />
        <Route path="/osint" element={<OSINTDashboard />} />
        <Route path="/ilce/:ilceId" element={<DistrictPage />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
      </Suspense>
      <AnomalyPanel />
      <RealtimeAlertBanner />
      <AIStrategyPanel />
      <DataQualityDashboard />
    </BrowserRouter>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
