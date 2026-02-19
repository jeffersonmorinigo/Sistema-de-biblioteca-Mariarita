import { useState } from 'react';
import { useAuth } from '@/auth/AuthContext';
import { Button } from '@/components/ui/button';
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
import { PlusCircle, Trash2 } from 'lucide-react';
import UserForm, { UserFormData } from '@/components/UserForm';
import { showSuccess, showError } from '@/utils/toast';

const UsersPage = () => {
  const { users, addUser, deleteUser } = useAuth();
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const handleAddUser = async (data: UserFormData) => {
    // Check if email already exists
    if (users.some(user => user.email === data.email)) {
      showError('Este email já está em uso.');
      return;
    }
    try {
      await addUser({
        name: data.name,
        email: data.email,
        password: data.password,
      });
      showSuccess('Usuário adicionado com sucesso!');
      setIsDialogOpen(false);
    } catch (error) {
      showError('Erro ao adicionar usuário.');
      console.error(error);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (users.length <= 1) {
      showError('Não é possível excluir o último usuário.');
      return;
    }
    try {
      await deleteUser(userId);
      showSuccess('Usuário excluído com sucesso!');
    } catch (error) {
      showError('Erro ao excluir usuário.');
      console.error(error);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Gerenciamento de Usuários</h1>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <PlusCircle className="mr-2 h-4 w-4" />
              Adicionar Usuário
            </Button>
          </DialogTrigger>
          <UserForm
            onSubmit={handleAddUser}
            closeDialog={() => setIsDialogOpen(false)}
          />
        </Dialog>
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Email</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map(user => (
              <TableRow key={user.id}>
                <TableCell className="font-medium">{user.name}</TableCell>
                <TableCell>{user.email}</TableCell>
                <TableCell className="text-right">
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="icon" className="text-red-500 hover:text-red-600" disabled={users.length <= 1}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Você tem certeza?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Essa ação não pode ser desfeita. Isso excluirá permanentemente o usuário.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={() => handleDeleteUser(user.id)}>
                          Excluir
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default UsersPage;