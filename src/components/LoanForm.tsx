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
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { CalendarIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, addDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Book, Student } from '@/lib/types';
import { StudentCombobox } from './StudentCombobox';
import { BookCombobox } from './BookCombobox';
import { useState } from 'react';

const loanSchema = z.object({
  studentId: z.string().min(1, 'Selecione um aluno'),
  bookCode: z.string().min(1, 'Selecione um livro'),
  expectedReturnDate: z.date({ required_error: 'Data de devolução é obrigatória' }),
});

export type LoanFormData = z.infer<typeof loanSchema>;

interface LoanFormProps {
  students: Student[];
  books: Book[];
  onSubmit: (data: LoanFormData) => void;
}

const LoanForm = ({ students, books, onSubmit }: LoanFormProps) => {
  const {
    handleSubmit,
    control,
    formState: { errors },
    reset,
  } = useForm<LoanFormData>({
    resolver: zodResolver(loanSchema),
    defaultValues: {
      studentId: '',
      bookCode: '',
      expectedReturnDate: addDays(new Date(), 15),
    },
  });

  // Local state to ensure immediate UI updates
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [selectedBookCode, setSelectedBookCode] = useState('');

  const handleFormSubmit = (data: LoanFormData) => {
    onSubmit(data);
    reset(); // Resets react-hook-form state
    // Manually reset local state to clear the comboboxes visually
    setSelectedStudentId('');
    setSelectedBookCode('');
  };

  return (
    <DialogContent className="sm:max-w-[600px]">
      <DialogHeader>
        <DialogTitle>Registrar Novo Empréstimo</DialogTitle>
      </DialogHeader>
      <form onSubmit={handleSubmit(handleFormSubmit)}>
        <div className="grid gap-5 py-4 grid-cols-1 sm:grid-cols-2">
          {/* Aluno ocupa a primeira coluna */}
          <div className="space-y-2 sm:col-span-1">
            <Label htmlFor="studentId">Aluno</Label>
            <Controller
              name="studentId"
              control={control}
              render={({ field }) => (
                <StudentCombobox
                  students={students}
                  value={selectedStudentId}
                  onChange={(value) => {
                    field.onChange(value);
                    setSelectedStudentId(value);
                  }}
                />
              )}
            />
            {errors.studentId && <p className="text-red-500 text-sm mt-1">{errors.studentId.message}</p>}
          </div>

          {/* Livro ocupa a segunda coluna */}
          <div className="space-y-2 sm:col-span-1">
            <Label htmlFor="bookCode">Livro (Disponíveis)</Label>
            <Controller
              name="bookCode"
              control={control}
              render={({ field }) => (
                <BookCombobox
                  books={books}
                  value={selectedBookCode}
                  onChange={(value) => {
                    field.onChange(value);
                    setSelectedBookCode(value);
                  }}
                />
              )}
            />
            {errors.bookCode && <p className="text-red-500 text-sm mt-1">{errors.bookCode.message}</p>}
          </div>

          {/* Data de Devolução ocupa a largura total em telas pequenas, ou a primeira coluna em telas grandes */}
          <div className="space-y-2 sm:col-span-2">
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
                      locale={ptBR}
                      // Garante que a data mínima seja hoje
                      disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                    />
                  </PopoverContent>
                </Popover>
              )}
            />
            {errors.expectedReturnDate && <p className="text-red-500 text-sm mt-1">{errors.expectedReturnDate.message}</p>}
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