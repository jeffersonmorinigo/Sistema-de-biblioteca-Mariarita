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
    return books.filter(book =>
      book.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      book.author.toLowerCase().includes(searchTerm.toLowerCase()) ||
      book.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (book.publisher && book.publisher.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (book.shelf && book.shelf.toLowerCase().includes(searchTerm.toLowerCase()))
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
      title: data.title,
      author: data.author,
      publisher: data.publisher,
      shelf: data.shelf,
      category: data.category,
      quantity: data.quantity,
      year: data.year,
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

  const handleImportBooks = (newBooks: Book[]) => {
    const existingCodes = new Set(books.map(b => b.code.toUpperCase()));
    const uniqueNewBooks: Book[] = [];
    const duplicates: string[] = [];

    for (const book of newBooks) {
      if (existingCodes.has(book.code)) {
        duplicates.push(book.code);
      } else {
        uniqueNewBooks.push(book);
        existingCodes.add(book.code); // Add to set to check for duplicates within the file itself
      }
    }

    if (duplicates.length > 0) {
      showError(`Os seguintes códigos de livro já existem e não foram importados: ${duplicates.join(', ')}`);
    }

    if (uniqueNewBooks.length > 0) {
      setBooks(prevBooks => [...prevBooks, ...uniqueNewBooks]);
    }
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
            placeholder="Buscar por título, autor ou código..."
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
              <TableHead>Editora</TableHead>
              <TableHead>Prateleira</TableHead>
              <TableHead>Categoria</TableHead>
              <TableHead className="text-center">Qtd.</TableHead>
              <TableHead className="text-center">Ano</TableHead>
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
                  <TableCell>{book.publisher}</TableCell>
                  <TableCell>{book.shelf}</TableCell>
                  <TableCell>{book.category}</TableCell>
                  <TableCell className="text-center">{book.quantity}</TableCell>
                  <TableCell className="text-center">{book.year}</TableCell>
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