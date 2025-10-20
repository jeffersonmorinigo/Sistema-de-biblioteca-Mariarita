import { useState } from 'react';
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
import { showError, showSuccess } from '@/utils/toast';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';
import { FileText } from 'lucide-react';

interface ImportBooksDialogProps {
  onImport: (newBooks: Omit<Book, 'id'>[]) => void;
  closeDialog: () => void;
}

const ImportBooksDialog = ({ onImport, closeDialog }: ImportBooksDialogProps) => {
  const [file, setFile] = useState<File | null>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      setFile(event.target.files[0]);
    }
  };

  const processRows = (rows: any[][]): { newBooks: Omit<Book, 'id'>[], errors: string[] } => {
    const newBooks: Omit<Book, 'id'>[] = [];
    const errors: string[] = [];

    rows.forEach((row, index) => {
      if (!row || row.every(cell => cell === null || String(cell).trim() === '')) {
        return; // Pular linhas vazias
      }

      if (row.length < 8) {
        errors.push(`Linha ${index + 1}: Formato inválido. Esperados 8 colunas, mas foram encontradas ${row.length}.`);
        return;
      }

      const [code, title, author, category, publisher, tipo, isbn, quantityStr] = row.map(String);
      const quantity = parseInt(quantityStr, 10);

      if (isNaN(quantity)) {
        errors.push(`Linha ${index + 1}: A coluna 'Quantidade' ('${quantityStr}') deve ser um número válido.`);
        return;
      }

      newBooks.push({
        code: code.toUpperCase(),
        title: title.toUpperCase(),
        author: author.toUpperCase(),
        category: category.toUpperCase(),
        publisher: publisher.toUpperCase(),
        isbn: isbn,
        quantity,
        shelf: 'N/A', // Valor padrão
      });
    });

    return { newBooks, errors };
  };

  const handleImport = () => {
    if (!file) {
      showError('Por favor, selecione um arquivo para importar.');
      return;
    }

    const reader = new FileReader();

    reader.onload = (event) => {
      try {
        let processedData;
        const fileName = file.name.toLowerCase();

        if (fileName.endsWith('.txt') || fileName.endsWith('.csv')) {
          const content = event.target?.result as string;
          const lines = content.split(/\r?\n/).filter(line => line.trim() !== '');
          const delimiter = lines[0]?.includes(';') ? ';' : '\t';
          const rows = lines.map(line => line.split(delimiter));
          processedData = processRows(rows);
        } else if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
          const data = new Uint8Array(event.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const rows: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: "" });
          processedData = processRows(rows);
        } else {
          showError('Formato de arquivo não suportado. Use .txt, .csv, .xlsx ou .xls.');
          return;
        }

        const { newBooks, errors } = processedData;

        if (errors.length > 0) {
          const errorSummary = errors.slice(0, 5).join('\n- ');
          const moreErrorsMessage = errors.length > 5 ? `\n... e mais ${errors.length - 5} erros.` : '';
          showError(`Erros encontrados no arquivo:\n- ${errorSummary}${moreErrorsMessage}`);
          return;
        }

        if (newBooks.length === 0) {
          showError('Nenhum livro válido foi encontrado no arquivo.');
          return;
        }

        onImport(newBooks);
        closeDialog();
      } catch (error) {
        showError('Ocorreu um erro ao processar o arquivo. Verifique seu formato e conteúdo.');
        console.error(error);
      }
    };

    const fileName = file.name.toLowerCase();
    if (fileName.endsWith('.txt') || fileName.endsWith('.csv')) {
      reader.readAsText(file, 'UTF-8');
    } else if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
      reader.readAsArrayBuffer(file);
    } else {
      showError('Por favor, selecione um arquivo com formato válido (.txt, .csv, .xlsx, .xls).');
    }
  };

  return (
    <DialogContent className="sm:max-w-[525px]">
      <DialogHeader>
        <DialogTitle>Importar Livros</DialogTitle>
        <DialogDescription>
          Selecione um arquivo de texto, CSV ou Excel para adicionar múltiplos livros de uma vez.
        </DialogDescription>
      </DialogHeader>
      <div className="py-4 space-y-4">
        <Alert>
          <FileText className="h-4 w-4" />
          <AlertTitle>Instruções de Formato</AlertTitle>
          <AlertDescription>
            <ul className="list-disc list-inside text-sm space-y-1 mt-2">
              <li>O arquivo pode ser <strong>.txt, .csv, .xlsx ou .xls</strong>.</li>
              <li>Para Excel, os dados devem estar na <strong>primeira planilha</strong>.</li>
              <li>Para .txt ou .csv, os campos devem ser separados por <strong>ponto e vírgula (;)</strong> ou <strong>tabulação (TAB)</strong>.</li>
              <li>O arquivo <strong>não deve ter uma linha de cabeçalho</strong> (títulos de coluna).</li>
              <li>A ordem das colunas deve ser exatamente: <br />
                <code className="font-mono bg-muted p-1 rounded text-xs">Código;Título;Autor;Categoria;Editora;Tipo;ISBN;Quantidade</code>
              </li>
            </ul>
          </AlertDescription>
        </Alert>
        <div className="grid w-full max-w-sm items-center gap-1.5">
          <Label htmlFor="book-file">Arquivo (.txt, .csv, .xlsx)</Label>
          <Input id="book-file" type="file" accept=".txt,.csv,.xlsx,.xls" onChange={handleFileChange} />
        </div>
      </div>
      <DialogFooter>
        <DialogClose asChild>
          <Button type="button" variant="secondary">Cancelar</Button>
        </DialogClose>
        <Button type="button" onClick={handleImport} disabled={!file}>Importar</Button>
      </DialogFooter>
    </DialogContent>
  );
};

export default ImportBooksDialog;