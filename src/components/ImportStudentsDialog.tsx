import { useState, useCallback } from 'react';
import * as XLSX from 'xlsx';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
  DialogDescription,
} from '@/components/ui/dialog';
import { Student } from '@/lib/types';
import { showError } from '@/utils/toast';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';
import { FileText } from 'lucide-react';

const generateId = () => Date.now().toString(36) + Math.random().toString(36).substr(2);

interface ImportStudentsDialogProps {
  onImport: (newStudents: Student[]) => { processedCount: number };
  closeDialog: () => void;
}

// Helper function to validate and process a single student object from JSON
const processJsonStudent = (data: any, index: number, seenRegistrations: Set<string>): Student | null => {
  const registration = String(data.registration || data.RA || '').trim();
  const name = String(data.name || '').trim().toUpperCase();
  const studentClass = String(data.class || data.Turma || '').trim().toUpperCase();
  const type = String(data.type || data.Tipo || 'ALUNO').trim().toUpperCase();
  
  // Handle boolean/string conversion for isBlocked
  const isBlockedRaw = data.isBlocked || data.Bloqueado;
  const isBlocked = isBlockedRaw === true || String(isBlockedRaw).toUpperCase() === 'TRUE' || String(isBlockedRaw).toUpperCase() === 'SIM' || String(isBlockedRaw) === '1';
  
  // Handle blockDate
  let blockDate: string | undefined = undefined;
  if (isBlocked) {
    const dateRaw = data.blockDate || data.Data_bloqueio;
    if (dateRaw && dateRaw !== 'N/A') {
      // Attempt to parse date string, otherwise use current date
      try {
        blockDate = new Date(dateRaw).toISOString();
      } catch {
        blockDate = new Date().toISOString();
      }
    } else {
      blockDate = new Date().toISOString();
    }
  }


  if (!registration || !name || !studentClass) {
    console.warn(`Skipping JSON entry ${index + 1}: Missing required fields (registration, name, class).`);
    return null;
  }

  if (seenRegistrations.has(registration)) {
    console.warn(`Skipping duplicate registration in JSON entry ${index + 1}: ${registration}`);
    return null;
  }
  seenRegistrations.add(registration);

  return {
    id: generateId(),
    registration,
    name,
    class: studentClass,
    type,
    isBlocked,
    blockDate,
  };
};


// Helper function to process a single row from CSV/XLSX
const processRow = (row: any[], index: number, seenRegistrations: Set<string>): Student | null => {
  // Expected columns: RA;Nome Completo;Tipo;Turma;Bloqueado;Data_bloqueio
  // Note: The user provided '0' for RA, so we use index 0.
  const [registration, name, type, studentClass, blockedRaw, blockDateRaw] = row.map(cell => String(cell || '').trim());

  if (!registration || !name || !studentClass) {
    console.warn(`Skipping row ${index + 1}: Missing required fields (RA, Nome, Turma).`);
    return null;
  }
  
  if (seenRegistrations.has(registration)) {
      console.warn(`Skipping duplicate registration in row ${index + 1}: ${registration}`);
      return null;
  }
  seenRegistrations.add(registration);

  const upperName = name.toUpperCase();
  const upperClass = studentClass.toUpperCase();
  const upperType = (type || 'ALUNO').toUpperCase();
  
  // Determine block status
  const isBlocked = blockedRaw.toUpperCase() === 'TRUE' || blockedRaw.toUpperCase() === 'SIM' || blockedRaw === '1';
  
  let blockDate: string | undefined = undefined;
  if (isBlocked) {
    if (blockDateRaw) {
      // Attempt to parse date string, otherwise use current date
      try {
        blockDate = new Date(blockDateRaw).toISOString();
      } catch {
        blockDate = new Date().toISOString();
      }
    } else {
      blockDate = new Date().toISOString();
    }
  }

  return {
    id: generateId(),
    registration,
    name: upperName,
    class: upperClass,
    type: upperType,
    isBlocked,
    blockDate,
  };
};

