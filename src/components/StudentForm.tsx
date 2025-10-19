import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import { Student } from '@/lib/types';

const studentSchema = z.object({
  registration: z.string().min(1, 'RA é obrigatório'),
  name: z.string().min(1, 'Nome é obrigatório'),
  class: z.string().min(1, 'Turma é obrigatória'),
});

export type StudentFormData = z.infer<typeof studentSchema>;

interface StudentFormProps {
  student?: Student | null;
  onSubmit: (data: StudentFormData) => void;
  closeDialog: () => void;
}

const classOptions = [
  '1º ANO A', '1º ANO B', '1º ANO C',
  '2º ANO A', '2º ANO B', '2º ANO C',
  '3º ANO A', '3º ANO B', '3º ANO C',
  '4º ANO A', '4º ANO B', '4º ANO C',
  '5º ANO A', '5º ANO B', '5º ANO C',
  '6º ANO A', '6º ANO B', '6º ANO C',
  '7º ANO A', '7º ANO B', '7º ANO C',
  '8º ANO A', '8º ANO B', '8º ANO C',
  '9º ANO A', '9º ANO B', '9º ANO C',
];

const StudentForm = ({ student, onSubmit, closeDialog }: StudentFormProps) => {
  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<StudentFormData>({
    resolver: zodResolver(studentSchema),
    defaultValues: student || {
      registration: '',
      name: '',
      class: '',
    },
  });

  const handleFormSubmit = (data: StudentFormData) => {
    const transformedData = {
      ...data,
      name: data.name.toUpperCase(),
    };
    onSubmit(transformedData);
    closeDialog();
  };

  return (
    <DialogContent className="sm:max-w-[425px]">
      <DialogHeader>
        <DialogTitle>{student ? 'Editar Aluno' : 'Adicionar Aluno'}</DialogTitle>
      </DialogHeader>
      <form onSubmit={handleSubmit(handleFormSubmit)}>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="registration" className="text-right">RA</Label>
            <Input id="registration" {...register('registration')} className="col-span-3" />
            {errors.registration && <p className="col-span-4 text-red-500 text-sm text-right">{errors.registration.message}</p>}
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="name" className="text-right">Nome Completo</Label>
            <Input id="name" {...register('name')} className="col-span-3 uppercase" />
            {errors.name && <p className="col-span-4 text-red-500 text-sm text-right">{errors.name.message}</p>}
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="class" className="text-right">Turma</Label>
            <Controller
              name="class"
              control={control}
              render={({ field }) => (
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <SelectTrigger className="col-span-3">
                    <SelectValue placeholder="Selecione a turma" />
                  </SelectTrigger>
                  <SelectContent>
                    {classOptions.map((option) => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {errors.class && <p className="col-span-4 text-red-500 text-sm text-right">{errors.class.message}</p>}
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="secondary">Cancelar</Button>
          </DialogClose>
          <Button type="submit">{student ? 'Salvar' : 'Adicionar'}</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
};

export default StudentForm;