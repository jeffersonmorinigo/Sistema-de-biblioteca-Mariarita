import { NavLink } from 'react-router-dom';
import { Book, Users, ArrowLeftRight, DatabaseBackup, UserCog, Settings, Library } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSettings } from '@/hooks/useSettings';
import logo from '@/assets/logo.png';

const navItems = [
  { href: '/loans', icon: ArrowLeftRight, label: 'Empréstimos' },
  { href: '/students', icon: Users, label: 'Alunos' },
  { href: '/books', icon: Book, label: 'Livros' },
  { href: '/users', icon: UserCog, label: 'Usuários' },
  { href: '/settings', icon: Settings, label: 'Configurações' },
  { href: '/backup', icon: DatabaseBackup, label: 'Backup & Restauração' },
];

const Sidebar = () => {
  const { settings } = useSettings();
  const schoolName = settings.schoolName;

  return (
    <aside className="w-64 flex-shrink-0 bg-card border-r p-4 flex flex-col">
      <div className="flex flex-col items-center justify-center gap-2 mb-8 text-center">
        <div className="flex flex-col items-center gap-2">
          <img
            src={logo}
            alt="Logo"
            className="w-20 h-20 object-contain"
          />
          <h1 className="text-xl font-bold">
            Biblioteca 2.0
          </h1>
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
    </aside>
  );
};

export default Sidebar;