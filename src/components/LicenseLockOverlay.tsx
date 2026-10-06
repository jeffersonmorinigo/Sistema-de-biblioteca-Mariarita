import React, { useState } from 'react';
import { useLicense } from '@/hooks/useLicense';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  ShieldAlert,
  ShieldX,
  Key,
  Copy,
  Check,
  RefreshCw,
  Lock,
  Building2,
  Calendar,
  Cpu,
  Sparkles,
} from 'lucide-react';
import { showSuccess, showError } from '@/utils/toast';

export const LicenseLockOverlay: React.FC = () => {
  const { licenseInfo, loading, activate, generateKey } = useLicense();
  const [licenseInput, setLicenseInput] = useState('');
  const [activating, setActivating] = useState(false);
  const [copiedId, setCopiedId] = useState(false);

  // Modo suporte/admin na tela de bloqueio
  const [showAdminTool, setShowAdminTool] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');
  const [adminUnlocked, setAdminUnlocked] = useState(false);
  const [genInstitution, setGenInstitution] = useState('');
  const [genDays, setGenDays] = useState('365');
  const [generatedKey, setGeneratedKey] = useState('');

  // Se estiver carregando ou a licença for válida, não exibe bloqueio
  if (loading || (licenseInfo && licenseInfo.isAuthorized)) {
    return null;
  }

  const handleCopyMachineId = () => {
    if (!licenseInfo?.machineId) return;
    navigator.clipboard.writeText(licenseInfo.machineId);
    setCopiedId(true);
    showSuccess('ID da máquina copiado!');
    setTimeout(() => setCopiedId(false), 2000);
  };

  const handleActivate = async () => {
    if (!licenseInput.trim()) {
      showError('Cole o código de ativação fornecido.');
      return;
    }
    setActivating(true);
    try {
      const res = await activate(licenseInput.trim());
      if (res.success) {
        showSuccess(res.message);
        setLicenseInput('');
      } else {
        showError(res.message);
      }
    } catch (e: any) {
      showError('Erro ao ativar: ' + e?.message);
    } finally {
      setActivating(false);
    }
  };

  const handleUnlockAdmin = (e: React.FormEvent) => {
    e.preventDefault();
    if (adminPassword.trim() === 'AdminDev@2026') {
      setAdminUnlocked(true);
      setGenInstitution(licenseInfo?.institution !== 'Não Licenciado' ? licenseInfo?.institution || '' : 'EE Profº Silvio Santos de Oliveira');
      showSuccess('Modo de suporte liberado!');
    } else {
      showError('Senha de suporte incorreta.');
    }
  };

  const handleGenerateAndApply = async () => {
    if (!genInstitution.trim()) {
      showError('Informe a instituição.');
      return;
    }
    const days = parseInt(genDays, 10);
    const target = new Date();
    target.setDate(target.getDate() + days);

    try {
      const key = await generateKey({
        institution: genInstitution.trim(),
        machineId: licenseInfo?.machineId || '',
        expiresAt: target.toISOString().slice(0, 10),
      });

      setGeneratedKey(key);
      const res = await activate(key);
      if (res.success) {
        showSuccess('Licença emitida e sistema desbloqueado com sucesso!');
      } else {
        showError(res.message);
      }
    } catch (e: any) {
      showError('Erro ao emitir: ' + e?.message);
    }
  };

  const isExpired = licenseInfo?.status === 'EXPIRED';
  const isInvalidMachine = licenseInfo?.status === 'INVALID_MACHINE';
  const isClockTampered = licenseInfo?.status === 'CLOCK_TAMPERED';

  return (
    <div className="fixed inset-0 z-[9999] bg-background/95 backdrop-blur-md flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-card border border-border shadow-2xl rounded-2xl overflow-hidden p-6 sm:p-8 space-y-6 animate-in fade-in zoom-in-95 duration-200">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center p-3 rounded-full bg-rose-500/10 text-rose-600 mb-2">
            {isExpired ? (
              <ShieldAlert className="h-10 w-10" />
            ) : (
              <ShieldX className="h-10 w-10" />
            )}
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">
            {isExpired
              ? 'Licença de Uso Expirada'
              : isInvalidMachine
              ? 'Cópia Não Autorizada'
              : isClockTampered
              ? 'Data do Computador Incorreta'
              : 'Sistema Não Licenciado'}
          </h2>
          <p className="text-sm text-muted-foreground">
            {isExpired
              ? `O período de validade deste sistema encerrou em ${licenseInfo?.validityFormatted}. Renove a licença para continuar utilizando.`
              : isInvalidMachine
              ? 'Este sistema foi copiado para um computador diferente do autorizado originalmente. Adquira uma licença para esta máquina.'
              : isClockTampered
              ? 'O relógio deste computador foi retrocedido. Ajuste a data e hora corretas para revalidar a licença.'
              : 'Para utilizar o Sistema de Biblioteca Maria Rita neste computador, insira uma chave de licença válida.'}
          </p>
        </div>

        {/* Box com ID de Hardware */}
        <div className="rounded-xl border bg-muted/40 p-4 space-y-2">
          <div className="flex justify-between items-center text-xs font-semibold uppercase text-muted-foreground">
            <span>ID Desta Máquina (Hardware)</span>
            <span className="text-[10px] text-primary font-normal">Envie para o suporte</span>
          </div>
          <div className="flex items-center justify-between gap-2 bg-background border px-3 py-2 rounded-lg font-mono text-sm font-semibold tracking-wider">
            <span className="truncate">{licenseInfo?.machineId}</span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 text-xs shrink-0"
              onClick={handleCopyMachineId}
            >
              {copiedId ? (
                <>
                  <Check className="h-3.5 w-3.5 mr-1 text-emerald-600" />
                  Copiado
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5 mr-1" />
                  Copiar ID
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Campo de Ativação */}
        <div className="space-y-3">
          <Label htmlFor="lock-key-input" className="text-sm font-medium">
            Código de Ativação (Chave de Licença)
          </Label>
          <Textarea
            id="lock-key-input"
            placeholder="Cole aqui a chave de ativação fornecida pelo suporte..."
            value={licenseInput}
            onChange={(e) => setLicenseInput(e.target.value)}
            rows={3}
            className="font-mono text-xs resize-none"
          />
          <Button
            type="button"
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-medium h-11 text-sm shadow-md"
            disabled={activating || !licenseInput.trim()}
            onClick={handleActivate}
          >
            {activating ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Validando Chave...
              </>
            ) : (
              <>
                <Key className="h-4 w-4 mr-2" />
                Ativar e Desbloquear Sistema
              </>
            )}
          </Button>
        </div>

        {/* Ferramenta para Suporte / Administrador na tela de bloqueio */}
        <div className="pt-2 border-t">
          {!showAdminTool ? (
            <div className="text-center">
              <button
                type="button"
                onClick={() => setShowAdminTool(true)}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-1"
              >
                <Lock className="h-3 w-3" />
                Área do Administrador / Suporte Técnico
              </button>
            </div>
          ) : !adminUnlocked ? (
            <form onSubmit={handleUnlockAdmin} className="space-y-2.5 pt-1">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-muted-foreground">Suporte Técnico</span>
                <button
                  type="button"
                  onClick={() => setShowAdminTool(false)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  Fechar
                </button>
              </div>
              <div className="flex gap-2">
                <Input
                  type="password"
                  placeholder="Senha mestre de desenvolvedor"
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  className="text-xs h-9"
                />
                <Button type="submit" size="sm" className="h-9 text-xs">
                  Entrar
                </Button>
              </div>
            </form>
          ) : (
            <div className="space-y-3 pt-1">
              <div className="flex items-center justify-between text-xs font-semibold text-emerald-600">
                <span className="flex items-center gap-1">
                  <Sparkles className="h-3.5 w-3.5" />
                  Gerador Imediato de Suporte
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setAdminUnlocked(false);
                    setShowAdminTool(false);
                  }}
                  className="text-muted-foreground hover:text-foreground font-normal"
                >
                  Sair
                </button>
              </div>

              <div className="space-y-1">
                <Label className="text-[11px]">Nome da Instituição</Label>
                <Input
                  value={genInstitution}
                  onChange={(e) => setGenInstitution(e.target.value)}
                  className="text-xs h-8"
                  placeholder="Ex: EE Profº Silvio Santos de Oliveira"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-[11px]">Período de Validade</Label>
                <div className="grid grid-cols-4 gap-1">
                  {[
                    { label: '30d', val: '30' },
                    { label: '90d', val: '90' },
                    { label: '1 Ano', val: '365' },
                    { label: '2 Anos', val: '730' },
                  ].map((p) => (
                    <Button
                      key={p.val}
                      type="button"
                      variant={genDays === p.val ? 'default' : 'outline'}
                      size="sm"
                      className="text-xs h-7"
                      onClick={() => setGenDays(p.val)}
                    >
                      {p.label}
                    </Button>
                  ))}
                </div>
              </div>

              <Button
                type="button"
                size="sm"
                className="w-full bg-primary text-xs h-8"
                onClick={handleGenerateAndApply}
              >
                Gerar e Liberar Acesso Nesta Máquina
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
