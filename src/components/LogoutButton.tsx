import { LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/auth/AuthContext';
import { useNavigate } from 'react-router-dom';

const LogoutButton = () => {
  const { logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    // Se estiver no ambiente Electron, fechar o aplicativo
    if (window.electron && window.electron.quitApp) {
      window.electron.quitApp();
    } else {
      // Caso contrário (ambiente web), navegar para a página de login
      navigate('/login');
    }
  };

  return (
    <Button 
      variant="ghost" 
      onClick={handleLogout} 
      className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground"
    >
      <LogOut className="w-4 h-4" />
      Sair
    </Button>
  );
};

export default LogoutButton;