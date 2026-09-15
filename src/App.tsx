import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import AuthPage from "./pages/AuthPage";
import Dashboard from "./pages/Dashboard";
import Clients from "./pages/Clients";
import Events from "./pages/Events";
import Photos from "./pages/Photos";
import Layout from "./components/Layout";
import ErrorBoundary from "./components/ErrorBoundary";
import NotFound from "./pages/NotFound";
import { supabaseConfigError } from "./integrations/supabase/client";


const queryClient = new QueryClient();

function ConfigurationError() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-100 p-6">
      <section className="w-full max-w-lg rounded-2xl bg-white p-8 shadow-lg">
        <h1 className="text-xl font-semibold text-slate-900">No se pudo cargar la aplicación</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          El despliegue no tiene configuradas las credenciales públicas de Supabase.
          En Vercel o Lovable añade las variables de <code> .env.example </code> y vuelve a desplegar.
        </p>
        <pre className="mt-5 overflow-auto rounded-lg bg-slate-950 p-4 text-xs text-slate-100">{supabaseConfigError}</pre>
      </section>
    </main>
  );
}

function ProtectedApp() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center gradient-primary">
        <div className="text-white text-center">
          <div className="w-10 h-10 border-3 border-white border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm opacity-80">Cargando...</p>
        </div>
      </div>
    );
  }

  if (!user) return <AuthPage />;

  return (
    <Layout>
      <ErrorBoundary>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/clientes" element={<Clients />} />
          <Route path="/eventos" element={<Events />} />
          <Route path="/fotos" element={<Photos />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </ErrorBoundary>
    </Layout>
  );
}


const App = () => (
  supabaseConfigError ? <ConfigurationError /> : (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <ProtectedApp />
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  )
);

export default App;
