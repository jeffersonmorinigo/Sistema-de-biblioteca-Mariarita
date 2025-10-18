import { NavLink, useNavigate } from 'react-router-dom';
import { Book, Users, ArrowLeftRight, DatabaseBackup, LogOut, Library } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/auth/AuthContext';
import { cn } from '@/lib/utils';

const navItems = [
  { href: '/books', icon: Book, label: 'Livros' },
  { href: '/students', icon: Users, label: 'Alunos' },
  { href: '/loans', icon: ArrowLeftRight, label: 'Empréstimos' },
  { href: '/backup', icon: DatabaseBackup, label: 'Backup & Restauração' },
];

const Sidebar = () => {
  const { logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <aside className="w-64 flex-shrink-0 bg-card border-r p-4 flex flex-col">
      <div className="flex items-center justify-center gap-2 mb-8">
        <Library className="w-8 h-8 text-primary" />
        <h1 className="text-2xl font-bold text-center">Biblioteca</h1>
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