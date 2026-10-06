/**
 * Sistema de Licenciamento e Proteção Anti-Cópia
 * Garante que o software só execute na máquina autorizada e dentro do prazo estipulado.
 */

const LICENSE_SALT = 'MARIARITA_SECURITY_CORE_PROTECTION_KEY_2026_@V9';
const STORAGE_LICENSE_KEY = 'biblioteca_system_license_key';
const STORAGE_CLOCK_GUARD = 'biblioteca_last_run_timestamp';
const STORAGE_WEB_MACHINE_ID = 'biblioteca_web_machine_id';

export interface LicensePayload {
  institution: string;
  machineId: string;
  expiresAt: string; // Formato YYYY-MM-DD
  issuedAt: string;  // Formato YYYY-MM-DD
  plan?: string;
}

export type LicenseStatus =
  | 'ACTIVE'           // Ativo e Autorizado
  | 'EXPIRING_SOON'    // Expira em até 7 dias
  | 'EXPIRED'          // Licença Expirada
  | 'INVALID_MACHINE'  // Máquina não autorizada (cópia não autorizada)
  | 'CLOCK_TAMPERED'   // Relógio do sistema adulterado
  | 'INVALID_KEY'      // Chave corrompida ou falsificada
  | 'NO_LICENSE';      // Sem licença instalada

export interface LicenseStatusInfo {
  status: LicenseStatus;
  statusLabel: string;
  isAuthorized: boolean;
  institution: string;
  validityFormatted: string;
  expiresAt: string;
  daysRemaining: number;
  machineId: string;
  rawKey: string;
  warningMessage?: string;
}

/**
 * Função utilitária para hash SHA-256 usando Web Crypto API com fallback
 */
async function computeSha256(message: string): Promise<string> {
  if (typeof window !== 'undefined' && window.crypto && window.crypto.subtle) {
    try {
      const msgBuffer = new TextEncoder().encode(message);
      const hashBuffer = await window.crypto.subtle.digest('SHA-256', msgBuffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    } catch (e) {
      // Fallback
    }
  }

  // Fallback simples e determinístico para ambientes restritos
  let hash = 0;
  for (let i = 0; i < message.length; i++) {
    const char = message.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return Math.abs(hash).toString(16).padStart(16, '0');
}

/**
 * Assina criptograficamente os dados com o segredo do sistema
 */
async function generateSignature(dataString: string): Promise<string> {
  const fullPayload = `${dataString}|${LICENSE_SALT}`;
  const fullHash = await computeSha256(fullPayload);
  // Retorna os primeiros 32 caracteres da hash em maiúsculas para assinatura robusta
  return fullHash.slice(0, 32).toUpperCase();
}

/**
 * Converte base64 seguro para URL
 */
function toBase64(str: string): string {
  try {
    return btoa(encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, (_, p1) => {
      return String.fromCharCode(parseInt(p1, 16));
    }));
  } catch (e) {
    return btoa(unescape(encodeURIComponent(str)));
  }
}

/**
 * Decodifica base64 seguro
 */
function fromBase64(str: string): string {
  try {
    return decodeURIComponent(Array.prototype.map.call(atob(str), (c: string) => {
      return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));
  } catch (e) {
    return atob(str);
  }
}

/**
 * Obtém o Hardware ID estável e único da máquina atual
 */
export async function getSystemMachineId(): Promise<string> {
  // 1. Tenta obter do Electron (MachineGuid real do Windows / Hardware)
  if (typeof window !== 'undefined' && window.electron && typeof window.electron.getMachineId === 'function') {
    try {
      const electronId = await window.electron.getMachineId();
      if (electronId && electronId.trim().length > 5) {
        return electronId.trim().toUpperCase();
      }
    } catch (e) {
      console.warn('[LicenseService] Falha ao ler machineId do electron:', e);
    }
  }

  // 2. Se rodando via browser web puro, recupera ou gera um ID persistente
  if (typeof window !== 'undefined' && window.localStorage) {
    const saved = localStorage.getItem(STORAGE_WEB_MACHINE_ID);
    if (saved && saved.length > 5) {
      return saved;
    }

    // Gera um ID estável para navegador baseado em dados do ambiente
    const userAgent = navigator.userAgent || 'Web';
    const screenRes = `${window.screen.width}x${window.screen.height}x${window.screen.colorDepth}`;
    const raw = `${userAgent}|${screenRes}|${Math.random()}`;
    const hash = await computeSha256(raw);
    const formatted = `WEB-${hash.slice(0, 4).toUpperCase()}-${hash.slice(4, 8).toUpperCase()}-${hash.slice(8, 12).toUpperCase()}-${hash.slice(12, 16).toUpperCase()}`;

    localStorage.setItem(STORAGE_WEB_MACHINE_ID, formatted);
    return formatted;
  }

  return 'MAQUINA-PADRAO-0001';
}

/**
 * Formata data ISO (YYYY-MM-DD) para exibição brasileira (DD/MM/AAAA)
 */
export function formatDateDisplay(dateStr: string): string {
  if (!dateStr) return 'Não Definida';
  try {
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      const [year, month, day] = parts;
      return `${day.padStart(2, '0')}/${month.padStart(2, '0')}/${year}`;
    }
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) {
      return d.toLocaleDateString('pt-BR');
    }
  } catch (e) {}
  return dateStr;
}

