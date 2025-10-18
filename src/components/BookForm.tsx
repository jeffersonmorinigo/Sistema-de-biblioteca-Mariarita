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
import { Book } from '@/lib/types';

const bookSchema = z.object({
  code: z.string().min(1, 'Código é obrigatório'),
  title: z.string().min(1, 'Título é obrigatório'),
  author: z.string().min(1, 'Autor é obrigatório'),
  category: z.string().min(1, 'Categoria é obrigatória'),
  quantity: z.coerce.number().min(0, 'Quantidade deve ser no mínimo 0'),
  year: z.coerce.number().min(1000, 'Ano inválido').max(new Date().getFullYear(), 'Ano não pode ser no futuro'),
});

export type BookFormData = z.infer<typeof bookSchema>;

interface BookFormProps {
  book?: Book | null;
  onSubmit: (data: BookFormData) => void;
  closeDialog: () => void;
}

const BookForm = ({ book, onSubmit, closeDialog }: BookFormProps) => {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<BookFormData>({
    resolver: zodResolver(bookSchema),
    defaultValues: book || {
      code: '',
      title: '',
      author: '',
      category: '',
      quantity: 0,
      year: new Date().getFullYear(),
    },
  });

  const handleFormSubmit = (data: BookFormData) => {
    onSubmit(data);
    closeDialog();
  };

  return (
    <DialogContent className="sm:max-w-[425px]">
      <DialogHeader>
        <DialogTitle>{book ? 'Editar Livro' : 'Adicionar Livro'}</DialogTitle>
      </DialogHeader>
      <form onSubmit={handleSubmit(handleFormSubmit)}>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="code" className="text-right">Código</Label>
            <Input id="code" {...register('code')} className="col-span-3" />
            {errors.code && <p className="col-span-4 text-red-500 text-sm text-right">{errors.code.message}</p>}
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="title" className="text-right">Título</Label>
            <Input id="title" {...register('title')} className="col-span-3" />
            {errors.title && <p className="col-span-4 text-red-500 text-sm text-right">{errors.title.message}</p>}
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="author" className="text-right">Autor</Label>
            <Input id="author" {...register('author')} className="col-span-3" />
            {errors.author && <p className="col-span-4 text-red-500 text-sm text-right">{errors.author.message}</p>}
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="category" className="text-right">Categoria</Label>
            <Input id="category" {...register('category')} className="col-span-3" />
            {errors.category && <p className="col-span-4 text-red-500 text-sm text-right">{errors.category.message}</p>}
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="quantity" className="text-right">Quantidade</Label>
            <Input id="quantity" type="number" {...register('quantity')} className="col-span-3" />
            {errors.quantity && <p className="col-span-4 text-red-500 text-sm text-right">{errors.quantity.message}</p>}
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="year" className="text-right">Ano</Label>
            <Input id="year" type="number" {...register('year')} className="col-span-3" />
            {errors.year && <p className="col-span-4 text-red-500 text-sm text-right">{errors.year.message}</p>}
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="secondary">Cancelar</Button>
          </DialogClose>
          <Button type="submit">{book ? 'Salvar' : 'Adicionar'}</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
};

export default BookForm;