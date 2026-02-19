import { useState, useMemo } from 'react';
import { useFirestore } from '@/hooks/useFirestore';
import { useSettings } from '@/hooks/useSettings';
import { Loan, Book, Student } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
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
import { PlusCircle, Undo2, FileText, Search } from 'lucide-react';
import LoanForm, { LoanFormData } from '@/components/LoanForm';
import { showSuccess, showError } from '@/utils/toast';
import { format, isAfter } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

const LoansPage = () => {
  const { data: loans, add: addLoan, update: updateLoan } = useFirestore<Loan>('loans');
  const { data: books } = useFirestore<Book>('books');
  const { data: students } = useFirestore<Student>('students');
  const { settings } = useSettings();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const studentMap = useMemo(() => new Map(students.map(s => [s.id, s])), [students]);
  const bookMap = useMemo(() => new Map(books.map(b => [b.code, b])), [books]);

  const filteredAndSortedLoans = useMemo(() => {
    const filtered = loans.filter(loan => {
      if (!searchTerm) return true;
      const lowercasedFilter = searchTerm.toLowerCase();
      const student = studentMap.get(loan.studentId);
      const book = bookMap.get(loan.bookCode);

      const studentName = student?.name.toLowerCase() || '';
      const studentClass = student?.class.toLowerCase() || '';
      const bookTitle = book?.title.toLowerCase() || '';
      const bookShelf = book?.shelf.toLowerCase() || '';

      return studentName.includes(lowercasedFilter)
        || studentClass.includes(lowercasedFilter)
        || bookTitle.includes(lowercasedFilter)
        || bookShelf.includes(lowercasedFilter);
    });

    return filtered.sort((a, b) => {
      if (a.returnDate && !b.returnDate) return 1;
      if (!a.returnDate && b.returnDate) return -1;
      if (!a.returnDate && !b.returnDate) {
        const isOverdueA = isAfter(new Date(), new Date(a.expectedReturnDate));
        const isOverdueB = isAfter(new Date(), new Date(b.expectedReturnDate));
        if (isOverdueA && !isOverdueB) return -1;
        if (!isOverdueA && isOverdueB) return 1;
        return new Date(a.expectedReturnDate).getTime() - new Date(b.expectedReturnDate).getTime();
      }
      if (a.returnDate && b.returnDate) {
        return new Date(b.returnDate).getTime() - new Date(a.returnDate).getTime();
      }
      return 0;
    });
  }, [loans, searchTerm, studentMap, bookMap]);

  const handleAddLoan = async (data: LoanFormData) => {
    const bookToLoan = books.find(b => b.code === data.bookCode);
    if (!bookToLoan) {
      showError('Livro não encontrado.');
      return;
    }

    const activeLoansCount = loans.filter(l => l.bookCode === data.bookCode && !l.returnDate).length;
    if (activeLoansCount >= bookToLoan.quantity) {
      showError('Não há cópias disponíveis deste livro no momento.');
      return;
    }

    await addLoan({
      studentId: data.studentId,
      bookCode: data.bookCode,
      loanDate: new Date().toISOString(),
      expectedReturnDate: data.expectedReturnDate.toISOString(),
    });
    showSuccess('Empréstimo registrado com sucesso!');
    setIsDialogOpen(false);
  };

  const handleReturnLoan = async (loanId: string) => {
    await updateLoan(loanId, { returnDate: new Date().toISOString() });
    showSuccess('Devolução registrada com sucesso!');
  };

  const handleGenerateReport = () => {
    const overdueLoans = loans.filter(loan =>
      !loan.returnDate && isAfter(new Date(), new Date(loan.expectedReturnDate))
    );

    if (overdueLoans.length === 0) {
      showSuccess("Nenhum empréstimo atrasado para relatar.");
      return;
    }

    const schoolName = settings.schoolName || 'Nome da Escola não definido';

    const reportWindow = window.open('', '_blank');
    if (reportWindow) {
      reportWindow.document.write(`
        <html>
          <head>
            <title>Relatório de Empréstimos Atrasados</title>
            <style>
              body { 
                font-family: Arial, sans-serif; 
                margin: 0; 
                padding: 20px;
                color: #333;
              }
              @page {
                size: A4;
                margin: 1cm;
              }
              table { 
                width: 100%; 
                border-collapse: collapse; 
                margin-top: 20px;
                font-size: 10pt;
              }
              th, td { 
                border: 1px solid #ccc; 
                padding: 8px; 
                text-align: left; 
              }
              th { 
                background-color: #f0f0f0; 
                font-weight: bold;
              }
              h1 { 
                text-align: center; 
                margin-bottom: 5px; 
                font-size: 18pt;
              }
              h2 { 
                text-align: center; 
                font-weight: normal; 
                margin-top: 0; 
                margin-bottom: 20px; 
                font-size: 14pt;
              }
              .header { 
                margin-bottom: 20px; 
                border-bottom: 2px solid #333;
                padding-bottom: 10px;
              }
              .info {
                font-size: 10pt;
                margin-bottom: 10px;
              }
            </style>
          </head>
          <body>
            <div class="header">
              <h1>${schoolName}</h1>
              <h2>Relatório de Empréstimos Atrasados (${overdueLoans.length} itens)</h2>
            </div>
            <div class="info">
              <p>Gerado em: ${format(new Date(), 'dd/MM/yyyy HH:mm', { locale: ptBR })}</p>
            </div>
            <table>
              <thead>
                <tr>
                  <th>Aluno</th>
                  <th>Turma</th>
                  <th>Livro (Código)</th>
                  <th>Prateleira</th>
                  <th>Data de Devolução Prevista</th>
                </tr>
              </thead>
              <tbody>
                ${overdueLoans.map(loan => {
        const student = studentMap.get(loan.studentId);
        const book = bookMap.get(loan.bookCode);
        return `
                    <tr>
                      <td>${student?.name || 'N/A'}</td>
                      <td>${student?.class || 'N/A'}</td>
                      <td>${book?.title || 'N/A'} (${book?.code || 'N/A'})</td>
                      <td>${book?.shelf || 'N/A'}</td>
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
      setTimeout(() => {
        reportWindow.print();
      }, 500);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Gerenciamento de Empréstimos</h1>

      <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
        <div className="relative w-full sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <Input
            placeholder="Buscar por aluno, livro ou prateleira..."
            className="pl-10"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <Button onClick={handleGenerateReport} variant="outline" className="w-full sm:w-auto">
            <FileText className="mr-2 h-4 w-4" />
            Relatório de Atrasos (PDF)
          </Button>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="w-full sm:w-auto">
                <PlusCircle className="mr-2 h-4 w-4" />
                Registrar Empréstimo
              </Button>
            </DialogTrigger>
            <LoanForm
              key={isDialogOpen ? 'open' : 'closed'}
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
              <TableHead>Turma</TableHead>
              <TableHead>Livro</TableHead>
              <TableHead>Prateleira</TableHead>
              <TableHead>Data do Empréstimo</TableHead>
              <TableHead>Data de Devolução</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredAndSortedLoans.length > 0 ? (
              filteredAndSortedLoans.map(loan => {
                const isOverdue = !loan.returnDate && isAfter(new Date(), new Date(loan.expectedReturnDate));
                const student = studentMap.get(loan.studentId);
                const book = bookMap.get(loan.bookCode);
                return (
                  <TableRow key={loan.id} className={cn(isOverdue && 'bg-red-100 dark:bg-red-900/20')}>
                    <TableCell className="font-medium">{student?.name || 'Aluno não encontrado'}</TableCell>
                    <TableCell>{student?.class || 'N/A'}</TableCell>
                    <TableCell>{book?.title || 'Livro não encontrado'}</TableCell>
                    <TableCell>{book?.shelf || 'N/A'}</TableCell>
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
                    </TableCell>
                  </TableRow>
                );
              })
            ) : (
              <TableRow>
                <TableCell colSpan={8} className="text-center h-24">
                  {searchTerm ? "Nenhum empréstimo encontrado." : "Nenhum empréstimo registrado."}
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