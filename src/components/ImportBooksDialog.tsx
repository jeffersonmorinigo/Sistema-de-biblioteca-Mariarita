import { useState } from 'react';
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

const generateId = () => Date.now().toString(36) + Math.random().toString(36).substr(2);

interface ImportBooksDialogProps {
  onImport: (newBooks: Book[]) => void;
  closeDialog: () => void;
}

const ImportBooksDialog = ({ onImport, closeDialog }: ImportBooksDialogProps) => {
  const [file, setFile] = useState<File | null>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      setFile(event.target.files[0]);
    }
  };

  const handleImport = () => {
    if (!file) {
      showError('Por favor, selecione um arquivo para importar.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        const lines = content.split(/\r?\n/).filter(line => line.trim() !== '');
        
        const newBooks: Book[] = [];
        const errors: string[] = [];

        lines.forEach((line, index) => {
          const fields = line.split(';').map(field => field.trim());
          if (fields.length !== 8) {
            errors.push(`Linha ${index + 1}: Formato inválido. Esperados 8 campos, mas foram encontrados ${fields.length}.`);
            return;
          }

          const [code, title, author, publisher, shelf, category, quantityStr, yearStr] = fields;
          const quantity = parseInt(quantityStr, 10);
          const year = parseInt(yearStr, 10);

          if (isNaN(quantity) || isNaN(year)) {
            errors.push(`Linha ${index + 1}: Quantidade e Ano devem ser números válidos.`);
            return;
          }

          newBooks.push({
            id: generateId(),
            code: code.toUpperCase(),
            title: title.toUpperCase(),
            author: author.toUpperCase(),
            publisher: publisher.toUpperCase(),
            shelf: shelf.toUpperCase(),
            category: category.toUpperCase(),
            quantity,
            year,
          });
        });

        if (errors.length > 0) {
          showError(`Erros encontrados no arquivo:\n- ${errors.join('\n- ')}`);
          return;
        }

        onImport(newBooks);
        showSuccess(`${newBooks.length} livros importados com sucesso!`);
        closeDialog();

      } catch (error) {
        showError('Ocorreu um erro ao ler o arquivo. Verifique o formato.');
        console.error(error);
      }
    };
    reader.readAsText(file);
  };

  return (
    <DialogContent className="sm:max-w-[525px]">
      <DialogHeader>
        <DialogTitle>Importar Livros de Arquivo TXT</DialogTitle>
        <DialogDescription>
          Selecione um arquivo .txt para adicionar múltiplos livros de uma vez.
        </DialogDescription>
      </DialogHeader>
      <div className="py-4 space-y-4">
        <Alert>
          <FileText className="h-4 w-4" />
          <AlertTitle>Instruções de Formato</AlertTitle>
          <AlertDescription>
            <ul className="list-disc list-inside text-sm space-y-1 mt-2">
              <li>O arquivo deve ter a extensão <strong>.txt</strong>.</li>
              <li>Cada linha do arquivo representa um livro.</li>
              <li>Os campos de cada livro devem ser separados por <strong>ponto e vírgula (;)</strong>.</li>
              <li>A ordem dos campos deve ser exatamente: <br />
              <code className="font-mono bg-muted p-1 rounded">Código;Título;Autor;Editora;Prateleira;Categoria;Quantidade;Ano</code>
              </li>
              <li>Não inclua uma linha de cabeçalho no arquivo.</li>
            </ul>
          </AlertDescription>
        </Alert>
        <div className="grid w-full max-w-sm items-center gap-1.5">
          <Label htmlFor="book-file">Arquivo (.txt)</Label>
          <Input id="book-file" type="file" accept=".txt" onChange={handleFileChange} />
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