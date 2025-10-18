import { useForm } from 'react-hook-form';
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

const userSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório'),
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'A senha deve ter no mínimo 6 caracteres'),
});

export type UserFormData = z.infer<typeof userSchema>;

interface UserFormProps {
  onSubmit: (data: UserFormData) => void;
  closeDialog: () => void;
}

const UserForm = ({ onSubmit, closeDialog }: UserFormProps) => {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<UserFormData>({
    resolver: zodResolver(userSchema),
  });

  const handleFormSubmit = (data: UserFormData) => {
    onSubmit(data);
    closeDialog();
  };

  return (
    <DialogContent className="sm:max-w-[425px]">
      <DialogHeader>
        <DialogTitle>Adicionar Novo Usuário</DialogTitle>
      </DialogHeader>
      <form onSubmit={handleSubmit(handleFormSubmit)}>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="name" className="text-right">Nome</Label>
            <Input id="name" {...register('name')} className="col-span-3" />
            {errors.name && <p className="col-span-4 text-red-500 text-sm text-right">{errors.name.message}</p>}
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="email" className="text-right">Email</Label>
            <Input id="email" type="email" {...register('email')} className="col-span-3" />
            {errors.email && <p className="col-span-4 text-red-500 text-sm text-right">{errors.email.message}</p>}
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="password" className="text-right">Senha</Label>
            <Input id="password" type="password" {...register('password')} className="col-span-3" />
            {errors.password && <p className="col-span-4 text-red-500 text-sm text-right">{errors.password.message}</p>}
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="secondary">Cancelar</Button>
          </DialogClose>
          <Button type="submit">Adicionar</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
};

export default UserForm;