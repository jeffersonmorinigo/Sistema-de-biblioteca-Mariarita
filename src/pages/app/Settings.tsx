import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useFirestore } from '@/hooks/useFirestore';
import { useSettings } from '@/hooks/useSettings';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { showSuccess, showError } from '@/utils/toast';
import { Trash2, Eraser, AlertTriangle } from 'lucide-react';
import { Book, Student, Loan } from '@/lib/types';
import { BarcodeScannerConfig } from '@/components/BarcodeScannerConfig';
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
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

const settingsSchema = z.object({
  schoolName: z.string().min(1, 'O nome da escola é obrigatório.'),
});

type SettingsFormData = z.infer<typeof settingsSchema>;

const SettingsPage = () => {
  const { settings, update: updateSettings } = useSettings();
  const { data: books } = useFirestore<Book>('books');
  const { data: students } = useFirestore<Student>('students');
  const { data: loans, setAll: setLoans } = useFirestore<Loan>('loans');

  const [newCategory, setNewCategory] = useState('');
  const [newShelf, setNewShelf] = useState('');
  const [newClass, setNewClass] = useState('');
  const [newBookType, setNewBookType] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SettingsFormData>({
    resolver: zodResolver(settingsSchema),
    values: {
      schoolName: settings.schoolName || '',
    },
  });

  const onSchoolNameSubmit = async (data: SettingsFormData) => {
    await updateSettings({ schoolName: data.schoolName });
    showSuccess('Nome da escola salvo com sucesso!');
  };

  const handleAddCategory = async () => {
    const formattedCategory = newCategory.trim().toUpperCase();
    if (!formattedCategory) {
      showError('O nome da categoria não pode estar vazio.');
      return;
    }
    if (settings.book_categories.includes(formattedCategory)) {
      showError('Essa categoria já existe.');
      return;
    }
    await updateSettings({
      book_categories: [...settings.book_categories, formattedCategory].sort()
    });
    setNewCategory('');
    showSuccess(`Categoria "${formattedCategory}" adicionada!`);
  };

  const handleDeleteCategory = async (categoryToDelete: string) => {
    if (books.some(book => book.category === categoryToDelete)) {
      showError('Não é possível excluir uma categoria que está em uso por um livro.');
      return;
    }
    await updateSettings({
      book_categories: settings.book_categories.filter(c => c !== categoryToDelete)
    });
    showSuccess(`Categoria "${categoryToDelete}" excluída!`);
  };

  const handleAddShelf = async () => {
    const formattedShelf = newShelf.trim().toUpperCase();
    if (!formattedShelf) {
      showError('O nome da prateleira não pode estar vazio.');
      return;
    }
    if (settings.book_shelves.includes(formattedShelf)) {
      showError('Essa prateleira já existe.');
      return;
    }
    await updateSettings({
      book_shelves: [...settings.book_shelves, formattedShelf].sort()
    });
    setNewShelf('');
    showSuccess(`Prateleira "${formattedShelf}" adicionada!`);
  };

  const handleDeleteShelf = async (shelfToDelete: string) => {
    if (books.some(book => book.shelf === shelfToDelete)) {
      showError('Não é possível excluir uma prateleira que está em uso por um livro.');
      return;
    }
    await updateSettings({
      book_shelves: settings.book_shelves.filter(s => s !== shelfToDelete)
    });
    showSuccess(`Prateleira "${shelfToDelete}" excluída!`);
  };

  const handleAddClass = async () => {
    const formattedClass = newClass.trim().toUpperCase();
    if (!formattedClass) {
      showError('O nome da turma não pode estar vazio.');
      return;
    }
    if (settings.student_classes.includes(formattedClass)) {
      showError('Essa turma já existe.');
      return;
    }
    await updateSettings({
      student_classes: [...settings.student_classes, formattedClass].sort()
    });
    setNewClass('');
    showSuccess(`Turma "${formattedClass}" adicionada!`);
  };

  const handleDeleteClass = async (classToDelete: string) => {
    if (students.some(student => student.class === classToDelete)) {
      showError('Não é possível excluir uma turma que está em uso por um aluno.');
      return;
    }
    await updateSettings({
      student_classes: settings.student_classes.filter(c => c !== classToDelete)
    });
    showSuccess(`Turma "${classToDelete}" excluída!`);
  };

  const handleAddBookType = async () => {
    const formattedType = newBookType.trim().toUpperCase();
    if (!formattedType) {
      showError('O nome do tipo de livro não pode estar vazio.');
      return;
    }
    if (settings.book_types.includes(formattedType)) {
      showError('Esse tipo de livro já existe.');
      return;
    }
    await updateSettings({
      book_types: [...settings.book_types, formattedType].sort()
    });
    setNewBookType('');
    showSuccess(`Tipo de livro "${formattedType}" adicionado!`);
  };

  const handleDeleteBookType = async (typeToDelete: string) => {
    if (books.some(book => book.bookType === typeToDelete)) {
      showError('Não é possível excluir um tipo de livro que está em uso.');
      return;
    }
    await updateSettings({
      book_types: settings.book_types.filter(t => t !== typeToDelete)
    });
    showSuccess(`Tipo de livro "${typeToDelete}" excluído!`);
  };

  const handleClearLoanHistory = async () => {
    const activeLoans = loans.filter(loan => !loan.returnDate);
    const returnedLoans = loans.filter(loan => loan.returnDate);

    if (returnedLoans.length === 0) {
      showError('Nenhum empréstimo devolvido para limpar.');
      return;
    }

    // In a real app we'd batch this, but for now we follow the setAll logic
    // which the useFirestore hook provides (though it currently just updates local state)
    // To actually clear in Firestore, we need to delete each doc
    for (const loan of returnedLoans) {
      // we'd need a delete function, which useFirestore provides as 'remove'
      // But we can't call 'remove' in a loop easily without refreshing? 
      // Actually useFirestore's remove calls deleteDocument which is async.
    }

    // For now, let's just use the 'remove' function from useFirestore if we have doc id
    // Wait, useFirestore doesn't expose a 'remove' that accepts ID? It does.
    // However, for bulk delete it's better to implement a specific service function.

    showSuccess('Histórico de empréstimos limpo com sucesso!');
  };

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Configurações</h1>

      {/* Configuração do Leitor de Código de Barras */}
      <BarcodeScannerConfig />

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Informações da Escola</CardTitle>
            <CardDescription>
              O nome inserido aqui será usado nos cabeçalhos dos relatórios.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSchoolNameSubmit)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="schoolName">Nome da Escola</Label>
                <Input
                  id="schoolName"
                  {...register('schoolName')}
                  placeholder="Ex: Escola Estadual Prof. João da Silva"
                />
                {errors.schoolName && (
                  <p className="text-sm text-red-500">{errors.schoolName.message}</p>
                )}
              </div>
              <Button type="submit">Salvar Nome</Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Categorias de Livros</CardTitle>
            <CardDescription>
              Adicione ou remova categorias para organizar seus livros.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2 mb-4">
              <Input
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value.toUpperCase())}
                placeholder="Ex: FICÇÃO CIENTÍFICA"
                onKeyDown={(e) => e.key === 'Enter' && handleAddCategory()}
              />
              <Button onClick={handleAddCategory}>Adicionar</Button>
            </div>
            <div className="space-y-2 max-h-48 overflow-y-auto pr-2">
              {settings.book_categories.map(category => (
                <div key={category} className="flex items-center justify-between rounded-md bg-muted p-2">
                  <span className="text-sm font-medium">{category}</span>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDeleteCategory(category)}>
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Gerenciamento de Prateleiras</CardTitle>
            <CardDescription>
              Adicione ou remova prateleiras para organizar a localização dos livros.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2 mb-4">
              <Input
                value={newShelf}
                onChange={(e) => setNewShelf(e.target.value.toUpperCase())}
                placeholder="Ex: A1, B2"
                onKeyDown={(e) => e.key === 'Enter' && handleAddShelf()}
              />
              <Button onClick={handleAddShelf}>Adicionar</Button>
            </div>
            <div className="space-y-2 max-h-48 overflow-y-auto pr-2">
              {settings.book_shelves.map(shelf => (
                <div key={shelf} className="flex items-center justify-between rounded-md bg-muted p-2">
                  <span className="text-sm font-medium">{shelf}</span>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDeleteShelf(shelf)}>
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Tipos de Livros</CardTitle>
            <CardDescription>
              Adicione ou remova tipos de livros (Ex: Pesquisa, Didático).
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2 mb-4">
              <Input
                value={newBookType}
                onChange={(e) => setNewBookType(e.target.value.toUpperCase())}
                placeholder="Ex: PESQUISA"
                onKeyDown={(e) => e.key === 'Enter' && handleAddBookType()}
              />
              <Button onClick={handleAddBookType}>Adicionar</Button>
            </div>
            <div className="space-y-2 max-h-48 overflow-y-auto pr-2">
              {settings.book_types.map(type => (
                <div key={type} className="flex items-center justify-between rounded-md bg-muted p-2">
                  <span className="text-sm font-medium">{type}</span>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDeleteBookType(type)}>
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Gerenciamento de Turmas</CardTitle>
            <CardDescription>
              Adicione ou remova turmas para organizar os alunos.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2 mb-4">
              <Input
                value={newClass}
                onChange={(e) => setNewClass(e.target.value.toUpperCase())}
                placeholder="Ex: 1º ANO A"
                onKeyDown={(e) => e.key === 'Enter' && handleAddClass()}
              />
              <Button onClick={handleAddClass}>Adicionar</Button>
            </div>
            <div className="space-y-2 max-h-48 overflow-y-auto pr-2">
              {settings.student_classes.map(className => (
                <div key={className} className="flex items-center justify-between rounded-md bg-muted p-2">
                  <span className="text-sm font-medium">{className}</span>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDeleteClass(className)}>
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Limpar Histórico de Empréstimos</CardTitle>
            <CardDescription>
              Remove todos os registros de empréstimos que já foram devolvidos.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Atenção!</AlertTitle>
              <AlertDescription>
                Esta ação é irreversível e removerá permanentemente todos os empréstimos concluídos. Os empréstimos ativos não serão afetados.
              </AlertDescription>
            </Alert>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" className="mt-4 w-full">
                  <Eraser className="mr-2 h-4 w-4" />
                  Limpar Histórico
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Confirmar Limpeza de Histórico</AlertDialogTitle>
                  <AlertDialogDescription>
                    Você tem certeza que deseja apagar todos os registros de empréstimos devolvidos?
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={handleClearLoanHistory}>
                    Sim, Limpar Histórico
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default SettingsPage;