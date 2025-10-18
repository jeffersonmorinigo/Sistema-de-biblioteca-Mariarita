import { useState, useMemo } from 'react';
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
import { PlusCircle, Trash2, Undo2 } from 'lucide-react';
import LoanForm, { LoanFormData } from '@/components/LoanForm';
import { showSuccess } from '@/utils/toast';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const generateId = () => Date.now().toString(36) + Math.random().toString(36).substr(2);

const LoansPage = () => {
  const [loans, setLoans] = useLocalStorage<Loan[]>('loans', []);
  const [books, setBooks] = useLocalStorage<Book[]>('books', []);
  const [students, setStudents] = useLocalStorage<Student[]>('students', []);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const studentMap = useMemo(() => new Map(students.map(s => [s.id, s.name])), [students]);
  const bookMap = useMemo(() => new Map(books.map(b => [b.id, b.title])), [books]);

  const handleAddLoan = (data: LoanFormData) => {
    const newLoan: Loan = {
      id: generateId(),
      studentId: data.studentId,
      bookId: data.bookId,
      loanDate: new Date().toISOString(),
      expectedReturnDate: data.expectedReturnDate.toISOString(),
    };
    setLoans([...loans, newLoan]);
    
    // Decrement book quantity
    setBooks(books.map(b => b.id === data.bookId ? { ...b, quantity: b.quantity - 1 } : b));
    
    showSuccess('Empréstimo registrado com sucesso!');
  };

  const handleReturnLoan = (loanId: string) => {
    const loan = loans.find(l => l.id === loanId);
    if (!loan) return;

    setLoans(loans.map(l => l.id === loanId ? { ...l, returnDate: new Date().toISOString() } : l));
    
    // Increment book quantity
    setBooks(books.map(b => b.id === loan.bookId ? { ...b, quantity: b.quantity + 1 } : b));

    showSuccess('Devolução registrada com sucesso!');
  };

  const handleDeleteLoan = (loanId: string) => {
    const loanToDelete = loans.find(l => l.id === loanId);
    if (!loanToDelete) return;

    // If the book was not returned, increment its quantity back
    if (!loanToDelete.returnDate) {
      setBooks(books.map(b => b.id === loanToDelete.bookId ? { ...b, quantity: b.quantity + 1 } : b));
    }

    setLoans(loans.filter(l => l.id !== loanId));
    showSuccess('Registro de empréstimo excluído!');
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Gerenciamento de Empréstimos</h1>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <PlusCircle className="mr-2 h-4 w-4" />
              Registrar Empréstimo
            </Button>
          </DialogTrigger>
          <LoanForm 
            students={students}
            books={books}
            onSubmit={handleAddLoan} 
            closeDialog={() => setIsDialogOpen(false)}
          />
        </Dialog>
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
              loans.map(loan => (
                <TableRow key={loan.id}>
                  <TableCell className="font-medium">{studentMap.get(loan.studentId) || 'Aluno não encontrado'}</TableCell>
                  <TableCell>{bookMap.get(loan.bookId) || 'Livro não encontrado'}</TableCell>
                  <TableCell>{format(new Date(loan.loanDate), 'dd/MM/yyyy', { locale: ptBR })}</TableCell>
                  <TableCell>{format(new Date(loan.expectedReturnDate), 'dd/MM/yyyy', { locale: ptBR })}</TableCell>
                  <TableCell>
                    {loan.returnDate ? (
                      <Badge variant="secondary">Devolvido</Badge>
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
              ))
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