/**
 * Gera uma chave de licença assinada criptograficamente
 * Utilizado pelo desenvolvedor / administrador para licenciar escolas e clientes.
 */
export async function generateLicenseKey(params: {
  institution: string;
  machineId: string;
  expiresAt: string; // Formato YYYY-MM-DD
  issuedAt?: string;
  plan?: string;
}): Promise<string> {
  const cleanInstitution = params.institution.trim();
  const cleanMachineId = params.machineId.trim().toUpperCase();
  const cleanExpiresAt = params.expiresAt.trim();
  const cleanIssuedAt = (params.issuedAt || new Date().toISOString().slice(0, 10)).trim();
  const plan = params.plan || 'standard';

  const payload: LicensePayload = {
    institution: cleanInstitution,
    machineId: cleanMachineId,
    expiresAt: cleanExpiresAt,
    issuedAt: cleanIssuedAt,
    plan,
  };

  const payloadJson = JSON.stringify(payload);
  const base64Data = toBase64(payloadJson);
  const signature = await generateSignature(base64Data);

  return `LIC-${base64Data}.${signature}`;
}

/**
 * Valida minuciosamente uma chave de licença contra o Hardware ID e a Data
 */
export async function verifyLicenseKey(
  rawKey: string,
  currentMachineId: string
): Promise<{
  isValid: boolean;
  status: LicenseStatus;
  statusLabel: string;
  payload?: LicensePayload;
  daysRemaining: number;
  errorMessage?: string;
}> {
  if (!rawKey || !rawKey.trim()) {
    return {
      isValid: false,
      status: 'NO_LICENSE',
      statusLabel: 'Não Ativado',
      daysRemaining: 0,
      errorMessage: 'Nenhuma chave de licença instalada.',
    };
  }

  const cleanKey = rawKey.trim();
  const match = cleanKey.match(/^LIC-([A-Za-z0-9+/=_-]+)\.([A-Fa-f0-9]+)$/);

  if (!match) {
    return {
      isValid: false,
      status: 'INVALID_KEY',
      statusLabel: 'Chave Inválida',
      daysRemaining: 0,
      errorMessage: 'O formato da chave de licença é inválido.',
    };
  }

  const [, base64Data, signature] = match;

  // 1. Verifica a assinatura criptográfica anti-falsificação
  const expectedSig = await generateSignature(base64Data);
  if (expectedSig.toUpperCase() !== signature.toUpperCase()) {
    return {
      isValid: false,
      status: 'INVALID_KEY',
      statusLabel: 'Chave Falsificada ou Corrompida',
      daysRemaining: 0,
      errorMessage: 'A assinatura criptográfica da licença não confere.',
    };
  }

  // 2. Decodifica o payload
  let payload: LicensePayload;
  try {
    const jsonStr = fromBase64(base64Data);
    payload = JSON.parse(jsonStr);
  } catch (err) {
    return {
      isValid: false,
      status: 'INVALID_KEY',
      statusLabel: 'Chave Ilegível',
      daysRemaining: 0,
      errorMessage: 'Não foi possível ler os dados internos da licença.',
    };
  }

  // 3. Validação anti-cópia: ID da máquina
  const targetMachine = (payload.machineId || '').trim().toUpperCase();
  const currentMachine = (currentMachineId || '').trim().toUpperCase();

  if (targetMachine !== currentMachine) {
    return {
      isValid: false,
      status: 'INVALID_MACHINE',
      statusLabel: 'Cópia Não Autorizada',
      payload,
      daysRemaining: 0,
      errorMessage: `Esta licença foi gerada para outra máquina (${targetMachine}) e não pode ser copiada para este computador (${currentMachine}).`,
    };
  }

  // 4. Verificação de manipulação do relógio do sistema
  const now = new Date();
  const nowTimestamp = now.getTime();
  let lastTimestamp = 0;

  try {
    const savedLast = localStorage.getItem(STORAGE_CLOCK_GUARD);
    if (savedLast) {
      lastTimestamp = parseInt(savedLast, 10) || 0;
    }
  } catch (e) {}

  // Se o relógio do sistema estiver mais de 24 horas no passado em relação à última execução
  if (lastTimestamp > 0 && nowTimestamp < lastTimestamp - (24 * 60 * 60 * 1000)) {
    return {
      isValid: false,
      status: 'CLOCK_TAMPERED',
      statusLabel: 'Relógio Alterado',
      payload,
      daysRemaining: 0,
      errorMessage: 'O relógio deste computador foi retrocedido para tentar burlar a validade. Corrija o relógio do sistema.',
    };
  }

  // Atualiza a última execução válida
  try {
    localStorage.setItem(STORAGE_CLOCK_GUARD, nowTimestamp.toString());
  } catch (e) {}

  // 5. Validação do prazo de validade (Expiração)
  const [expYear, expMonth, expDay] = payload.expiresAt.split('-').map(Number);
  const expirationDate = new Date(expYear, expMonth - 1, expDay, 23, 59, 59, 999);
  const diffTime = expirationDate.getTime() - nowTimestamp;
  const daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (daysRemaining < 0) {
    return {
      isValid: false,
      status: 'EXPIRED',
      statusLabel: 'Licença Expirada',
      payload,
      daysRemaining,
      errorMessage: `Seu prazo de uso expirou em ${formatDateDisplay(payload.expiresAt)}.`,
    };
  }

  if (daysRemaining <= 7) {
    return {
      isValid: true,
      status: 'EXPIRING_SOON',
      statusLabel: 'Expira em Breve',
      payload,
      daysRemaining,
    };
  }

  return {
    isValid: true,
    status: 'ACTIVE',
    statusLabel: 'Ativo e Autorizado',
    payload,
    daysRemaining,
  };
}

