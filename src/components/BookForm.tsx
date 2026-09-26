import React, { useState } from 'react';
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
} from '@/components/ui/dialog';
import { Book } from '@/lib/types';
import { CategoryCombobox } from './CategoryCombobox';
import { ShelfCombobox } from './ShelfCombobox';
import { BookTypeCombobox } from './BookTypeCombobox';
import { useSettings } from '@/hooks/useSettings';
import { useBarcodeScanner } from '@/hooks/useBarcodeScanner';
import { fetchBookDetailsByIsbn, isLikelyIsbn } from '@/lib/isbnService';
import { showSuccess, showError, showInfo } from '@/utils/toast';
import { Barcode, Sparkles, Loader2, Search, Camera } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { CameraBarcodeScanner } from './CameraBarcodeScanner';

const bookSchema = z.object({
  code: z.string().min(1, 'Código é obrigatório'),
  isbn: z.string(),
  title: z.string().min(1, 'Título é obrigatório'),
  author: z.string().min(1, 'Autor é obrigatório'),
  publisher: z.string().min(1, 'Editora é obrigatória'),
  shelf: z.string().min(1, 'Prateleira é obrigatória'),
  category: z.string().min(1, 'Categoria é obrigatória'),
  bookType: z.string().min(1, 'Tipo é obrigatório'),
  quantity: z.coerce.number().min(1, 'A quantidade deve ser pelo menos 1'),
});

export type BookFormData = z.infer<typeof bookSchema>;

interface BookFormProps {
  book?: Book | null;
  onSubmit: (data: BookFormData) => void;
  closeDialog: () => void;
  categories: string[];
  shelves: string[];
  bookTypes: string[];
}

