export interface Book {
  id: string;
  code: string;
  isbn: string;
  title: string;
  author: string;
  publisher: string;
  shelf: string;
  category: string;
  bookType: string;
  quantity: number;
}

export interface Student {
  id: string;
  name: string;         // Nome Completo
  class: string;        // Turma
  type: string;         // Tipo de aluno (ex: Aluno, Professor, Funcionário)
  isBlocked: boolean;   // Status de bloqueio
  blockDate?: string;   // Data do bloqueio (opcional)
}

export interface Loan {
  id: string;
  studentId: string;
  bookCode: string;
  loanDate: string;
  expectedReturnDate: string;
  returnDate?: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  password: string;
}