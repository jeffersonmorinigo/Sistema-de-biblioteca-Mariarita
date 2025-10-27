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
import { Book } from '@/lib/types';
import { showError } from '@/utils/toast';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';
import { FileText } from 'lucide-react';

const generateId = () => Date.now().toString(36) + Math.random().toString(36).substr(2);

interface ImportBooksDialogProps {
  onImport: (newBooks: Book[]) => { processedCount: number, uniqueBookCount: number };
  closeDialog: () => void;
}

// Helper function to validate and process a single book object from JSON
const processJsonBook = (data: any, index: number, seenCodes: Set<string>): Book | null => {
  const code = String(data.code || '').trim().toUpperCase();
  const title = String(data.title || '').trim().toUpperCase();
  const author = String(data.author || '').trim().toUpperCase();
  const category = String(data.category || '').trim().toUpperCase() || 'GERAL';
  const publisher = String(data.publisher || '').trim().toUpperCase();
  const bookType = String(data.bookType || '').trim().toUpperCase();
  const isbn = String(data.isbn || '').trim();
  const shelf = String(data.shelf || '').trim().toUpperCase() || 'N/A';
  const quantity = Number(data.quantity);

  if (!code || !title || !author || !publisher || !bookType) {
    console.warn(`Pulando entrada JSON ${index + 1}: Campos obrigatórios ausentes (código, título, autor, editora, tipo).`);
    return null;
  }

  if (seenCodes.has(code)) {
    console.warn(`Pulando código duplicado na entrada JSON ${index + 1}: ${code}`);
    return null;
  }
  seenCodes.add(code);

  return {
    id: generateId(),
    code,
    title,
    author,
    publisher,
    shelf,
    category,
    bookType,
    isbn,
    quantity: !isNaN(quantity) && quantity > 0 ? Math.floor(quantity) : 1,
  };
};


// Helper function to process a single row from CSV/XLSX
const processRow = (row: any[], index: number, seenCodes: Set<string>): Book | null => {
  // Expected columns: Código;Título;Autor;Categoria;Editora;Tipo;ISBN;Quantidade
  const [code, title, author, category, publisher, bookType, isbn, quantityRaw] = row.map(cell => String(cell || '').trim());

  if (!code) {
    console.warn(`Pulando linha ${index + 1}: Código ausente.`);
    return null;
  }
  
  const upperCode = code.toUpperCase();

  if (seenCodes.has(upperCode)) {
      console.warn(`Pulando código duplicado na linha ${index + 1}: ${upperCode}`);
      return null;
  }
  seenCodes.add(upperCode);

  // Clean quantity string: remove all non-digit characters (like commas, dots, spaces)
  const quantityStr = quantityRaw.replace(/\D/g, '');
  const quantity = parseInt(quantityStr, 10);

  return {
    id: generateId(),
    code: upperCode,
    title: title.toUpperCase(),
    author: author.toUpperCase(),
    category: category.toUpperCase() || 'GERAL',
    publisher: publisher.toUpperCase(),
    bookType: bookType.toUpperCase(),
    isbn: isbn || '',
    shelf: 'N/A',
    quantity: !isNaN(quantity) && quantity > 0 ? quantity : 1,
  };
};

// Async function to process rows/objects in chunks
const processDataInChunks = (data: any[], isJson: boolean, onProgress: (progress: number) => void): Promise<Book[]> => {
  return new Promise((resolve) => {
    const newBooks: Book[] = [];
    const seenCodes = new Set<string>();
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
        
        const book = isJson 
          ? processJsonBook(item, i, seenCodes)
          : processRow(item, i, seenCodes);
          
        if (book) {
          newBooks.push(book);
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
        resolve(newBooks);
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


const ImportBooksDialog = ({ onImport, closeDialog }: ImportBooksDialogProps) => {
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [hasResult, setHasResult] = useState(false);
  const [processedCount, setProcessedCount] = useState(0);
  const [uniqueBookCount, setUniqueBookCount] = useState(0);
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
      const fileInput = document.getElementById('book-file') as HTMLInputElement;
      if (fileInput) fileInput.value = '';
    }
    setIsProcessing(false);
    setHasResult(false);
    setProcessedCount(0);
    setUniqueBookCount(0);
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
      console.error('Erro do FileReader:', reader.error);
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
            showError('O arquivo JSON deve ser um array de objetos de livros.');
            setIsProcessing(false);
            return;
          }
          dataToProcess = parsedJson;

        } else if (fileName.endsWith('.txt') || fileName.endsWith('.csv')) {
          const content = fileResult as string;
          // Try to detect delimiter: comma, semicolon, or tab
          const delimiter = content.includes(';') ? ';' : (content.includes(',') ? ',' : '\t');
          const workbook = XLSX.read(content, { type: 'binary', raw: true, FS: delimiter });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          
          dataToProcess = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: "", raw: false });
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
        const booksToImport = await processDataInChunks(dataToProcess, isJsonImport, setProgress);
        
        if (booksToImport.length > 0) {
          const result = onImport(booksToImport);
          setProcessedCount(result.processedCount);
          setUniqueBookCount(result.uniqueBookCount);
        } else {
          showError('Nenhum livro válido encontrado após o processamento. Verifique o formato dos dados ou se os códigos estão duplicados.');
        }
        setHasResult(true);

      } catch (error) {
        showError('Ocorreu um erro crítico ao processar o arquivo. Verifique o formato das colunas/campos ou se o arquivo está corrompido.');
        console.error('Erro crítico de importação:', error);
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
        <DialogTitle>Importar Livros</DialogTitle>
        <DialogDescription>
          Selecione um arquivo para cadastrar os livros. <strong>Atenção:</strong> Esta ação substituirá todos os livros existentes no sistema.
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
                <li>Para <strong>JSON</strong>, o formato deve ser um array de objetos de livros (ex: <code className="font-mono bg-muted p-1 rounded text-xs">[{'{'} "code": "L001", "title": "...", "quantity": 1 {'}'}]</code>).</li>
                <li>Para <strong>CSV/XLSX</strong>, a ordem das colunas deve ser: <br />
                  <code className="font-mono bg-muted p-1 rounded text-xs">Código;Título;Autor;Categoria;Editora;Tipo;ISBN;Quantidade</code>
                </li>
              </ul>
            </AlertDescription>
          </Alert>
          <div className="grid w-full items-center gap-1.5">
            <Label htmlFor="book-file">Arquivo</Label>
            <Input id="book-file" type="file" accept=".txt,.csv,.xlsx,.xls,.json,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={handleFileChange} />
          </div>
        </div>
      ) : (
        <div className="py-4 space-y-4">
          <h3 className="text-lg font-semibold">Resultado da Importação</h3>
          <Alert>
            <FileText className="h-4 w-4" />
            <AlertTitle>Importação Concluída</AlertTitle>
            <AlertDescription>
              Foram processados <strong>{uniqueBookCount}</strong> tipos de livros, totalizando <strong>{processedCount}</strong> cópias.
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

export default ImportBooksDialog;