const BookForm = ({ book, onSubmit, closeDialog, categories, shelves, bookTypes }: BookFormProps) => {
  const { settings } = useSettings();
  const scannerSettings = settings.barcodeScanner || {
    enabled: true,
    targetField: 'code',
    autoOpenAddModal: true,
    autoFetchBookDetails: true,
  };

  const [isFetchingIsbn, setIsFetchingIsbn] = useState(false);
  const [isCameraOpen, setIsCameraOpen] = useState(false);

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
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
      bookType: '',
      quantity: 1,
    },
  });

  const watchedCategory = watch('category');
  const watchedShelf = watch('shelf');
  const watchedBookType = watch('bookType');
  const watchedIsbn = watch('isbn');

  // Consulta detalhes do livro online
  const handleFetchIsbnData = async (isbnValue: string) => {
    if (!isbnValue.trim()) {
      showError('Informe um ISBN para buscar.');
      return;
    }

    setIsFetchingIsbn(true);
    try {
      const details = await fetchBookDetailsByIsbn(isbnValue);
      if (details) {
        if (details.title) setValue('title', details.title.toUpperCase());
        if (details.author) setValue('author', details.author.toUpperCase());
        if (details.publisher) setValue('publisher', details.publisher.toUpperCase());

        // Se tiver categoria sugerida e estiver nas cadastradas
        if (details.category) {
          const upperCat = details.category.toUpperCase();
          const matchedCategory = categories.find((c) => upperCat.includes(c) || c.includes(upperCat));
          if (matchedCategory) {
            setValue('category', matchedCategory);
          }
        }

        showSuccess(`Dados do livro "${details.title}" preenchidos automaticamente!`);
      } else {
        showInfo('ISBN não localizado nos cadastros online. Preencha manualmente.');
      }
    } catch (err) {
      showError('Erro ao consultar ISBN na internet.');
    } finally {
      setIsFetchingIsbn(false);
    }
  };

  // Reconhecimento de leitor de código de barras durante o formulário
  useBarcodeScanner({
    enabled: scannerSettings.enabled,
    onScan: async (scannedCode) => {
      const code = scannedCode.trim();
      const isIsbn = isLikelyIsbn(code);

      if (scannerSettings.targetField === 'isbn' || (isIsbn && scannerSettings.targetField === 'both')) {
        setValue('isbn', code);
        if (!watch('code')) setValue('code', code);
        showSuccess(`ISBN "${code}" lido pelo leitor!`);

        if (scannerSettings.autoFetchBookDetails) {
          await handleFetchIsbnData(code);
        }
      } else {
        setValue('code', code);
        if (isIsbn && !watch('isbn')) {
          setValue('isbn', code);
        }
        showSuccess(`Código "${code}" capturado pelo leitor!`);

        if (isIsbn && scannerSettings.autoFetchBookDetails) {
          await handleFetchIsbnData(code);
        }
      }
    },
  });

  const handleFormSubmit = (data: BookFormData) => {
    const transformedData = {
      ...data,
      code: data.code.toUpperCase(),
      title: data.title.toUpperCase(),
      author: data.author.toUpperCase(),
      publisher: data.publisher.toUpperCase(),
      shelf: data.shelf.toUpperCase(),
      bookType: data.bookType.toUpperCase(),
    };
    onSubmit(transformedData);
    closeDialog();
  };

  return (
    <DialogContent className="sm:max-w-[480px]">
      <DialogHeader>
        <div className="flex items-center justify-between pr-4">
          <DialogTitle>{book ? 'Editar Livro' : 'Adicionar Livro'}</DialogTitle>
          {scannerSettings.enabled && (
            <Badge variant="outline" className="text-[11px] gap-1 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border-emerald-300">
              <Barcode className="h-3 w-3" />
              Leitor Pronto
            </Badge>
          )}
        </div>
      </DialogHeader>

      <form onSubmit={handleSubmit(handleFormSubmit)}>
        <div className="grid gap-3 py-3">
          {/* Código do Livro */}
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="code" className="text-right flex items-center justify-end gap-1 font-semibold">
              <Barcode className="h-3.5 w-3.5 text-muted-foreground" />
              Código
            </Label>
            <Input
              id="code"
              {...register('code')}
              placeholder="Ex: LIV-001 ou bipe com leitor"
              className="col-span-3 uppercase"
            />
            {errors.code && <p className="col-span-4 text-red-500 text-sm text-right">{errors.code.message}</p>}
          </div>

          {/* ISBN com Botão de Consulta Online e Câmera */}
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="isbn" className="text-right">ISBN</Label>
            <div className="col-span-3 flex gap-2">
              <Input
                id="isbn"
                {...register('isbn')}
                placeholder="Ex: 9788535902778 ou bipe da capa"
                className="flex-grow font-mono text-sm"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => setIsCameraOpen(true)}
                title="Escanear com a câmera do celular"
                className="shrink-0 border-emerald-300 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-700 dark:text-emerald-400"
              >
                <Camera className="h-4 w-4 text-emerald-600" />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => handleFetchIsbnData(watchedIsbn)}
                disabled={isFetchingIsbn}
                title="Consultar título e autor na internet pelo ISBN"
                className="shrink-0"
              >
                {isFetchingIsbn ? (
                  <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                ) : (
                  <Sparkles className="h-4 w-4 text-amber-500" />
                )}
              </Button>
            </div>
            {errors.isbn && <p className="col-span-4 text-red-500 text-sm text-right">{errors.isbn.message}</p>}
          </div>

          {/* Título */}
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="title" className="text-right">Título</Label>
            <Input id="title" {...register('title')} className="col-span-3 uppercase" />
            {errors.title && <p className="col-span-4 text-red-500 text-sm text-right">{errors.title.message}</p>}
          </div>

          {/* Autor */}
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="author" className="text-right">Autor</Label>
            <Input id="author" {...register('author')} className="col-span-3 uppercase" />
            {errors.author && <p className="col-span-4 text-red-500 text-sm text-right">{errors.author.message}</p>}
          </div>

          {/* Categoria */}
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="category" className="text-right">Categoria</Label>
            <div className="col-span-3">
              <Controller
                name="category"
                control={control}
                render={({ field }) => (
                  <CategoryCombobox
                    categories={categories}
                    value={watchedCategory}
                    onChange={field.onChange}
                  />
                )}
              />
            </div>
            {errors.category && <p className="col-span-4 text-red-500 text-sm text-right">{errors.category.message}</p>}
          </div>

          {/* Editora */}
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="publisher" className="text-right">Editora</Label>
            <Input id="publisher" {...register('publisher')} className="col-span-3 uppercase" />
            {errors.publisher && <p className="col-span-4 text-red-500 text-sm text-right">{errors.publisher.message}</p>}
          </div>

          {/* Tipo de Livro */}
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="bookType" className="text-right">Tipo</Label>
            <div className="col-span-3">
              <Controller
                name="bookType"
                control={control}
                render={({ field }) => (
                  <BookTypeCombobox
                    types={bookTypes}
                    value={watchedBookType}
                    onChange={field.onChange}
                  />
                )}
              />
            </div>
            {errors.bookType && <p className="col-span-4 text-red-500 text-sm text-right">{errors.bookType.message}</p>}
          </div>

          {/* Prateleira */}
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="shelf" className="text-right">Prateleira</Label>
            <div className="col-span-3">
              <Controller
                name="shelf"
                control={control}
                render={({ field }) => (
                  <ShelfCombobox
                    shelves={shelves}
                    value={watchedShelf}
                    onChange={field.onChange}
                  />
                )}
              />
            </div>
            {errors.shelf && <p className="col-span-4 text-red-500 text-sm text-right">{errors.shelf.message}</p>}
          </div>

          {/* Quantidade */}
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="quantity" className="text-right">Quantidade</Label>
            <Input id="quantity" type="number" min="1" {...register('quantity')} className="col-span-3" />
            {errors.quantity && <p className="col-span-4 text-red-500 text-sm text-right">{errors.quantity.message}</p>}
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t">
          <Button type="button" variant="outline" onClick={closeDialog}>
            Cancelar
          </Button>
          <Button type="submit">
            {book ? 'Salvar Alterações' : 'Cadastrar Livro'}
          </Button>
        </div>
      </form>

      <CameraBarcodeScanner
        isOpen={isCameraOpen}
        onClose={() => setIsCameraOpen(false)}
        onScanSuccess={async (barcode) => {
          setValue('isbn', barcode);
          if (!watch('code')) {
            setValue('code', barcode);
          }
          showSuccess(`Código "${barcode}" escaneado com sucesso!`);
          if (scannerSettings.autoFetchBookDetails) {
            await handleFetchIsbnData(barcode);
          }
        }}
      />
    </DialogContent>
  );
};

export default BookForm;