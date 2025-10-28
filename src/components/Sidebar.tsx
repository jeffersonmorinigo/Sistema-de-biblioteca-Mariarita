import { NavLink, useNavigate } from 'react-router-dom';
import { Book, Users, ArrowLeftRight, DatabaseBackup, LogOut, Library, UserCog, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/auth/AuthContext';
import { cn } from '@/lib/utils';
import { useLocalStorage } from '@/hooks/useLocalStorage';

const navItems = [
  { href: '/loans', icon: ArrowLeftRight, label: 'Empréstimos' },
  { href: '/students', icon: Users, label: 'Alunos' },
  { href: '/books', icon: Book, label: 'Livros' },
  { href: '/users', icon: UserCog, label: 'Usuários' },
  { href: '/settings', icon: Settings, label: 'Configurações' },
  { href: '/backup', icon: DatabaseBackup, label: 'Backup & Restauração' },
];

const Sidebar = () => {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [schoolName] = useLocalStorage('schoolName', '');

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
    <aside className="w-64 flex-shrink-0 bg-card border-r p-4 flex flex-col">
      <div className="flex flex-col items-center justify-center gap-2 mb-8 text-center">
        <div className="flex items-center gap-2">
          <Library className="w-8 h-8 text-primary" />
          <h1 className="text-2xl font-bold">Biblioteca</h1>
        </div>
        {schoolName && (
          <p className="text-sm text-muted-foreground px-2">{schoolName}</p>
        )}
      </div>
      <nav className="flex-grow">
        <ul>
          {navItems.map((item) => (
            <li key={item.href}>
              <NavLink
                to={item.href}
                className={({ isActive }) =>
                  cn(
                    'flex items-center p-3 rounded-lg transition-colors mb-2',
                    isActive
                      ? 'bg-primary text-primary-foreground'
                      : 'hover:bg-accent hover:text-accent-foreground'
                  )
                }
              >
                <item.icon className="w-5 h-5 mr-3" />
                {item.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
      <Button variant="ghost" onClick={handleLogout} className="w-full justify-start">
        <LogOut className="w-5 h-5 mr-3" />
        Sair
      </Button>
    </aside>
  );
};

export default Sidebar;