import { useState, useMemo } from 'react';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { Book } from '@/lib/types';
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
import { PlusCircle, Search, Edit, Trash2, Upload } from 'lucide-react';
import BookForm, { BookFormData } from '@/components/BookForm';
import ImportBooksDialog from '@/components/ImportBooksDialog';
import { showSuccess, showError } from '@/utils/toast';

const generateId = () => Date.now().toString(36) + Math.random().toString(36).substr(2);

const BooksPage = () => {
  const [books, setBooks] = useLocalStorage<Book[]>('books', []);
  const [categories] = useLocalStorage<string[]>('book_categories', ['GERAL']);
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);

  const filteredBooks = useMemo(() => {
    const lowerCaseSearchTerm = searchTerm.toLowerCase();
    return books.filter(book =>
      book.title.toLowerCase().includes(lowerCaseSearchTerm) ||
      book.author.toLowerCase().includes(lowerCaseSearchTerm) ||
      book.code.toLowerCase().includes(lowerCaseSearchTerm) ||
      (book.isbn && book.isbn.toLowerCase().includes(lowerCaseSearchTerm)) ||
      (book.publisher && book.publisher.toLowerCase().includes(lowerCaseSearchTerm)) ||
      (book.shelf && book.shelf.toLowerCase().includes(lowerCaseSearchTerm))
    );
  }, [books, searchTerm]);

  const handleAddBook = (data: BookFormData) => {
    if (books.some(book => book.code.toUpperCase() === data.code.toUpperCase())) {
      showError('Já existe um livro cadastrado com este código.');
      return;
    }
    const newBook: Book = {
      id: generateId(),
      code: data.code,
      isbn: data.isbn,
      title: data.title,
      author: data.author,
      publisher: data.publisher,
      shelf: data.shelf,
      category: data.category,
      quantity: data.quantity,
    };
    setBooks([...books, newBook]);
    showSuccess('Livro adicionado com sucesso!');
  };

  const handleEditBook = (data: BookFormData) => {
    if (!selectedBook) return;
    if (books.some(b => b.code.toUpperCase() === data.code.toUpperCase() && b.id !== selectedBook.id)) {
      showError('Já existe outro livro cadastrado com este código.');
      return;
    }
    setBooks(
      books.map((b): Book => (b.id === selectedBook.id ? { ...b, ...data } : b))
    );
    showSuccess('Livro atualizado com sucesso!');
    setSelectedBook(null);
  };

  const handleDeleteBook = (id: string) => {
    setBooks(books.filter(b => b.id !== id));
    showSuccess('Livro excluído com sucesso!');
  };

  const handleImportBooks = (importedBooks: Omit<Book, 'id'>[]) => {
    const existingCodes = new Set(books.map(b => b.code.toUpperCase()));
    const codesProcessedInFile = new Set<string>();
    
    const booksToAdd: Book[] = [];
    let updatedCount = 0;

    for (const importedBook of importedBooks) {
      const bookCode = importedBook.code.toUpperCase();

      if (codesProcessedInFile.has(bookCode)) {
        continue; // Skip duplicates within the file
      }
      codesProcessedInFile.add(bookCode);

      if (existingCodes.has(bookCode)) {
        updatedCount++; // Count as "to be updated", but don't perform the update for this test
        continue;
      }

      booksToAdd.push({
        ...importedBook,
        id: generateId(),
        code: bookCode,
      });
    }

    setBooks(prevBooks => [...prevBooks, ...booksToAdd]);

    return { addedCount: booksToAdd.length, updatedCount: updatedCount };
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
      <h1 className="text-3xl font-bold">Gerenciamento de Livros</h1>
      
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
        <div className="relative w-full sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <Input
            placeholder="Buscar por título, autor, código ou ISBN..."
            className="pl-10"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <Dialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="w-full sm:w-auto">
                <Upload className="mr-2 h-4 w-4" />
                Importar Livros
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
            />
          </Dialog>
        </div>
      </div>

      <div className="border rounded-lg overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Código</TableHead>
              <TableHead>Título</TableHead>
              <TableHead>Autor</TableHead>
              <TableHead>Categoria</TableHead>
              <TableHead>Editora</TableHead>
              <TableHead>ISBN</TableHead>
              <TableHead>Prateleira</TableHead>
              <TableHead className="text-center">Qtd.</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredBooks.length > 0 ? (
              filteredBooks.map(book => (
                <TableRow key={book.id}>
                  <TableCell>{book.code}</TableCell>
                  <TableCell className="font-medium">{book.title}</TableCell>
                  <TableCell>{book.author}</TableCell>
                  <TableCell>{book.category}</TableCell>
                  <TableCell>{book.publisher}</TableCell>
                  <TableCell>{book.isbn}</TableCell>
                  <TableCell>{book.shelf}</TableCell>
                  <TableCell className="text-center">{book.quantity}</TableCell>
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
                            Essa ação não pode ser desfeita. Isso excluirá permanentemente o livro.
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
              ))
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