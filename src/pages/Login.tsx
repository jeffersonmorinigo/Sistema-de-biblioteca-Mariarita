import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/auth/AuthContext';
import logo from '@/assets/logo.png';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { showError } from '@/utils/toast';

const LoginPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const navigate = useNavigate();
  const { login, usersLoaded } = useAuth();

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!usersLoaded) return;

    if (login(email, password)) {
      navigate('/');
    } else {
      showError('Email ou senha inválidos.');
    }
  };

  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-950 p-4">
      <Card className="w-full max-w-[400px] border-t-4 border-t-primary shadow-lg">
        <CardHeader className="text-center pt-8">
          <div className="flex justify-center mb-6">
            <img
              src={logo}
              alt="Logo Sistema de Gestão Escolar"
              className="w-32 h-32 object-contain"
            />
          </div>
          <CardTitle className="text-3xl font-bold tracking-tight">Sistema de Biblioteca</CardTitle>
          <CardDescription className="text-base">Faça login para acessar o painel</CardDescription>
        </CardHeader>
        <CardContent className="pb-8 px-8">
          <form onSubmit={handleLogin}>
            <div className="grid gap-5">
              <div className="grid gap-2">
                <Label htmlFor="email" className="font-semibold text-sm">Email</Label>
                <Input
                  id="email"
                  type="email"
                  required
                  className="bg-white"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="password" title="password" className="font-semibold text-sm">Senha</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  required
                  className="bg-white"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              <Button type="submit" className="w-full h-11 text-base font-semibold transition-all hover:scale-[1.02]" disabled={!usersLoaded}>
                {!usersLoaded ? 'Carregando dados...' : 'Entrar'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
      <footer className="absolute bottom-6 text-center text-xs text-muted-foreground">
        © 2026 Desenvolvido por Jefferson Morinigo - Todos os direitos reservados.
      </footer>
    </div>
  );
};

export default LoginPage;