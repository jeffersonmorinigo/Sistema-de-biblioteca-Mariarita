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
import { Book } from '@/lib/types';
import { CategoryCombobox } from './CategoryCombobox';

const bookSchema = z.object({
  code: z.string().min(1, 'Código é obrigatório'),
  isbn: z.string(),
  title: z.string().min(1, 'Título é obrigatório'),
  author: z.string().min(1, 'Autor é obrigatório'),
  publisher: z.string().min(1, 'Editora é obrigatória'),
  shelf: z.string().min(1, 'Prateleira é obrigatória'),
  category: z.string().min(1, 'Categoria é obrigatória'),
  quantity: z.coerce.number().min(0, 'Quantidade deve ser no mínimo 0'),
});

export type BookFormData = z.infer<typeof bookSchema>;

interface BookFormProps {
  book?: Book | null;
  onSubmit: (data: BookFormData) => void;
  closeDialog: () => void;
  categories: string[];
}

const BookForm = ({ book, onSubmit, closeDialog, categories }: BookFormProps) => {
  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<BookFormData>({
    resolver: zodResolver(bookSchema),
    defaultValues: book || {
      code: '',
      isbn: '',
      title: '',
      author: '',
      publisher: '',
      shelf: '',
      category: '',
      quantity: 0,
    },
  });

  const handleFormSubmit = (data: BookFormData) => {
    const transformedData = {
      ...data,
      code: data.code.toUpperCase(),
      isbn: data.isbn,
      title: data.title.toUpperCase(),
      author: data.author.toUpperCase(),
      publisher: data.publisher.toUpperCase(),
      shelf: data.shelf.toUpperCase(),
    };
    onSubmit(transformedData);
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
            <Input id="code" {...register('code')} className="col-span-3 uppercase" />
            {errors.code && <p className="col-span-4 text-red-500 text-sm text-right">{errors.code.message}</p>}
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="title" className="text-right">Título</Label>
            <Input id="title" {...register('title')} className="col-span-3 uppercase" />
            {errors.title && <p className="col-span-4 text-red-500 text-sm text-right">{errors.title.message}</p>}
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="author" className="text-right">Autor</Label>
            <Input id="author" {...register('author')} className="col-span-3 uppercase" />
            {errors.author && <p className="col-span-4 text-red-500 text-sm text-right">{errors.author.message}</p>}
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="category" className="text-right">Categoria</Label>
            <div className="col-span-3">
              <Controller
                name="category"
                control={control}
                render={({ field }) => (
                  <CategoryCombobox
                    categories={categories}
                    value={field.value}
                    onChange={field.onChange}
                  />
                )}
              />
            </div>
            {errors.category && <p className="col-span-4 text-red-500 text-sm text-right">{errors.category.message}</p>}
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="publisher" className="text-right">Editora</Label>
            <Input id="publisher" {...register('publisher')} className="col-span-3 uppercase" />
            {errors.publisher && <p className="col-span-4 text-red-500 text-sm text-right">{errors.publisher.message}</p>}
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="isbn" className="text-right">ISBN</Label>
            <Input id="isbn" {...register('isbn')} className="col-span-3" />
            {errors.isbn && <p className="col-span-4 text-red-500 text-sm text-right">{errors.isbn.message}</p>}
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="shelf" className="text-right">Prateleira</Label>
            <Input id="shelf" {...register('shelf')} className="col-span-3 uppercase" />
            {errors.shelf && <p className="col-span-4 text-red-500 text-sm text-right">{errors.shelf.message}</p>}
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="quantity" className="text-right">Quantidade</Label>
            <Input id="quantity" type="number" {...register('quantity')} className="col-span-3" />
            {errors.quantity && <p className="col-span-4 text-red-500 text-sm text-right">{errors.quantity.message}</p>}
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