import React, { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from '@/components/Sidebar';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { Loan } from '@/lib/types';
import { isAfter } from 'date-fns';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertTriangle } from 'lucide-react';

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

    // Check immediately on load
    checkForOverdueLoans();

    // Set up an interval to check every 2 hours
    const intervalId = setInterval(checkForOverdueLoans, 2 * 60 * 60 * 1000); // 2 hours in milliseconds

    // Clean up the interval when the component unmounts
    return () => clearInterval(intervalId);
  }, [loans]); // Rerun effect if loans data changes

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-auto">
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
      </main>
    </div>
  );
};

export default AppLayout;