// Async function to process rows/objects in chunks
const processDataInChunks = (data: any[], isJson: boolean, onProgress: (progress: number) => void): Promise<Student[]> => {
  return new Promise((resolve) => {
    const newStudents: Student[] = [];
    const seenRegistrations = new Set<string>();
    const totalItems = data.length;
    // Start processing from index 1 if not JSON (to skip header)
    let currentRow = isJson ? 0 : 1; 
    const chunkSize = 500; 

    const processChunk = () => {
      const start = currentRow;
      const end = Math.min(currentRow + chunkSize, totalItems);

      for (let i = start; i < end; i++) {
        const item = data[i];
        
        if (!item || (Array.isArray(item) && item.every(cell => cell === null || String(cell).trim() === ''))) {
          continue; 
        }
        
        const student = isJson 
          ? processJsonStudent(item, i, seenRegistrations)
          : processRow(item, i, seenRegistrations);
          
        if (student) {
          newStudents.push(student);
        }
      }

      currentRow = end;
      
      // Calculate progress based on total items
      const itemsToProcess = isJson ? totalItems : (totalItems > 1 ? totalItems - 1 : 1);
      const processedItems = isJson ? currentRow : (currentRow - 1);
      const progressValue = Math.floor((processedItems / itemsToProcess) * 100);
      onProgress(Math.min(progressValue, 99)); // Cap at 99% until finished

      if (currentRow < totalItems) {
        // Continue processing in the next tick
        setTimeout(processChunk, 10);
      } else {
        // Finished processing
        onProgress(100);
        resolve(newStudents);
      }
    };

    // Start processing only if there are items to process
    if (totalItems > (isJson ? 0 : 1)) {
      processChunk();
    } else {
      resolve([]);
    }
  });
};


