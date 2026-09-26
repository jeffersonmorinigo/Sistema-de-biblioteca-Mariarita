import { useState, useMemo } from 'react';
import { useFirestore } from '@/hooks/useFirestore';
import { Book, Loan } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { PlusCircle, Search, Edit, Trash2, Upload, Barcode, Camera } from 'lucide-react';
import { normalizeString } from '@/utils/stringUtils';
import BookForm, { BookFormData } from '@/components/BookForm';
import ImportBooksDialog from '@/components/ImportBooksDialog';
import { showSuccess, showError, showInfo } from '@/utils/toast';
import { useSettings } from '@/hooks/useSettings';
import { useBarcodeScanner } from '@/hooks/useBarcodeScanner';
import { isLikelyIsbn, fetchBookDetailsByIsbn } from '@/lib/isbnService';
import { Badge } from '@/components/ui/badge';
import { CameraBarcodeScanner } from '@/components/CameraBarcodeScanner';

const BooksPage = () => {
  const { data: books, add: addBook, update: updateBook, remove: removeBook } = useFirestore<Book>('books');
  const { data: loans } = useFirestore<Loan>('loans');
  const { settings } = useSettings();
  const categories = settings.book_categories;
  const shelves = settings.book_shelves;
  const bookTypes = settings.book_types;
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [isCameraScannerOpen, setIsCameraScannerOpen] = useState(false);
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);

  const scannerSettings = settings.barcodeScanner || {
    enabled: true,
    targetField: 'code',
    autoOpenAddModal: true,
    autoFetchBookDetails: true,
  };

  const handleProcessScannedCode = async (scannedCode: string) => {
    const code = scannedCode.trim();
    const existingBook = books.find(
      (b) =>
        b.code.toUpperCase() === code.toUpperCase() ||
        (b.isbn && b.isbn.replace(/[^0-9X]/gi, '') === code.replace(/[^0-9X]/gi, ''))
    );

    if (existingBook) {
      setSearchTerm(existingBook.code);
      showSuccess(`Livro já cadastrado: "${existingBook.title}" (Código: ${existingBook.code})`);
      return;
    }

    if (scannerSettings.autoOpenAddModal) {
      const isIsbn = isLikelyIsbn(code);
      let details: any = null;

      if (isIsbn && scannerSettings.autoFetchBookDetails) {
        showInfo(`Buscando dados do livro na internet (${code})...`);
        details = await fetchBookDetailsByIsbn(code);
      }

      // Tenta associar categoria encontrada com as categorias do sistema
      let matchedCategory = categories[0] || 'GERAL';
      if (details?.category) {
        const catUpper = details.category.toUpperCase();
        const found = categories.find((c) => catUpper.includes(c) || c.includes(catUpper));
        if (found) matchedCategory = found;
      }

      setSelectedBook({
        id: '',
        code: scannerSettings.targetField === 'code' ? code : (isIsbn ? code : ''),
        isbn: isIsbn ? code : '',
        title: details?.title ? details.title.toUpperCase() : '',
        author: details?.author ? details.author.toUpperCase() : '',
        publisher: details?.publisher ? details.publisher.toUpperCase() : '',
        shelf: shelves[0] || 'N/A',
        category: matchedCategory,
        bookType: bookTypes[0] || 'LIVRO',
        quantity: 1,
      });

      setIsAddDialogOpen(true);

      if (details?.title) {
        showSuccess(`Livro "${details.title}" encontrado! Confirme os dados e salve.`);
      } else {
        showInfo(`Código "${code}" lido! Preencha os dados.`);
      }
    } else {
      setSearchTerm(code);
      showInfo(`Código lido: "${code}" (Nenhum livro cadastrado)`);
    }
  };

  // Escuta bips do leitor USB na tela de livros quando nenhum modal estiver aberto
  useBarcodeScanner({
    enabled: scannerSettings.enabled && !isAddDialogOpen && !isImportDialogOpen && !isCameraScannerOpen,
    onScan: (scannedCode) => {
      handleProcessScannedCode(scannedCode);
    },
  });

  const activeLoansByCode = useMemo(() => {
    const counts = new Map<string, number>();
    loans.forEach(loan => {
      if (!loan.returnDate) {
        counts.set(loan.bookCode, (counts.get(loan.bookCode) || 0) + 1);
      }
    });
    return counts;
  }, [loans]);

  const filteredBooks = useMemo(() => {
    const normalizedSearch = normalizeString(searchTerm);
    return books.filter(book =>
      normalizeString(book.title).includes(normalizedSearch) ||
      normalizeString(book.author).includes(normalizedSearch) ||
      normalizeString(book.code).includes(normalizedSearch) ||
      normalizeString(book.isbn).includes(normalizedSearch) ||
      normalizeString(book.shelf || '').includes(normalizedSearch) ||
      normalizeString(book.bookType || '').includes(normalizedSearch) ||
      normalizeString(book.category || '').includes(normalizedSearch)
    );
  }, [books, searchTerm]);

  const handleAddBook = async (data: BookFormData) => {
    if (books.some(b => b.code === data.code.toUpperCase())) {
      showError('Um livro com este código já existe.');
      return;
    }
    await addBook({
      code: data.code,
      isbn: data.isbn,
      title: data.title,
      author: data.author,
      publisher: data.publisher,
      shelf: data.shelf || 'N/A',
      category: data.category,
      bookType: data.bookType,
      quantity: data.quantity,
    });
    showSuccess('Livro adicionado com sucesso!');
  };

  const handleEditBook = async (data: BookFormData) => {
    if (!selectedBook) return;
    await updateBook(selectedBook.id, data);
    showSuccess('Livro atualizado com sucesso!');
    setSelectedBook(null);
  };

  const handleDeleteBook = async (bookId: string) => {
    const bookToDelete = books.find(b => b.id === bookId);
    if (!bookToDelete) return;
    if ((activeLoansByCode.get(bookToDelete.code) || 0) > 0) {
      showError('Não é possível excluir um livro com cópias emprestadas.');
      return;
    }
    await removeBook(bookId);
    showSuccess('Livro excluído com sucesso!');
  };

  const handleImportBooks = async (importedBooks: Book[]) => {
    // Delete all existing books first
    for (const book of books) {
      await removeBook(book.id);
    }
    // Add all imported books
    for (const book of importedBooks) {
      const { id, ...bookData } = book;
      await addBook(bookData);
    }

    const totalCopiesImported = importedBooks.reduce((sum, book) => sum + book.quantity, 0);
    const uniqueBookCount = importedBooks.length;

    showSuccess(`${totalCopiesImported} cópias de ${uniqueBookCount} livros foram importadas. Os dados anteriores foram substituídos.`);

    return { processedCount: totalCopiesImported, uniqueBookCount: uniqueBookCount };
  };

  const openEditDialog = (book: Book) => {
    setSelectedBook(book);
    setIsAddDialogOpen(true);
  };

  const openAddDialog = () => {
    setSelectedBook(null);
    setIsAddDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
        <h1 className="text-3xl font-bold">Gerenciamento de Livros</h1>
        {scannerSettings.enabled && (
          <Badge variant="outline" className="gap-1.5 text-xs text-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 dark:text-emerald-400 border-emerald-300 py-1 px-3">
            <Barcode className="h-3.5 w-3.5 text-emerald-600" />
            Leitor Ativo: bipe para buscar ou cadastrar
          </Badge>
        )}
      </div>

      <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
        <div className="relative w-full sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <Input
            placeholder="Buscar por título, autor, código, prateleira, tipo..."
            className="pl-10"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex flex-wrap gap-2 w-full sm:w-auto">
          <Button
            type="button"
            onClick={() => setIsCameraScannerOpen(true)}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium shadow-sm w-full sm:w-auto"
          >
            <Camera className="mr-2 h-4 w-4" />
            Escanear com Câmera
          </Button>

          <Dialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="w-full sm:w-auto">
                <Upload className="mr-2 h-4 w-4" />
                Importar
              </Button>
            </DialogTrigger>
            <ImportBooksDialog
              onImport={handleImportBooks}
              closeDialog={() => setIsImportDialogOpen(false)}
            />
          </Dialog>
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={openAddDialog} className="w-full sm:w-auto">
                <PlusCircle className="mr-2 h-4 w-4" />
                Adicionar Livro
              </Button>
            </DialogTrigger>
            <BookForm
              key={selectedBook?.id || 'new'}
              book={selectedBook}
              onSubmit={selectedBook ? handleEditBook : handleAddBook}
              closeDialog={() => setIsAddDialogOpen(false)}
              categories={categories}
              shelves={shelves}
              bookTypes={bookTypes}
            />
          </Dialog>
        </div>
      </div>

      {/* Scanner pela Câmera para Celulares e Tablets */}
      <CameraBarcodeScanner
        isOpen={isCameraScannerOpen}
        onClose={() => setIsCameraScannerOpen(false)}
        onScanSuccess={handleProcessScannedCode}
      />

      <div className="border rounded-lg overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Código</TableHead>
              <TableHead>Título</TableHead>
              <TableHead>Autor</TableHead>
              <TableHead>Editora</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>ISBN</TableHead>
              <TableHead>Prateleira</TableHead>
              <TableHead>Disponível</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredBooks.length > 0 ? (
              filteredBooks.map(book => {
                const activeLoans = activeLoansByCode.get(book.code) || 0;
                const available = book.quantity - activeLoans;
                return (
                  <TableRow key={book.id}>
                    <TableCell>{book.code}</TableCell>
                    <TableCell className="font-medium">{book.title}</TableCell>
                    <TableCell>{book.author}</TableCell>
                    <TableCell>{book.publisher}</TableCell>
                    <TableCell>{book.bookType}</TableCell>
                    <TableCell>{book.isbn}</TableCell>
                    <TableCell>{book.shelf || 'N/A'}</TableCell>
                    <TableCell className="font-semibold">{available}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => openEditDialog(book)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="text-red-500 hover:text-red-600">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Você tem certeza?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Isso excluirá o registro deste livro e todas as suas cópias. A ação não pode ser desfeita.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDeleteBook(book.id)}>
                              Excluir
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </TableCell>
                  </TableRow>
                );
              })
            ) : (
              <TableRow>
                <TableCell colSpan={9} className="text-center h-24">
                  Nenhum livro encontrado.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default BooksPage;