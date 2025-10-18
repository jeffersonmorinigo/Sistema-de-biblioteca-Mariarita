import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./auth/AuthContext";

import LoginPage from "./pages/Login";
import AppLayout from "./pages/app/Layout";
import BooksPage from "./pages/app/Books";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const AppRoutes = () => {
  const { isAuthenticated } = useAuth();

  return (
    <Routes>
      <Route path="/login" element={!isAuthenticated ? <LoginPage /> : <Navigate to="/" />} />
      <Route path="/" element={isAuthenticated ? <AppLayout /> : <Navigate to="/login" />}>
        <Route index element={<Navigate to="/books" />} />
        <Route path="books" element={<BooksPage />} />
        <Route path="students" element={<div className="text-3xl font-bold">Gerenciamento de Alunos (em breve)</div>} />
        <Route path="loans" element={<div className="text-3xl font-bold">Gerenciamento de Empréstimos (em breve)</div>} />
        <Route path="backup" element={<div className="text-3xl font-bold">Backup & Restauração (em breve)</div>} />
      </Route>
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;