/**
 * Serviço ultra-rápido para consulta de livros por ISBN via APIs públicas
 * Inclui timeouts equilibrados, conversão inteligente ISBN-10 <-> ISBN-13,
 * e consultas em paralelo (BrasilAPI/CBL, Google Books e OpenLibrary).
 */

import { extractRealIsbn, isbn10ToIsbn13, isbn13ToIsbn10 } from './barcodeReader';

export interface BookApiDetails {
  title?: string;
  author?: string;
  publisher?: string;
  description?: string;
  pageCount?: number;
  category?: string;
  bookType?: string;
  publishedDate?: string;
  thumbnail?: string;
  isbn?: string;
}

/**
 * Limpa uma string de ISBN removendo traços, espaços e tratando add-ons EAN-5/EAN-2
 */
export function cleanIsbn(raw: string): string {
  if (!raw) return '';
  return extractRealIsbn(raw);
}

/**
 * Verifica se a string tem formato plausível de código de barras de livro (EAN-13 / ISBN-10 / ISBN-13)
 */
export function isLikelyIsbn(raw: string): boolean {
  if (!raw) return false;
  const cleaned = extractRealIsbn(raw).replace(/[^0-9X]/gi, '').toUpperCase();
  return (
    cleaned.length === 10 ||
    (cleaned.length === 13 && (cleaned.startsWith('978') || cleaned.startsWith('979')))
  );
}

/**
 * Helper de fetch com timeout estrito usando AbortController
 */
async function fetchWithTimeout(url: string, timeoutMs: number = 4500): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
      },
    });
    return res;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Busca na BrasilAPI (CBL - Câmara Brasileira do Livro e Mercado Editorial)
 */
async function fetchBrasilApi(isbn: string): Promise<BookApiDetails | null> {
  try {
    const res = await fetchWithTimeout(`https://brasilapi.com.br/api/isbn/v1/${isbn}`, 4500);
    if (!res.ok) return null;
    const bData = await res.json();
    if (bData && (bData.title || bData.name)) {
      let author = '';
      if (Array.isArray(bData.authors) && bData.authors.length > 0) {
        author = bData.authors
          .map((a: any) => (typeof a === 'string' ? a : a.name || ''))
          .filter(Boolean)
          .join(', ');
      } else if (typeof bData.authors === 'string') {
        author = bData.authors;
      }

      // Extrai categoria dos assuntos (subjects) da CBL
      let category = '';
      if (Array.isArray(bData.subjects) && bData.subjects.length > 0) {
        category = bData.subjects[0];
      }

      return {
        title: bData.title || bData.name || '',
        author,
        publisher: bData.publisher || '',
        category,
        bookType: 'LIVRO',
        description: bData.synopsis || '',
        pageCount: bData.page_count || undefined,
        publishedDate: bData.year ? String(bData.year) : '',
        thumbnail: bData.cover_url || '',
        isbn,
      };
    }
  } catch (err) {
    // Timeout ou erro de rede
  }
  return null;
}

/**
 * Busca no Google Books API (com timeout resiliente)
 */
async function fetchGoogleBooks(isbn: string): Promise<BookApiDetails | null> {
  try {
    // 1. Busca exata por isbn:
    let res = await fetchWithTimeout(
      `https://www.googleapis.com/books/v1/volumes?q=isbn:${encodeURIComponent(isbn)}&maxResults=1`,
      4000
    );

    let data = res.ok ? await res.json() : null;

    // 2. Se não encontrou, tenta busca direta pelo código
    if (!data || data.totalItems === 0) {
      res = await fetchWithTimeout(
        `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(isbn)}&maxResults=1`,
        3500
      );
      if (res.ok) {
        data = await res.json();
      }
    }

    if (data && data.totalItems > 0 && data.items?.[0]?.volumeInfo) {
      const info = data.items[0].volumeInfo;
      const printType = info.printType === 'MAGAZINE' ? 'REVISTA' : 'LIVRO';
      const category = info.categories && info.categories.length > 0 ? info.categories[0] : '';
      return {
        title: info.title || '',
        author: info.authors ? info.authors.join(', ') : '',
        publisher: info.publisher || '',
        description: info.description || '',
        pageCount: info.pageCount || undefined,
        category,
        bookType: printType,
        publishedDate: info.publishedDate || '',
        thumbnail:
          info.imageLinks?.thumbnail ||
          info.imageLinks?.smallThumbnail ||
          '',
        isbn,
      };
    }
  } catch (err) {
    // Silencioso
  }
  return null;
}

