import { useState, useMemo } from 'react';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { Student } from '@/lib/types';
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
import StudentForm, { StudentFormData } from '@/components/StudentForm';
import ImportStudentsDialog from '@/components/ImportStudentsDialog';
import { showSuccess, showError } from '@/utils/toast';

const generateId = () => Date.now().toString(36) + Math.random().toString(36).substr(2);

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

const StudentsPage = () => {
  const [students, setStudents] = useLocalStorage<Student[]>('students', []);
  const [classes, setClasses] = useLocalStorage<string[]>('student_classes', defaultClasses);
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);

  const filteredStudents = useMemo(() => {
    return students.filter(student =>
      student.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      student.registration.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [students, searchTerm]);

  const handleAddStudent = (data: StudentFormData) => {
    if (students.some(student => student.registration === data.registration)) {
      showError('Já existe um aluno cadastrado com este RA.');
      return;
    }
    const newStudent: Student = {
      id: generateId(),
      registration: data.registration,
      name: data.name,
      class: data.class,
    };
    setStudents([...students, newStudent]);
    showSuccess('Aluno adicionado com sucesso!');
  };

  const handleEditStudent = (data: StudentFormData) => {
    if (!selectedStudent) return;
    if (students.some(s => s.registration === data.registration && s.id !== selectedStudent.id)) {
      showError('Já existe outro aluno cadastrado com este RA.');
      return;
    }
    setStudents(
      students.map((s): Student => (s.id === selectedStudent.id ? { ...s, ...data } : s))
    );
    showSuccess('Aluno atualizado com sucesso!');
    setSelectedStudent(null);
  };

  const handleDeleteStudent = (id: string) => {
    // TODO: Check for active loans before deleting student
    setStudents(students.filter(s => s.id !== id));
    showSuccess('Aluno excluído com sucesso!');
  };

  const handleImportStudents = (importedStudents: Student[]) => {
    // This replaces all existing students with the imported ones.
    setStudents(importedStudents);

    // Update classes list based on imported students
    const newClasses = new Set<string>();
    importedStudents.forEach(s => newClasses.add(s.class));
    setClasses(Array.from(newClasses).sort());

    showSuccess(`${importedStudents.length} alunos foram importados. Os dados anteriores foram substituídos.`);
    
    return { processedCount: importedStudents.length };
  };

  const handleAddClass = (newClass: string) => {
    if (!classes.includes(newClass)) {
      setClasses([...classes, newClass].sort());
      showSuccess(`Turma "${newClass}" adicionada!`);
    }
  };

  const handleDeleteClass = (classToDelete: string) => {
    if (students.some(s => s.class === classToDelete)) {
      showError('Não é possível excluir uma turma que está em uso por um aluno.');
      return;
    }
    setClasses(classes.filter(c => c !== classToDelete));
    showSuccess(`Turma "${classToDelete}" excluída!`);
  };

  const openEditDialog = (student: Student) => {
    setSelectedStudent(student);
    setIsAddDialogOpen(true);
  };

  const openAddDialog = () => {
    setSelectedStudent(null);
    setIsAddDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Gerenciamento de Alunos</h1>
      
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
        <div className="relative w-full sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome ou RA..."
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
                Importar
              </Button>
            </DialogTrigger>
            <ImportStudentsDialog 
              onImport={handleImportStudents}
              closeDialog={() => setIsImportDialogOpen(false)}
            />
          </Dialog>
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={openAddDialog} className="w-full sm:w-auto">
                <PlusCircle className="mr-2 h-4 w-4" />
                Adicionar Aluno
              </Button>
            </DialogTrigger>
            <StudentForm 
              key={selectedStudent?.id || 'new'}
              student={selectedStudent} 
              onSubmit={selectedStudent ? handleEditStudent : handleAddStudent} 
              closeDialog={() => setIsAddDialogOpen(false)}
              classes={classes}
              onAddClass={handleAddClass}
              onDeleteClass={handleDeleteClass}
            />
          </Dialog>
        </div>
      </div>

      <div className="border rounded-lg overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>RA</TableHead>
              <TableHead>Nome Completo</TableHead>
              <TableHead>Turma</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredStudents.length > 0 ? (
              filteredStudents.map(student => (
                <TableRow key={student.id}>
                  <TableCell>{student.registration}</TableCell>
                  <TableCell className="font-medium">{student.name}</TableCell>
                  <TableCell>{student.class}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => openEditDialog(student)}>
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
                            Essa ação não pode ser desfeita. Isso excluirá permanentemente o aluno.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleDeleteStudent(student.id)}>
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
                <TableCell colSpan={4} className="text-center h-24">
                  Nenhum aluno encontrado.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default StudentsPage;