import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { CalendarIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Book, Student } from '@/lib/types';

const loanSchema = z.object({
  studentId: z.string().min(1, 'Selecione um aluno'),
  bookId: z.string().min(1, 'Selecione um livro'),
  expectedReturnDate: z.date({ required_error: 'Data de devolução é obrigatória' }),
});

export type LoanFormData = z.infer<typeof loanSchema>;

interface LoanFormProps {
  students: Student[];
  books: Book[];
  onSubmit: (data: LoanFormData) => void;
  closeDialog: () => void;
}

const LoanForm = ({ students, books, onSubmit, closeDialog }: LoanFormProps) => {
  const {
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<LoanFormData>({
    resolver: zodResolver(loanSchema),
  });

  const availableBooks = books.filter(book => book.quantity > 0);

  const handleFormSubmit = (data: LoanFormData) => {
    onSubmit(data);
    closeDialog();
  };

  return (
    <DialogContent className="sm:max-w-[425px]">
      <DialogHeader>
        <DialogTitle>Registrar Novo Empréstimo</DialogTitle>
      </DialogHeader>
      <form onSubmit={handleSubmit(handleFormSubmit)}>
        <div className="grid gap-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="studentId">Aluno</Label>
            <Controller
              name="studentId"
              control={control}
              render={({ field }) => (
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um aluno" />
                  </SelectTrigger>
                  <SelectContent>
                    {students.map(student => (
                      <SelectItem key={student.id} value={student.id}>
                        {student.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {errors.studentId && <p className="text-red-500 text-sm">{errors.studentId.message}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="bookId">Livro (Disponíveis)</Label>
            <Controller
              name="bookId"
              control={control}
              render={({ field }) => (
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um livro" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableBooks.map(book => (
                      <SelectItem key={book.id} value={book.id}>
                        {book.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {errors.bookId && <p className="text-red-500 text-sm">{errors.bookId.message}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="expectedReturnDate">Data Prevista de Devolução</Label>
            <Controller
              name="expectedReturnDate"
              control={control}
              render={({ field }) => (
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant={"outline"}
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !field.value && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {field.value ? format(field.value, 'PPP', { locale: ptBR }) : <span>Escolha uma data</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={field.value}
                      onSelect={field.onChange}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              )}
            />
            {errors.expectedReturnDate && <p className="text-red-500 text-sm">{errors.expectedReturnDate.message}</p>}
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="secondary">Cancelar</Button>
          </DialogClose>
          <Button type="submit">Registrar</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
};

export default LoanForm;