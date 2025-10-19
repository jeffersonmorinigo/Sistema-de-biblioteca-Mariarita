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
import { Student } from '@/lib/types';
import { ClassCombobox } from './ClassCombobox';

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
  classes: string[];
  onAddClass: (value: string) => void;
  onDeleteClass: (value: string) => void;
}

const StudentForm = ({ student, onSubmit, closeDialog, classes, onAddClass, onDeleteClass }: StudentFormProps) => {
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
      class: data.class.toUpperCase(),
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
            <div className="col-span-3">
              <Controller
                name="class"
                control={control}
                render={({ field }) => (
                  <ClassCombobox
                    classes={classes}
                    value={field.value}
                    onChange={field.onChange}
                    onAddClass={onAddClass}
                    onDeleteClass={onDeleteClass}
                  />
                )}
              />
            </div>
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