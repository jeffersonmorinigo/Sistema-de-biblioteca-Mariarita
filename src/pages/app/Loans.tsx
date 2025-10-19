import { useState, useMemo, useEffect } from 'react';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { Loan, Book, Student } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { PlusCircle, Trash2, Undo2, FileText } from 'lucide-react';
import LoanForm, { LoanFormData } from '@/components/LoanForm';
import { showSuccess, showError } from '@/utils/toast';
import { format, isAfter } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

const generateId = () => Date.now().toString(36) + Math.random().toString(36).substr(2);

const LoansPage = () => {
  const [loans, setLoans] = useLocalStorage<Loan[]>('loans', []);
  const [books, setBooks] = useLocalStorage<Book[]>('books', []);
  const [students, setStudents] = useLocalStorage<Student[]>('students', []);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const studentMap = useMemo(() => new Map(students.map(s => [s.id, s])), [students]);
  const bookMap = useMemo(() => new Map(books.map(b => [b.id, b.title])), [books]);

  // Overdue loans alert
  useEffect(() => {
    const overdueCheckPerformed = sessionStorage.getItem('overdue_check_performed');
    if (overdueCheckPerformed) return;

    const overdueLoans = loans.filter(loan => 
      !loan.returnDate && isAfter(new Date(), new Date(loan.expectedReturnDate))
    );

    if (overdueLoans.length > 0) {
      showError(`Atenção: Existem ${overdueLoans.length} empréstimos com devolução atrasada.`);
    }

    sessionStorage.setItem('overdue_check_performed', 'true');
  }, [loans]);

  const handleAddLoan = (data: LoanFormData) => {
    const hasActiveLoan = loans.some(
      loan => loan.studentId === data.studentId && loan.bookId === data.bookId && !loan.returnDate
    );

    if (hasActiveLoan) {
      showError('Este aluno já possui um empréstimo ativo para este livro.');
      return;
    }

    const newLoan: Loan = {
      id: generateId(),
      studentId: data.studentId,
      bookId: data.bookId,
      loanDate: new Date().toISOString(),
      expectedReturnDate: data.expectedReturnDate.toISOString(),
    };
    setLoans([...loans, newLoan]);
    setBooks(books.map(b => b.id === data.bookId ? { ...b, quantity: b.quantity - 1 } : b));
    showSuccess('Empréstimo registrado com sucesso!');
  };

  const handleReturnLoan = (loanId: string) => {
    const loan = loans.find(l => l.id === loanId);
    if (!loan) return;
    setLoans(loans.map(l => l.id === loanId ? { ...l, returnDate: new Date().toISOString() } : l));
    setBooks(books.map(b => b.id === loan.bookId ? { ...b, quantity: b.quantity + 1 } : b));
    showSuccess('Devolução registrada com sucesso!');
  };

  const handleDeleteLoan = (loanId: string) => {
    const loanToDelete = loans.find(l => l.id === loanId);
    if (!loanToDelete) return;
    if (!loanToDelete.returnDate) {
      setBooks(books.map(b => b.id === loanToDelete.bookId ? { ...b, quantity: b.quantity + 1 } : b));
    }
    setLoans(loans.filter(l => l.id !== loanId));
    showSuccess('Registro de empréstimo excluído!');
  };

  const handleGenerateReport = () => {
    const overdueLoans = loans.filter(loan => 
      !loan.returnDate && isAfter(new Date(), new Date(loan.expectedReturnDate))
    );

    if (overdueLoans.length === 0) {
      showSuccess("Nenhum empréstimo atrasado para relatar.");
      return;
    }
    
    const schoolName = JSON.parse(localStorage.getItem('schoolName') || '""') || 'Nome da Escola não definido';

    const reportWindow = window.open('', '_blank');
    if (reportWindow) {
      reportWindow.document.write(`
        <html>
          <head>
            <title>Relatório de Empréstimos Atrasados</title>
            <style>
              body { font-family: sans-serif; margin: 2em; }
              table { width: 100%; border-collapse: collapse; }
              th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
              th { background-color: #f2f2f2; }
              h1, h2 { text-align: center; margin: 0; }
              h2 { font-weight: normal; margin-bottom: 1em; }
              .header { margin-bottom: 2em; }
            </style>
          </head>
          <body>
            <div class="header">
              <h1>${schoolName}</h1>
              <h2>Relatório de Empréstimos Atrasados</h2>
            </div>
            <p>Gerado em: ${format(new Date(), 'dd/MM/yyyy HH:mm', { locale: ptBR })}</p>
            <table>
              <thead>
                <tr>
                  <th>Aluno</th>
                  <th>RA</th>
                  <th>Livro</th>
                  <th>Data de Devolução Prevista</th>
                </tr>
              </thead>
              <tbody>
                ${overdueLoans.map(loan => {
                  const student = studentMap.get(loan.studentId);
                  const bookTitle = bookMap.get(loan.bookId);
                  return `
                    <tr>
                      <td>${student?.name || 'N/A'}</td>
                      <td>${student?.registration || 'N/A'}</td>
                      <td>${bookTitle || 'N/A'}</td>
                      <td>${format(new Date(loan.expectedReturnDate), 'dd/MM/yyyy', { locale: ptBR })}</td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </body>
        </html>
      `);
      reportWindow.document.close();
      reportWindow.print();
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
        <h1 className="text-3xl font-bold">Gerenciamento de Empréstimos</h1>
        <div className="flex gap-2 w-full sm:w-auto">
          <Button onClick={handleGenerateReport} variant="outline" className="w-full">
            <FileText className="mr-2 h-4 w-4" />
            Relatório de Atrasos
          </Button>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="w-full">
                <PlusCircle className="mr-2 h-4 w-4" />
                Registrar Empréstimo
              </Button>
            </DialogTrigger>
            <LoanForm 
              students={students}
              books={books}
              onSubmit={handleAddLoan} 
            />
          </Dialog>
        </div>
      </div>

      <div className="border rounded-lg overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Aluno</TableHead>
              <TableHead>Livro</TableHead>
              <TableHead>Data do Empréstimo</TableHead>
              <TableHead>Data de Devolução</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loans.length > 0 ? (
              loans.map(loan => {
                const isOverdue = !loan.returnDate && isAfter(new Date(), new Date(loan.expectedReturnDate));
                return (
                  <TableRow key={loan.id} className={cn(isOverdue && 'bg-red-100 dark:bg-red-900/20')}>
                    <TableCell className="font-medium">{studentMap.get(loan.studentId)?.name || 'Aluno não encontrado'}</TableCell>
                    <TableCell>{bookMap.get(loan.bookId) || 'Livro não encontrado'}</TableCell>
                    <TableCell>{format(new Date(loan.loanDate), 'dd/MM/yyyy', { locale: ptBR })}</TableCell>
                    <TableCell>{format(new Date(loan.expectedReturnDate), 'dd/MM/yyyy', { locale: ptBR })}</TableCell>
                    <TableCell>
                      {loan.returnDate ? (
                        <Badge variant="secondary">Devolvido</Badge>
                      ) : isOverdue ? (
                        <Badge variant="destructive">Atrasado</Badge>
                      ) : (
                        <Badge>Emprestado</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {!loan.returnDate && (
                        <Button variant="outline" size="sm" onClick={() => handleReturnLoan(loan.id)}>
                          <Undo2 className="mr-2 h-4 w-4" />
                          Devolver
                        </Button>
                      )}
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="ml-2 text-red-500 hover:text-red-600">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Você tem certeza?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Essa ação não pode ser desfeita. Isso excluirá permanentemente o registro.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDeleteLoan(loan.id)}>
                              Excluir
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </TableCell>
                  </TableRow>
                );
              })
            ) : (
              <TableRow>
                <TableCell colSpan={6} className="text-center h-24">
                  Nenhum empréstimo registrado.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default LoansPage;