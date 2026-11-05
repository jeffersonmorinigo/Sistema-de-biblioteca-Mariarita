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
import { fetchBookDetailsByIsbn, isLikelyIsbn, cleanIsbn, matchSystemCategory, matchSystemBookType } from '@/lib/isbnService';
import { showSuccess, showError, showInfo } from '@/utils/toast';
import { Barcode, Sparkles, Loader2, Search, Camera, AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { CameraBarcodeScanner } from './CameraBarcodeScanner';
import { useIsMobileDevice } from '@/utils/deviceUtils';

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

  const isMobile = useIsMobileDevice();
  const [isFetchingIsbn, setIsFetchingIsbn] = useState(false);
  const [isCameraOpen, setIsCameraOpen] = useState(false);

  // Apenas considera edição se o livro já possui um ID salvo no banco
  const isEditMode = Boolean(book && book.id);

  const defaultCategory = book?.category || categories[0] || 'LITERATURA';
  const defaultShelf = book?.shelf || shelves[0] || 'PRATELEIRA 1';
  const defaultType = book?.bookType || bookTypes[0] || 'LIVRO';

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    formState: { errors },
  } = useForm<BookFormData>({
    resolver: zodResolver(bookSchema),
    defaultValues: {
      code: book?.code || '',
      isbn: book?.isbn || '',
      title: book?.title || '',
      author: book?.author || '',
      publisher: book?.publisher || '',
      shelf: defaultShelf,
      category: defaultCategory,
      bookType: defaultType,
      quantity: typeof book?.quantity === 'number' && !isNaN(book?.quantity) ? book?.quantity : 1,
    },
  });

  const watchedCategory = watch('category');
  const watchedShelf = watch('shelf');
  const watchedBookType = watch('bookType');
  const watchedIsbn = watch('isbn');
  const watchedTitle = watch('title');
  const watchedAuthor = watch('author');

  // Detecta se o livro foi cadastrado anteriormente com dados fictícios/provisórios
  const isProvisional =
    Boolean(watchedTitle && watchedTitle.toUpperCase().startsWith('LIVRO CÓDIGO')) ||
    Boolean(watchedAuthor && watchedAuthor.toUpperCase() === 'A DEFINIR');

  // Consulta detalhes do livro online
  const handleFetchIsbnData = async (isbnValue: string) => {
    const clean = cleanIsbn(isbnValue);
    if (!clean) {
      showError('Informe um ISBN para buscar.');
      return;
    }

    setIsFetchingIsbn(true);
    try {
      const details = await fetchBookDetailsByIsbn(clean);
      if (details && details.title) {
        setValue('title', details.title.toUpperCase(), { shouldValidate: true });
        setValue('author', (details.author || 'AUTOR NÃO INFORMADO').toUpperCase(), { shouldValidate: true });
        setValue('publisher', (details.publisher || 'N/A').toUpperCase(), { shouldValidate: true });

        const matchedCategory = matchSystemCategory(details.category, categories) || watch('category') || categories[0] || 'LITERATURA';
        setValue('category', matchedCategory, { shouldValidate: true });

        const matchedType = matchSystemBookType(details.bookType, bookTypes) || watch('bookType') || bookTypes[0] || 'LIVRO';
        setValue('bookType', matchedType, { shouldValidate: true });

        if (!watch('shelf')) {
          setValue('shelf', shelves[0] || 'PRATELEIRA 1', { shouldValidate: true });
        }

        if (clean && (!watch('isbn') || watch('isbn') !== clean)) {
          setValue('isbn', clean, { shouldValidate: true });
        }

        showSuccess(`Dados de "${details.title}" preenchidos com sucesso!`);
      } else {
        showInfo('ISBN não localizado nos cadastros online. Preencha os dados manualmente.');
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

      // Garante que campos essenciais nunca fiquem em branco
      if (!watch('shelf')) setValue('shelf', shelves[0] || 'PRATELEIRA 1', { shouldValidate: true });
      if (!watch('category')) setValue('category', categories[0] || 'LITERATURA', { shouldValidate: true });
      if (!watch('bookType')) setValue('bookType', bookTypes[0] || 'LIVRO', { shouldValidate: true });

      if (scannerSettings.targetField === 'isbn' || (isIsbn && scannerSettings.targetField === 'both')) {
        setValue('isbn', code, { shouldValidate: true });
        if (!watch('code')) setValue('code', code, { shouldValidate: true });
        showSuccess(`ISBN "${code}" lido pelo leitor!`);

        if (scannerSettings.autoFetchBookDetails) {
          await handleFetchIsbnData(code);
        }
      } else {
        if (isIsbn) {
          setValue('isbn', code, { shouldValidate: true });
          if (!watch('code')) setValue('code', code, { shouldValidate: true });
          showSuccess(`ISBN "${code}" capturado pelo leitor!`);

          if (scannerSettings.autoFetchBookDetails) {
            await handleFetchIsbnData(code);
          }
        } else {
          setValue('code', code, { shouldValidate: true });
          showSuccess(`Código "${code}" capturado pelo leitor!`);
          showInfo(`Código interno lido. Preencha os dados manualmente ou bipe o ISBN.`);
        }
      }
    },
  });

  const onInvalid = (formErrors: any) => {
    console.warn('[BookForm] Erros de validação no formulário:', formErrors);
    const missing: string[] = [];
    if (formErrors.code) missing.push('Código');
    if (formErrors.title) missing.push('Título');
    if (formErrors.author) missing.push('Autor');
    if (formErrors.publisher) missing.push('Editora');
    if (formErrors.category) missing.push('Categoria');
    if (formErrors.bookType) missing.push('Tipo');
    if (formErrors.shelf) missing.push('Prateleira');
    if (formErrors.quantity) missing.push('Quantidade');

    showError(`Preencha os campos obrigatórios: ${missing.join(', ')}`);
  };

  const handleFormSubmit = async (data: BookFormData) => {
    const transformedData = {
      ...data,
      code: (data.code || '').trim().toUpperCase(),
      isbn: (data.isbn || '').trim(),
      title: (data.title || '').trim().toUpperCase(),
      author: (data.author || 'AUTOR NÃO INFORMADO').trim().toUpperCase(),
      publisher: (data.publisher || 'N/A').trim().toUpperCase(),
      shelf: (data.shelf || shelves[0] || 'PRATELEIRA 1').trim().toUpperCase(),
      category: (data.category || categories[0] || 'LITERATURA').trim().toUpperCase(),
      bookType: (data.bookType || bookTypes[0] || 'LIVRO').trim().toUpperCase(),
      quantity: Number(data.quantity) || 1,
    };
    try {
      await onSubmit(transformedData);
      closeDialog();
    } catch (err) {
      console.error('Erro ao salvar livro:', err);
    }
  };

  return (
    <DialogContent className="sm:max-w-[480px]">
      <DialogHeader>
        <div className="flex items-center justify-between pr-4">
          <DialogTitle>{isEditMode ? 'Editar Livro' : 'Adicionar Livro'}</DialogTitle>
          {scannerSettings.enabled && (
            <Badge variant="outline" className="text-[11px] gap-1 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border-emerald-300">
              <Barcode className="h-3 w-3" />
              Leitor Pronto
            </Badge>
          )}
        </div>
      </DialogHeader>

      <form onSubmit={handleSubmit(handleFormSubmit, onInvalid)}>
        {isProvisional && (
          <div className="p-3 my-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-200 text-xs flex items-center justify-between gap-2 shadow-sm">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
              <span>
                <strong>Dados provisórios:</strong> digite ou bipe o ISBN para buscar na internet, ou preencha manualmente.
              </span>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 text-[11px] px-2.5 shrink-0 border-amber-400/50 hover:bg-amber-500/20 font-medium"
              onClick={() => {
                setValue('title', '');
                setValue('author', '');
                setValue('publisher', '');
              }}
            >
              Limpar Campos
            </Button>
          </div>
        )}

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
              {isMobile && (
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
              )}
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
            {isEditMode ? 'Salvar Alterações' : 'Cadastrar Livro'}
          </Button>
        </div>
      </form>

      {isMobile && (
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
      )}
    </DialogContent>
  );
};

export default BookForm;