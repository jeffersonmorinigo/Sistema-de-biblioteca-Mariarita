import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { showSuccess, showError } from '@/utils/toast';
import { Trash2 } from 'lucide-react';
import { Book, Student } from '@/lib/types';

const settingsSchema = z.object({
  schoolName: z.string().min(1, 'O nome da escola é obrigatório.'),
});

type SettingsFormData = z.infer<typeof settingsSchema>;

// Default classes for initial setup if localStorage is empty
const defaultClasses = [
  '1º ANO A', '1º ANO B', '1º ANO C',
  '2º ANO A', '2º ANO B', '2º ANO C',
  '3º ANO A', '3º ANO B', '3º ANO C',
  '4º ANO A', '4º ANO B', '4º ANO C',
  '5º ANO A', '5º ANO B', '5º ANO C',
  '6º ANO A', '6º ANO B', '6º ANO C',
  '7º ANO A', '7º ANO B', '7º ANO C',
  '8º ANO A', '8º ANO B', '8º ANO C',
  '9º ANO A', '9º ANO B', '9º ANO C',
];

const SettingsPage = () => {
  const [schoolName, setSchoolName] = useLocalStorage('schoolName', '');
  const [categories, setCategories] = useLocalStorage<string[]>('book_categories', ['GERAL']);
  const [shelves, setShelves] = useLocalStorage<string[]>('book_shelves', ['N/A']);
  const [classes, setClasses] = useLocalStorage<string[]>('student_classes', defaultClasses); // New: Classes state
  const [books] = useLocalStorage<Book[]>('books', []);
  const [students] = useLocalStorage<Student[]>('students', []);

  const [newCategory, setNewCategory] = useState('');
  const [newShelf, setNewShelf] = useState('');
  const [newClass, setNewClass] = useState(''); // New: New class input state

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SettingsFormData>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      schoolName: schoolName || '',
    },
  });

  const onSchoolNameSubmit = (data: SettingsFormData) => {
    setSchoolName(data.schoolName);
    showSuccess('Nome da escola salvo com sucesso!');
  };

  const handleAddCategory = () => {
    const formattedCategory = newCategory.trim().toUpperCase();
    if (!formattedCategory) {
      showError('O nome da categoria não pode estar vazio.');
      return;
    }
    if (categories.includes(formattedCategory)) {
      showError('Essa categoria já existe.');
      return;
    }
    setCategories([...categories, formattedCategory].sort());
    setNewCategory('');
    showSuccess(`Categoria "${formattedCategory}" adicionada!`);
  };

  const handleDeleteCategory = (categoryToDelete: string) => {
    if (books.some(book => book.category === categoryToDelete)) {
      showError('Não é possível excluir uma categoria que está em uso por um livro.');
      return;
    }
    setCategories(categories.filter(c => c !== categoryToDelete));
    showSuccess(`Categoria "${categoryToDelete}" excluída!`);
  };

  const handleAddShelf = () => {
    const formattedShelf = newShelf.trim().toUpperCase();
    if (!formattedShelf) {
      showError('O nome da prateleira não pode estar vazio.');
      return;
    }
    if (shelves.includes(formattedShelf)) {
      showError('Essa prateleira já existe.');
      return;
    }
    setShelves([...shelves, formattedShelf].sort());
    setNewShelf('');
    showSuccess(`Prateleira "${formattedShelf}" adicionada!`);
  };

  const handleDeleteShelf = (shelfToDelete: string) => {
    if (books.some(book => book.shelf === shelfToDelete)) {
      showError('Não é possível excluir uma prateleira que está em uso por um livro.');
      return;
    }
    setShelves(shelves.filter(s => s !== shelfToDelete));
    showSuccess(`Prateleira "${shelfToDelete}" excluída!`);
  };

  // New: Class management functions
  const handleAddClass = () => {
    const formattedClass = newClass.trim().toUpperCase();
    if (!formattedClass) {
      showError('O nome da turma não pode estar vazio.');
      return;
    }
    if (classes.includes(formattedClass)) {
      showError('Essa turma já existe.');
      return;
    }
    setClasses([...classes, formattedClass].sort());
    setNewClass('');
    showSuccess(`Turma "${formattedClass}" adicionada!`);
  };

  const handleDeleteClass = (classToDelete: string) => {
    if (students.some(student => student.class === classToDelete)) {
      showError('Não é possível excluir uma turma que está em uso por um aluno.');
      return;
    }
    setClasses(classes.filter(c => c !== classToDelete));
    showSuccess(`Turma "${classToDelete}" excluída!`);
  };

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Configurações</h1>
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
              {categories.map(category => (
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
              {shelves.map(shelf => (
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

        {/* New: Card for Class Management */}
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
              {classes.map(className => (
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
      </div>
    </div>
  );
};

export default SettingsPage;