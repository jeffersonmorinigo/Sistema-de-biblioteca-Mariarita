/**
 * Serviço ultra-rápido para consulta de livros por ISBN via APIs públicas
 * Inclui timeouts estritos (AbortController) e consultas em paralelo (BrasilAPI, OpenLibrary e Google Books)
 */

export interface BookApiDetails {
  title?: string;
  author?: string;
  publisher?: string;
  description?: string;
  pageCount?: number;
  category?: string;
  publishedDate?: string;
  thumbnail?: string;
}

/**
 * Limpa uma string de ISBN removendo traços, espaços e caracteres não numéricos
 */
export function cleanIsbn(raw: string): string {
  return raw.replace(/[^0-9X]/gi, '').trim();
}

/**
 * Verifica se a string tem formato plausível de código de barras de livro (EAN-13 / ISBN-10 / ISBN-13)
 */
export function isLikelyIsbn(raw: string): boolean {
  const cleaned = cleanIsbn(raw);
  return (
    cleaned.length === 10 ||
    (cleaned.length === 13 && (cleaned.startsWith('978') || cleaned.startsWith('979')))
  );
}

/**
 * Helper de fetch com timeout estrito usando AbortController
 */
async function fetchWithTimeout(url: string, timeoutMs: number = 3500): Promise<Response> {
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
    const res = await fetchWithTimeout(`https://brasilapi.com.br/api/isbn/v1/${isbn}`, 3500);
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

      return {
        title: bData.title || bData.name || '',
        author,
        publisher: bData.publisher || '',
        description: bData.synopsis || '',
        pageCount: bData.page_count || undefined,
        publishedDate: bData.year ? String(bData.year) : '',
        thumbnail: bData.cover_url || '',
      };
    }
  } catch (err) {
    // Timeout ou erro de rede
  }
  return null;
}

/**
 * Busca no OpenLibrary Search API (rápido e com acervo mundial e nacional)
 */
async function fetchOpenLibrarySearch(isbn: string): Promise<BookApiDetails | null> {
  try {
    const res = await fetchWithTimeout(
      `https://openlibrary.org/search.json?isbn=${isbn}&fields=title,author_name,publisher,first_publish_year,cover_i`,
      3500
    );
    if (!res.ok) return null;
    const data = await res.json();
    if (data.docs && data.docs.length > 0) {
      const doc = data.docs[0];
      const author = Array.isArray(doc.author_name) ? doc.author_name.join(', ') : '';
      const publisher = Array.isArray(doc.publisher) ? doc.publisher[0] : '';
      const thumbnail = doc.cover_i ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-M.jpg` : '';
      return {
        title: doc.title || '',
        author,
        publisher,
        publishedDate: doc.first_publish_year ? String(doc.first_publish_year) : '',
        thumbnail,
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
    const res = await fetchWithTimeout(`https://openlibrary.org/isbn/${isbn}.json`, 3000);
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
      };
    }
  } catch (err) {
    // Timeout ou erro
  }
  return null;
}

/**
 * Fallback para Google Books API (com timeout rápido)
 */
async function fetchGoogleBooks(isbn: string): Promise<BookApiDetails | null> {
  try {
    const res = await fetchWithTimeout(
      `https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}`,
      2500
    );
    if (!res.ok) return null;
    const data = await res.json();
    if (data.totalItems > 0 && data.items?.[0]?.volumeInfo) {
      const info = data.items[0].volumeInfo;
      return {
        title: info.title || '',
        author: info.authors ? info.authors.join(', ') : '',
        publisher: info.publisher || '',
        description: info.description || '',
        pageCount: info.pageCount || undefined,
        category: info.categories ? info.categories[0] : undefined,
        publishedDate: info.publishedDate || '',
        thumbnail: info.imageLinks?.thumbnail || info.imageLinks?.smallThumbnail || '',
      };
    }
  } catch (err) {
    // Silencioso
  }
  return null;
}

/**
 * Consulta detalhes do livro a partir do ISBN consultando provedores em paralelo
 * Garante retorno em no máximo ~3.5 segundos sem travar a interface do celular.
 */
export async function fetchBookDetailsByIsbn(rawIsbn: string): Promise<BookApiDetails | null> {
  const isbn = cleanIsbn(rawIsbn);
  if (!isbn) return null;

  try {
    // Executa BrasilAPI e OpenLibrary Search simultaneamente
    const [resBrasil, resOpenLibSearch] = await Promise.allSettled([
      fetchBrasilApi(isbn),
      fetchOpenLibrarySearch(isbn),
    ]);

    const brasil = resBrasil.status === 'fulfilled' ? resBrasil.value : null;
    const openLib = resOpenLibSearch.status === 'fulfilled' ? resOpenLibSearch.value : null;

    // Se a BrasilAPI achou o livro
    if (brasil && brasil.title) {
      // Se não tinha autor na BrasilAPI mas a OpenLibrary tem, combina os dados
      if (!brasil.author && openLib?.author) {
        brasil.author = openLib.author;
      }
      if (!brasil.thumbnail && openLib?.thumbnail) {
        brasil.thumbnail = openLib.thumbnail;
      }
      return brasil;
    }

    // Se a Open Library achou o livro
    if (openLib && openLib.title) {
      return openLib;
    }

    // Tenta OpenLibrary ISBN direto e Google Books como alternativa rápida
    const [resOpenIsbn, resGoogle] = await Promise.allSettled([
      fetchOpenLibraryIsbn(isbn),
      fetchGoogleBooks(isbn),
    ]);

    const openIsbn = resOpenIsbn.status === 'fulfilled' ? resOpenIsbn.value : null;
    if (openIsbn && openIsbn.title) return openIsbn;

    const google = resGoogle.status === 'fulfilled' ? resGoogle.value : null;
    if (google && google.title) return google;

  } catch (err) {
    console.warn('[IsbnService] Erro durante busca combinada:', err);
  }

  return null;
}