/**
 * Lê a chave de licença salva (priorizando arquivo do Electron, com fallback em localStorage)
 */
export async function loadSavedLicenseKey(): Promise<string> {
  // Tenta do Electron primeiro
  if (typeof window !== 'undefined' && window.electron && typeof window.electron.loadSavedLicense === 'function') {
    try {
      const fileKey = await window.electron.loadSavedLicense();
      if (fileKey && fileKey.trim().length > 10) {
        return fileKey.trim();
      }
    } catch (e) {}
  }

  // Tenta do LocalStorage
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const localKey = localStorage.getItem(STORAGE_LICENSE_KEY);
      if (localKey && localKey.trim().length > 10) {
        return localKey.trim();
      }
    } catch (e) {}
  }

  return '';
}

/**
 * Salva a chave de licença no LocalStorage e no arquivo do Electron
 */
export async function saveLicenseKey(key: string): Promise<void> {
  const cleanKey = (key || '').trim();

  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      localStorage.setItem(STORAGE_LICENSE_KEY, cleanKey);
    } catch (e) {}
  }

  if (typeof window !== 'undefined' && window.electron && typeof window.electron.saveLicenseFile === 'function') {
    try {
      await window.electron.saveLicenseFile(cleanKey);
    } catch (e) {}
  }

  // Dispara evento para atualização imediata dos componentes de interface
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('system-license-updated', { detail: { key: cleanKey } }));
  }
}

/**
 * Remove a licença instalada
 */
export async function removeLicenseKey(): Promise<void> {
  await saveLicenseKey('');
}

/**
 * Retorna o status completo e pronto para consumo da interface de Licença
 */
export async function getCurrentLicenseStatus(): Promise<LicenseStatusInfo> {
  const machineId = await getSystemMachineId();
  let rawKey = await loadSavedLicenseKey();

  // Se nenhuma chave existir ainda (primeiro uso do sistema na máquina), gera licença de demonstração de 30 dias
  if (!rawKey) {
    try {
      const expDate = new Date();
      expDate.setDate(expDate.getDate() + 30);
      const initialKey = await generateLicenseKey({
        institution: 'EE Profº Silvio Santos de Oliveira',
        machineId,
        expiresAt: expDate.toISOString().slice(0, 10),
        plan: 'trial',
      });
      await saveLicenseKey(initialKey);
      rawKey = initialKey;
    } catch (e) {
      console.warn('[LicenseService] Falha ao gerar chave inicial de demonstração:', e);
    }
  }

  const verification = await verifyLicenseKey(rawKey, machineId);

  const institution = verification.payload?.institution || 'Não Licenciado';
  const expiresAt = verification.payload?.expiresAt || '';
  const validityFormatted = formatDateDisplay(expiresAt);
  const daysRemaining = verification.daysRemaining;

  return {
    status: verification.status,
    statusLabel: verification.statusLabel,
    isAuthorized: verification.isValid,
    institution,
    validityFormatted,
    expiresAt,
    daysRemaining,
    machineId,
    rawKey,
    warningMessage: verification.errorMessage,
  };
}

/**
 * Tenta ativar uma nova chave de licença
 */
export async function activateNewLicense(key: string): Promise<{
  success: boolean;
  message: string;
  info?: LicenseStatusInfo;
}> {
  const machineId = await getSystemMachineId();
  const verification = await verifyLicenseKey(key, machineId);

  if (!verification.isValid) {
    return {
      success: false,
      message: verification.errorMessage || 'Chave de licença inválida ou expirada.',
    };
  }

  await saveLicenseKey(key);
  const updatedInfo = await getCurrentLicenseStatus();

  return {
    success: true,
    message: `Licença ativada com sucesso para ${verification.payload?.institution}! Válida até ${formatDateDisplay(verification.payload?.expiresAt || '')}.`,
    info: updatedInfo,
  };
}