const ImportStudentsDialog = ({ onImport, closeDialog }: ImportStudentsDialogProps) => {
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [hasResult, setHasResult] = useState(false);
  const [processedCount, setProcessedCount] = useState(0);
  const [progress, setProgress] = useState(0);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      setFile(event.target.files[0]);
    } else {
      setFile(null);
    }
    resetState(true);
  };

  const resetState = (keepFile = false) => {
    if (!keepFile) {
      setFile(null);
      const fileInput = document.getElementById('student-file') as HTMLInputElement;
      if (fileInput) fileInput.value = '';
    }
    setIsProcessing(false);
    setHasResult(false);
    setProcessedCount(0);
    setProgress(0);
  };

  const handleImport = useCallback(() => {
    if (!file) {
      showError('Por favor, selecione um arquivo para importar.');
      return;
    }
    setIsProcessing(true);
    setProgress(0);

    const reader = new FileReader();

    reader.onerror = () => {
      showError('Ocorreu um erro ao ler o arquivo.');
      console.error('FileReader error:', reader.error);
      setIsProcessing(false);
    };

    reader.onload = async (event) => {
      try {
        let dataToProcess: any[] = [];
        let isJsonImport = false;
        const fileName = file.name.toLowerCase();
        const fileResult = event.target?.result;

        if (!fileResult) {
          showError('O arquivo está vazio ou não pôde ser lido.');
          setIsProcessing(false);
          return;
        }

        if (fileName.endsWith('.json')) {
          isJsonImport = true;
          const content = fileResult as string;
          const parsedJson = JSON.parse(content);
          
          if (!Array.isArray(parsedJson)) {
            showError('O arquivo JSON deve ser um array de objetos de alunos.');
            setIsProcessing(false);
            return;
          }
          dataToProcess = parsedJson;

        } else if (fileName.endsWith('.txt') || fileName.endsWith('.csv')) {
          const content = fileResult as string;
          // Try to detect delimiter: comma, semicolon, or tab
          const delimiter = content.includes(';') ? ';' : (content.includes(',') ? ',' : '\t');
          dataToProcess = content.split(/\r?\n/).map(line => line.split(delimiter));
        } else if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
          const data = new Uint8Array(fileResult as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          
          dataToProcess = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: "", raw: false });
        } else {
          showError('Formato de arquivo não suportado. Use .txt, .csv, .xlsx, .xls ou .json.');
          setIsProcessing(false);
          return;
        }
        
        if (dataToProcess.length === 0 || (!isJsonImport && dataToProcess.length <= 1)) {
          showError('Nenhum dado válido encontrado no arquivo.');
          setIsProcessing(false);
          return;
        }

        // Process data asynchronously in chunks
        const studentsToImport = await processDataInChunks(dataToProcess, isJsonImport, setProgress);
        
        if (studentsToImport.length > 0) {
          const result = onImport(studentsToImport);
          setProcessedCount(result.processedCount);
        } else {
          showError('Nenhum aluno válido encontrado após o processamento. Verifique o formato dos dados ou se os RAs estão duplicados.');
        }
        setHasResult(true);

      } catch (error) {
        showError('Ocorreu um erro crítico ao processar o arquivo. Verifique o formato das colunas/campos ou se o arquivo está corrompido.');
        console.error('Critical import error:', error);
      } finally {
        setIsProcessing(false);
        setProgress(100);
      }
    };

    const fileName = file.name.toLowerCase();
    if (fileName.endsWith('.json') || fileName.endsWith('.txt') || fileName.endsWith('.csv')) {
      reader.readAsText(file, 'UTF-8');
    } else {
      reader.readAsArrayBuffer(file);
    }
  }, [file, onImport]);

  return (
    <DialogContent className="sm:max-w-[625px]">
      <DialogHeader>
        <DialogTitle>Importar Alunos</DialogTitle>
        <DialogDescription>
          Selecione um arquivo para cadastrar os alunos. <strong>Atenção:</strong> Esta ação substituirá todos os alunos existentes no sistema.
        </DialogDescription>
      </DialogHeader>
      
      {!hasResult ? (
        <div className="py-4 space-y-4">
          <Alert>
            <FileText className="h-4 w-4" />
            <AlertTitle>Instruções de Formato</AlertTitle>
            <AlertDescription>
              <ul className="list-disc list-inside text-sm space-y-1 mt-2">
                <li>O arquivo pode ser <strong>.txt, .csv, .xlsx, .xls ou .json</strong>.</li>
                <li>Para <strong>JSON</strong>, o formato deve ser um array de objetos de alunos (ex: <code className="font-mono bg-muted p-1 rounded text-xs">[{'{'} "registration": "12345", "name": "...", "type": "ALUNO", "isBlocked": false {'}'}]</code>).</li>
                <li>Para <strong>CSV/XLSX</strong>, a ordem das colunas deve ser: <br />
                  <code className="font-mono bg-muted p-1 rounded text-xs">RA;Nome Completo;Tipo;Turma;Bloqueado (SIM/NÃO);Data_bloqueio (Opcional)</code>
                </li>
              </ul>
            </AlertDescription>
          </Alert>
          <div className="grid w-full items-center gap-1.5">
            <Label htmlFor="student-file">Arquivo</Label>
            <Input id="student-file" type="file" accept=".txt,.csv,.xlsx,.xls,.json,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={handleFileChange} />
          </div>
        </div>
      ) : (
        <div className="py-4 space-y-4">
          <h3 className="text-lg font-semibold">Resultado da Importação</h3>
          <Alert>
            <FileText className="h-4 w-4" />
            <AlertTitle>Importação Concluída</AlertTitle>
            <AlertDescription>
              Foram processados <strong>{processedCount}</strong> alunos com sucesso.
            </AlertDescription>
          </Alert>
        </div>
      )}

      <DialogFooter>
        {hasResult ? (
          <>
            <Button type="button" variant="secondary" onClick={() => resetState()}>Importar Outro</Button>
            <DialogClose asChild>
              <Button type="button">Fechar</Button>
            </DialogClose>
          </>
        ) : (
          <>
            <DialogClose asChild>
              <Button type="button" variant="secondary">Cancelar</Button>
            </DialogClose>
            <Button type="button" onClick={handleImport} disabled={!file || isProcessing}>
              {isProcessing ? `Processando... (${progress}%)` : 'Importar'}
            </Button>
          </>
        )}
      </DialogFooter>
    </DialogContent>
  );
};

export default ImportStudentsDialog;