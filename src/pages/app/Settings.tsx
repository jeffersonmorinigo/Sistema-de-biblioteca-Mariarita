import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { showSuccess } from '@/utils/toast';

const settingsSchema = z.object({
  schoolName: z.string().min(1, 'O nome da escola é obrigatório.'),
});

type SettingsFormData = z.infer<typeof settingsSchema>;

const SettingsPage = () => {
  const [schoolName, setSchoolName] = useLocalStorage('schoolName', '');

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

  const onSubmit = (data: SettingsFormData) => {
    setSchoolName(data.schoolName);
    showSuccess('Nome da escola salvo com sucesso!');
  };

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Configurações</h1>
      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Informações da Escola</CardTitle>
          <CardDescription>
            O nome inserido aqui será usado nos cabeçalhos dos relatórios.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
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
            <Button type="submit">Salvar Alterações</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default SettingsPage;