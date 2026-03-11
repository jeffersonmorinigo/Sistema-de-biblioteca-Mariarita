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
import { useState, useEffect } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { format } from 'date-fns';

const studentSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório'),
  class: z.string().min(1, 'Turma é obrigatória'),
  type: z.string().min(1, 'Tipo é obrigatório'),
  isBlocked: z.boolean().default(false),
});

export type StudentFormData = z.infer<typeof studentSchema>;

interface StudentFormProps {
  student?: Student | null;
  onSubmit: (data: StudentFormData) => Promise<void> | void;
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
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<StudentFormData>({
    resolver: zodResolver(studentSchema),
    defaultValues: student ? {
      name: student.name,
      class: student.class,
      type: student.type || 'ALUNO', // Default type if missing
      isBlocked: student.isBlocked || false,
    } : {
      name: '',
      class: '',
      type: 'ALUNO',
      isBlocked: false,
    },
  });

  // Local state to ensure immediate visual updates for combobox
  const [currentClass, setCurrentClass] = useState(student?.class || '');

  useEffect(() => {
    setCurrentClass(student?.class || '');
  }, [student]);

  const isBlocked = watch('isBlocked');

  const handleFormSubmit = async (data: StudentFormData) => {
    const transformedData = {
      ...data,
      name: data.name.toUpperCase(),
      class: data.class.toUpperCase(),
      type: data.type.toUpperCase(),
    };
    try {
      await onSubmit(transformedData);
      closeDialog();
    } catch (error) {
      console.error('Erro ao salvar aluno:', error);
      // Erro é mostrado pelo toast no pai, mas aqui garantimos que o dialog não fecha se falhar
    }
  };

  return (
    <DialogContent className="sm:max-w-[425px]">
      <DialogHeader>
        <DialogTitle>{student ? 'Editar Aluno' : 'Adicionar Aluno'}</DialogTitle>
      </DialogHeader>
      <form onSubmit={handleSubmit(handleFormSubmit)}>
        <div className="grid gap-4 py-4">
          {/* RA REMOVIDO */}
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="name" className="text-right">Nome Completo</Label>
            <Input id="name" {...register('name')} className="col-span-3 uppercase" />
            {errors.name && <p className="col-span-4 text-red-500 text-sm text-right">{errors.name.message}</p>}
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="type" className="text-right">Tipo</Label>
            <Input id="type" {...register('type')} className="col-span-3 uppercase" placeholder="Ex: ALUNO, PROFESSOR" />
            {errors.type && <p className="col-span-4 text-red-500 text-sm text-right">{errors.type.message}</p>}
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
                    value={currentClass}
                    onChange={(newValue) => {
                      setCurrentClass(newValue); // Update visual state immediately
                      field.onChange(newValue); // Update form state for submission
                    }}
                    onAddClass={onAddClass}
                    onDeleteClass={onDeleteClass}
                  />
                )}
              />
            </div>
            {errors.class && <p className="col-span-4 text-red-500 text-sm text-right">{errors.class.message}</p>}
          </div>
          
          <div className="grid grid-cols-4 items-center gap-4 pt-2">
            <Label htmlFor="isBlocked" className="text-right">Bloqueado</Label>
            <div className="col-span-3 flex items-center space-x-2">
              <Controller
                name="isBlocked"
                control={control}
                render={({ field }) => (
                  <Checkbox
                    id="isBlocked"
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                )}
              />
              <span className="text-sm text-muted-foreground">
                {isBlocked ? `Bloqueado desde ${student?.blockDate ? format(new Date(student.blockDate), 'dd/MM/yyyy') : 'N/A'}` : 'Não bloqueado'}
              </span>
            </div>
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="secondary">Cancelar</Button>
          </DialogClose>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Salvando...' : (student ? 'Salvar' : 'Adicionar')}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
};

export default StudentForm;