/**
 * Busca no OpenLibrary Search API (rápido e com acervo mundial e nacional)
 */
async function fetchOpenLibrarySearch(isbn: string): Promise<BookApiDetails | null> {
  try {
    const res = await fetchWithTimeout(
      `https://openlibrary.org/search.json?isbn=${encodeURIComponent(isbn)}&fields=title,author_name,publisher,first_publish_year,cover_i,subject&limit=1`,
      4000
    );
    if (!res.ok) return null;
    const data = await res.json();
    if (data.docs && data.docs.length > 0) {
      const doc = data.docs[0];
      const author = Array.isArray(doc.author_name) ? doc.author_name.join(', ') : '';
      const publisher = Array.isArray(doc.publisher) ? doc.publisher[0] : '';
      const thumbnail = doc.cover_i ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-M.jpg` : '';
      const category = Array.isArray(doc.subject) && doc.subject.length > 0 ? doc.subject[0] : '';

      return {
        title: doc.title || '',
        author,
        publisher,
        category,
        bookType: 'LIVRO',
        publishedDate: doc.first_publish_year ? String(doc.first_publish_year) : '',
        thumbnail,
        isbn,
      };
    }
  } catch (err) {
    // Timeout ou erro
  }
  return null;
}

/**
 * Busca direta por endpoint de ISBN da Open Library
 */
async function fetchOpenLibraryIsbn(isbn: string): Promise<BookApiDetails | null> {
  try {
    const res = await fetchWithTimeout(`https://openlibrary.org/isbn/${encodeURIComponent(isbn)}.json`, 3500);
    if (!res.ok) return null;
    const doc = await res.json();
    if (doc && doc.title) {
      const publisher = Array.isArray(doc.publishers) ? doc.publishers[0] : '';
      const author = doc.by_statement || '';
      return {
        title: doc.title,
        author,
        publisher,
        publishedDate: doc.publish_date || '',
        pageCount: doc.number_of_pages || undefined,
        bookType: 'LIVRO',
        isbn,
      };
    }
  } catch (err) {
    // Timeout ou erro
  }
  return null;
}

/**
 * Consulta de livro executando requisições paralelas nos principais acervos
 */
async function queryProvidersForIsbn(isbnToQuery: string): Promise<BookApiDetails | null> {
  // 1. Executa BrasilAPI e Google Books simultaneamente (as fontes de maior precisão no Brasil)
  const [resBrasil, resGoogle] = await Promise.allSettled([
    fetchBrasilApi(isbnToQuery),
    fetchGoogleBooks(isbnToQuery),
  ]);

  const brasil = resBrasil.status === 'fulfilled' ? resBrasil.value : null;
  const google = resGoogle.status === 'fulfilled' ? resGoogle.value : null;

  // Se a BrasilAPI achou o livro
  if (brasil && brasil.title) {
    if (!brasil.author && google?.author) brasil.author = google.author;
    if (!brasil.thumbnail && google?.thumbnail) brasil.thumbnail = google.thumbnail;
    if (!brasil.category && google?.category) brasil.category = google.category;
    if (!brasil.publisher && google?.publisher) brasil.publisher = google.publisher;
    return brasil;
  }

  // Se o Google Books achou o livro
  if (google && google.title) {
    return google;
  }

  // 2. Fallback para OpenLibrary (Search e ISBN direto)
  const [resOpenSearch, resOpenIsbn] = await Promise.allSettled([
    fetchOpenLibrarySearch(isbnToQuery),
    fetchOpenLibraryIsbn(isbnToQuery),
  ]);

  const openSearch = resOpenSearch.status === 'fulfilled' ? resOpenSearch.value : null;
  if (openSearch && openSearch.title) return openSearch;

  const openIsbn = resOpenIsbn.status === 'fulfilled' ? resOpenIsbn.value : null;
  if (openIsbn && openIsbn.title) return openIsbn;

  return null;
}

/**
 * Consulta detalhes do livro a partir do ISBN consultando provedores com conversão automática ISBN-10 <-> ISBN-13
 */
export async function fetchBookDetailsByIsbn(rawIsbn: string): Promise<BookApiDetails | null> {
  const isbn = cleanIsbn(rawIsbn);
  if (!isbn) return null;

  try {
    // 1. Tenta com o código exatamente como veio
    let result = await queryProvidersForIsbn(isbn);
    if (result && result.title) return result;

    // 2. Se for ISBN-10 (10 dígitos), converte para ISBN-13 e tenta novamente
    if (isbn.length === 10) {
      const converted13 = isbn10ToIsbn13(isbn);
      if (converted13 && converted13 !== isbn) {
        result = await queryProvidersForIsbn(converted13);
        if (result && result.title) {
          result.isbn = converted13;
          return result;
        }
      }
    }

    // 3. Se for ISBN-13 (13 dígitos iniciando com 978), converte para ISBN-10 e tenta novamente
    if (isbn.length === 13 && isbn.startsWith('978')) {
      const converted10 = isbn13ToIsbn10(isbn);
      if (converted10) {
        result = await queryProvidersForIsbn(converted10);
        if (result && result.title) {
          result.isbn = isbn; // Mantém o ISBN-13 original no registro
          return result;
        }
      }
    }
  } catch (err) {
    console.warn('[IsbnService] Erro durante busca:', err);
  }

  return null;
}

/**
 * Mapeia inteligentemente uma categoria retornada pela API com as categorias cadastradas no sistema
 */
export function matchSystemCategory(rawSubjectOrCategory: string | undefined, categories: string[]): string {
  if (!categories || categories.length === 0) return 'GERAL';
  if (!rawSubjectOrCategory) return categories[0];

  const norm = rawSubjectOrCategory.toLowerCase();

  // 1. Correspondência direta por inclusão
  const directMatch = categories.find(
    (c) => norm.includes(c.toLowerCase()) || c.toLowerCase().includes(norm)
  );
  if (directMatch) return directMatch;

  // 2. Regras semânticas para acervos escolares
  if (/infant|crian|juvenil|juvenile|children|contos|fábula|fabula|kids/i.test(norm)) {
    const infant = categories.find((c) => c.toUpperCase().includes('INFANT'));
    if (infant) return infant;
  }
  if (/literat|ficção|ficcao|fiction|novela|romance|poesia|poema|drama|conto|crônica/i.test(norm)) {
    const lit = categories.find((c) => c.toUpperCase().includes('LITERAT'));
    if (lit) return lit;
  }
  if (/didát|didat|escolar|ensino|educaç|educac|textbook|pedagogi|gramática|matemát/i.test(norm)) {
    const did = categories.find((c) => c.toUpperCase().includes('DIDÁT') || c.toUpperCase().includes('DIDAT'));
    if (did) return did;
  }
  if (/pesquisa|históri|histori|geograf|ciência|ciencia|física|fisica|química|quimica|biolog|filosof|sociolog|research|science/i.test(norm)) {
    const pesq = categories.find((c) => c.toUpperCase().includes('PESQUISA'));
    if (pesq) return pesq;
  }

  // 3. Fallback para GERAL se existir, ou a primeira categoria
  const geral = categories.find((c) => c.toUpperCase() === 'GERAL');
  return geral || categories[0];
}

/**
 * Mapeia inteligentemente o tipo do item com os tipos cadastrados no sistema
 */
export function matchSystemBookType(rawTypeOrSubject: string | undefined, bookTypes: string[]): string {
  if (!bookTypes || bookTypes.length === 0) return 'LIVRO';
  if (!rawTypeOrSubject) {
    const defaultLivro = bookTypes.find((t) => t.toUpperCase() === 'LIVRO');
    return defaultLivro || bookTypes[0];
  }

  const norm = rawTypeOrSubject.toLowerCase();

  if (/gibi|hq|quadrinhos|comic|manga|mangá/i.test(norm)) {
    const gibi = bookTypes.find((t) => t.toUpperCase() === 'GIBI');
    if (gibi) return gibi;
  }
  if (/revista|periodical|magazine|periódico|periodico/i.test(norm)) {
    const rev = bookTypes.find((t) => t.toUpperCase() === 'REVISTA');
    if (rev) return rev;
  }
  if (/dicionário|dicionario|dictionary/i.test(norm)) {
    const dic = bookTypes.find((t) => t.toUpperCase().includes('DICION'));
    if (dic) return dic;
  }
  if (/enciclop|encyclopedia/i.test(norm)) {
    const enc = bookTypes.find((t) => t.toUpperCase().includes('ENCICLOP'));
    if (enc) return enc;
  }
  if (/didát|didat/i.test(norm)) {
    const did = bookTypes.find((t) => t.toUpperCase().includes('DIDAT'));
    if (did) return did;
  }

  const livro = bookTypes.find((t) => t.toUpperCase() === 'LIVRO');
  return livro || bookTypes[0];
}
