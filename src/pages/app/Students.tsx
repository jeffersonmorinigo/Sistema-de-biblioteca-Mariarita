import { useState, useMemo } from 'react';
import { useFirestore } from '@/hooks/useFirestore';
import { Student } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
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
import { PlusCircle, Search, Edit, Trash2, Upload, Lock } from 'lucide-react';
import StudentForm, { StudentFormData } from '@/components/StudentForm';
import ImportStudentsDialog from '@/components/ImportStudentsDialog';
import { showSuccess, showError } from '@/utils/toast';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { normalizeString } from '@/utils/stringUtils';
import { useSettings } from '@/hooks/useSettings';
import { GraduationCap, User } from 'lucide-react';

const StudentsPage = () => {
  const { data: students, add: addStudent, update: updateStudent, remove: removeStudent } = useFirestore<Student>('students');
  const { settings, update: updateSettings } = useSettings();
  const classes = settings.student_classes;
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);

  const filteredStudents = useMemo(() => {
    const normalizedSearch = normalizeString(searchTerm);
    return students.filter(student => {
      const name = normalizeString(student.name || '');
      const studentClass = normalizeString(student.class || '');
      const type = normalizeString(student.type || '');
      
      return name.includes(normalizedSearch) ||
             studentClass.includes(normalizedSearch) ||
             type.includes(normalizedSearch);
    });
  }, [students, searchTerm]);

  const handleAddStudent = async (data: StudentFormData) => {
    try {
      await addStudent({
        name: data.name,
        class: data.class,
        type: data.type,
        isBlocked: data.isBlocked,
        blockDate: data.isBlocked ? new Date().toISOString() : null,
      });
      showSuccess('Aluno adicionado com sucesso!');
    } catch (error) {
      console.error('Erro ao adicionar aluno:', error);
      showError('Erro ao adicionar aluno. Tente novamente.');
      throw error; // Repropaga para o formulário saber que falhou
    }
  };

  const handleEditStudent = async (data: StudentFormData) => {
    if (!selectedStudent) return;

    const wasBlocked = selectedStudent.isBlocked;
    const isNowBlocked = data.isBlocked;
    let newBlockDate = selectedStudent.blockDate;

    if (isNowBlocked && !wasBlocked) {
      newBlockDate = new Date().toISOString();
    } else if (!isNowBlocked && wasBlocked) {
      newBlockDate = null;
    }

    try {
      await updateStudent(selectedStudent.id, {
        name: data.name,
        class: data.class,
        type: data.type,
        isBlocked: isNowBlocked,
        blockDate: newBlockDate,
      });
      showSuccess('Aluno atualizado com sucesso!');
      setSelectedStudent(null);
    } catch (error) {
      console.error('Erro ao atualizar aluno:', error);
      showError('Erro ao atualizar aluno. Tente novamente.');
      throw error;
    }
  };

  const handleDeleteStudent = async (id: string) => {
    try {
      await removeStudent(id);
      showSuccess('Aluno excluído com sucesso!');
    } catch (error) {
      console.error('Erro ao excluir aluno:', error);
      showError('Erro ao excluir aluno. Tente novamente.');
    }
  };

  const handleImportStudents = async (importedStudents: Student[]) => {
    // Delete all existing students first
    for (const student of students) {
      await removeStudent(student.id);
    }
    // Add all imported students
    for (const student of importedStudents) {
      const { id, ...studentData } = student;
      await addStudent(studentData);
    }

    // Update classes list based on imported students
    const newClasses = new Set<string>();
    importedStudents.forEach(s => newClasses.add(s.class));
    await updateSettings({ student_classes: Array.from(newClasses).sort() });

    showSuccess(`${importedStudents.length} alunos foram importados. Os dados anteriores foram substituídos.`);

    return { processedCount: importedStudents.length };
  };

  const handleAddClass = async (newClass: string) => {
    if (!classes.includes(newClass)) {
      await updateSettings({ student_classes: [...classes, newClass].sort() });
      showSuccess(`Turma "${newClass}" adicionada!`);
    }
  };

  const handleDeleteClass = async (classToDelete: string) => {
    if (students.some(s => s.class === classToDelete)) {
      showError('Não é possível excluir uma turma que está em uso por um aluno.');
      return;
    }
    await updateSettings({ student_classes: classes.filter(c => c !== classToDelete) });
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
            placeholder="Buscar por nome..."
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
              <TableHead>Nome Completo</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Turma</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Data Bloqueio</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredStudents.length > 0 ? (
              filteredStudents.map(student => (
                <TableRow key={student.id}>
                  <TableCell className="font-medium">{student.name}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                       {student.type === 'PROFESSOR' ? (
                        <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                          <User className="h-3 w-3 mr-1" />
                          PROFESSOR
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="bg-slate-50 text-slate-700 border-slate-200">
                          <GraduationCap className="h-3 w-3 mr-1" />
                          ALUNO
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>{student.class}</TableCell>
                  <TableCell>
                    {student.isBlocked ? (
                      <Badge variant="destructive" className="flex items-center w-fit">
                        <Lock className="h-3 w-3 mr-1" />
                        Bloqueado
                      </Badge>
                    ) : (
                      <Badge variant="secondary">Ativo</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {student.isBlocked && student.blockDate
                      ? format(new Date(student.blockDate), 'dd/MM/yyyy', { locale: ptBR })
                      : 'N/A'}
                  </TableCell>
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
                <TableCell colSpan={6} className="text-center h-24">
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