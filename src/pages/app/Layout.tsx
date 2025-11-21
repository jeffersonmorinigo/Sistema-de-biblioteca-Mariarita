import React, { useState, useEffect } from 'react';
import Sidebar from '@/components/Sidebar';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { Loan } from '@/lib/types';
import { isAfter } from 'date-fns';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertTriangle } from 'lucide-react';
import LogoutButton from '@/components/LogoutButton';

const AppLayout = ({ children }: { children: React.ReactNode }) => {
  const [loans] = useLocalStorage<Loan[]>('loans', []);
  const [overdueCount, setOverdueCount] = useState(0);

  useEffect(() => {
    const checkForOverdueLoans = () => {
      const overdue = loans.filter(loan => 
        !loan.returnDate && isAfter(new Date(), new Date(loan.expectedReturnDate))
      );
      setOverdueCount(overdue.length);
    };

    checkForOverdueLoans();
    const intervalId = setInterval(checkForOverdueLoans, 2 * 60 * 60 * 1000);
    return () => clearInterval(intervalId);
  }, [loans]);

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <main className="flex-1 flex flex-col p-4 sm:p-6 lg:p-8 relative">
        <div className="absolute top-4 right-4 z-10">
          <LogoutButton />
        </div>
        
        <div className="flex-grow overflow-y-auto">
          {overdueCount > 0 && (
            <Alert variant="destructive" className="mb-6">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle className="font-bold text-lg">Atenção: Empréstimos Atrasados!</AlertTitle>
              <AlertDescription>
                Existem <strong>{overdueCount} empréstimo(s)</strong> com a data de devolução vencida. 
                Por favor, verifique a página de <a href="/loans" className="underline font-semibold">Empréstimos</a> para tomar as devidas providências.
              </AlertDescription>
            </Alert>
          )}
          {children}
        </div>
      </main>
    </div>
  );
};

export default AppLayout;