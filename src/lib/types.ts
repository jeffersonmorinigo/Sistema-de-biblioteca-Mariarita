export interface Book {
  id: string;
  code: string;
  title: string;
  author: string;
  category: string;
  quantity: number;
  year: number;
}

export interface Student {
  id: string;
  registration: string;
  name: string;
  class: string;
  phone: string;
  email: string;
}

export interface Loan {
  id: string;
  studentId: string;
  bookId: string;
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