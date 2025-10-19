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
import { Book } from '@/lib/types';

const settingsSchema = z.object({
  schoolName: z.string().min(1, 'O nome da escola é obrigatório.'),
});

type SettingsFormData = z.infer<typeof settingsSchema>;

const SettingsPage = () => {
  const [schoolName, setSchoolName] = useLocalStorage('schoolName', '');
  const [categories, setCategories] = useLocalStorage<string[]>('book_categories', ['GERAL']);
  const [books] = useLocalStorage<Book[]>('books', []);
  const [newCategory, setNewCategory] = useState('');

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

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Configurações</h1>
      <div className="grid gap-6 md:grid-cols-2">
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
      </div>
    </div>
  );
};

export default SettingsPage;