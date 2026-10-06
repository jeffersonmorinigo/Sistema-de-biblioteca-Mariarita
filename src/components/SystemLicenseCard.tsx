import React, { useState } from 'react';
import { useLicense } from '@/hooks/useLicense';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { showSuccess, showError, showInfo } from '@/utils/toast';
import {
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  Key,
  Copy,
  Check,
  Lock,
  Sparkles,
  Calendar,
  Building2,
  Cpu,
  RefreshCw,
} from 'lucide-react';

interface SystemLicenseCardProps {
  currentSchoolName?: string;
}

export const SystemLicenseCard: React.FC<SystemLicenseCardProps> = ({ currentSchoolName }) => {
  const { licenseInfo, loading, activate, refresh, generateKey } = useLicense();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [licenseInput, setLicenseInput] = useState('');
  const [activating, setActivating] = useState(false);
  const [copiedId, setCopiedId] = useState(false);
  const [copiedGeneratedKey, setCopiedGeneratedKey] = useState(false);

  // Estados do Gerador de Licença (Administrador / Desenvolvedor)
  const [adminUnlocked, setAdminUnlocked] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');
  const [genInstitution, setGenInstitution] = useState('');
  const [genMachineId, setGenMachineId] = useState('');
  const [genDays, setGenDays] = useState('365');
  const [genCustomDate, setGenCustomDate] = useState('');
  const [generatedKeyResult, setGeneratedKeyResult] = useState('');

  const handleCopyMachineId = () => {
    if (!licenseInfo?.machineId) return;
    navigator.clipboard.writeText(licenseInfo.machineId);
    setCopiedId(true);
    showSuccess('ID da máquina copiado para a área de transferência!');
    setTimeout(() => setCopiedId(false), 2000);
  };

  const handleCopyGeneratedKey = () => {
    if (!generatedKeyResult) return;
    navigator.clipboard.writeText(generatedKeyResult);
    setCopiedGeneratedKey(true);
    showSuccess('Chave de licença copiada!');
    setTimeout(() => setCopiedGeneratedKey(false), 2000);
  };

  const handleOpenDialog = () => {
    setLicenseInput('');
    setDialogOpen(true);
    // Pré-preenche o gerador com o ID atual e nome da escola
    if (licenseInfo?.machineId) {
      setGenMachineId(licenseInfo.machineId);
    }
    if (currentSchoolName || licenseInfo?.institution) {
      setGenInstitution(currentSchoolName || licenseInfo?.institution || 'Escola Maria Rita');
    }
  };

  const handleActivate = async () => {
    if (!licenseInput.trim()) {
      showError('Por favor, cole a chave de licença.');
      return;
    }

    setActivating(true);
    try {
      const res = await activate(licenseInput.trim());
      if (res.success) {
        showSuccess(res.message);
        setLicenseInput('');
        setDialogOpen(false);
      } else {
        showError(res.message || 'Falha ao ativar licença.');
      }
    } catch (err: any) {
      showError('Erro ao processar ativação: ' + (err?.message || 'Tente novamente'));
    } finally {
      setActivating(false);
    }
  };

  const handleUnlockAdmin = (e: React.FormEvent) => {
    e.preventDefault();
    // Senha mestre do desenvolvedor/suporte
    if (adminPassword.trim() === 'AdminDev@2026') {
      setAdminUnlocked(true);
      setAdminPassword('');
      showSuccess('Painel de emissão de licenças liberado!');
    } else {
      showError('Senha mestre incorreta.');
    }
  };

  const handleGenerateLicense = async () => {
    if (!genInstitution.trim()) {
      showError('Informe o nome da instituição.');
      return;
    }
    if (!genMachineId.trim()) {
      showError('Informe o ID da máquina de destino.');
      return;
    }

    let targetDateStr = '';
    if (genDays === 'custom') {
      if (!genCustomDate) {
        showError('Selecione a data de expiração personalizada.');
        return;
      }
      targetDateStr = genCustomDate;
    } else {
      const days = parseInt(genDays, 10);
      const target = new Date();
      target.setDate(target.getDate() + days);
      targetDateStr = target.toISOString().slice(0, 10);
    }

    try {
      const key = await generateKey({
        institution: genInstitution.trim(),
        machineId: genMachineId.trim().toUpperCase(),
        expiresAt: targetDateStr,
      });

      setGeneratedKeyResult(key);
      showSuccess('Chave de licença gerada com sucesso!');
    } catch (e: any) {
      showError('Erro ao gerar chave: ' + (e?.message || ''));
    }
  };

  const handleApplyGeneratedToCurrent = async () => {
    if (!generatedKeyResult) return;
    setActivating(true);
    try {
      const res = await activate(generatedKeyResult);
      if (res.success) {
        showSuccess('Licença aplicada e ativada imediatamente!');
        setDialogOpen(false);
      } else {
        showError(res.message);
      }
    } catch (e: any) {
      showError('Erro ao aplicar: ' + e?.message);
    } finally {
      setActivating(false);
    }
  };

  const isAuthorized = licenseInfo?.isAuthorized ?? false;
  const status = licenseInfo?.status;

  // Render do ícone e cor de status baseado no estado da licença
  const getStatusColor = () => {
    if (status === 'ACTIVE') return 'text-emerald-600 dark:text-emerald-400';
    if (status === 'EXPIRING_SOON') return 'text-amber-500 dark:text-amber-400';
    return 'text-rose-600 dark:text-rose-400';
  };

  const getStatusBg = () => {
    if (status === 'ACTIVE') return 'bg-emerald-500/10 border-emerald-500/30';
    if (status === 'EXPIRING_SOON') return 'bg-amber-500/10 border-amber-500/30';
    return 'bg-rose-500/10 border-rose-500/30';
  };

  return (
    <>
      <Card className="shadow-sm hover:shadow-md transition-shadow duration-200">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2.5">
            {isAuthorized ? (
              <ShieldCheck className="h-6 w-6 text-emerald-600 dark:text-emerald-400 shrink-0" />
            ) : status === 'EXPIRING_SOON' ? (
              <ShieldAlert className="h-6 w-6 text-amber-500 dark:text-amber-400 shrink-0" />
            ) : (
              <ShieldX className="h-6 w-6 text-rose-600 dark:text-rose-400 shrink-0" />
            )}
            <div>
              <CardTitle className="text-lg font-semibold tracking-tight">
                Licença do Sistema
              </CardTitle>
              <CardDescription className="text-xs sm:text-sm mt-0.5">
                Status de proteção e validade do software neste computador.
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Card interno com dados idênticos à imagem de referência */}
          <div className="rounded-xl border bg-slate-50/80 dark:bg-slate-900/50 p-4 space-y-3 shadow-inner">
            <div className="flex justify-between items-center text-sm">
              <span className="text-muted-foreground font-medium">Status da Licença:</span>
              <div className="flex items-center gap-1.5">
                <span className={`inline-block h-2 w-2 rounded-full ${isAuthorized ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
                <span className={`font-semibold ${getStatusColor()}`}>
                  {loading ? 'Verificando...' : licenseInfo?.statusLabel || 'Não Ativado'}
                </span>
              </div>
            </div>

            <div className="flex justify-between items-center text-sm gap-2">
              <span className="text-muted-foreground font-medium shrink-0">Instituição:</span>
              <span className="font-semibold text-foreground text-right truncate">
                {licenseInfo?.institution || currentSchoolName || 'EE Profº Silvio Santos de Oliveira'}
              </span>
            </div>

            <div className="flex justify-between items-center text-sm">
              <span className="text-muted-foreground font-medium">Validade:</span>
              <span className="font-semibold text-foreground">
                {licenseInfo?.validityFormatted || 'Não Ativado'}
              </span>
            </div>

            <div className="flex justify-between items-center text-sm">
              <span className="text-muted-foreground font-medium">Dias Restantes:</span>
              <span className={`font-semibold ${getStatusColor()}`}>
                {licenseInfo?.daysRemaining !== undefined
                  ? `${licenseInfo.daysRemaining} dia(s)`
                  : 'Nenhum'}
              </span>
            </div>

            <div className="pt-2.5 border-t border-slate-200 dark:border-slate-800 space-y-1.5">
              <span className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase block">
                ID DESTA MÁQUINA (HARDWARE):
              </span>
              <div className="flex items-center justify-between gap-2 bg-background border border-slate-200 dark:border-slate-800 px-3 py-2 rounded-md font-mono text-xs sm:text-sm font-medium tracking-wider text-slate-800 dark:text-slate-200">
                <span className="truncate">{licenseInfo?.machineId || 'Carregando ID...'}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs hover:bg-slate-200 dark:hover:bg-slate-800 flex items-center gap-1 shrink-0"
                  onClick={handleCopyMachineId}
                  title="Copiar ID da Máquina"
                >
                  {copiedId ? (
                    <>
                      <Check className="h-3.5 w-3.5 text-emerald-600" />
                      <span className="text-emerald-600 text-[11px]">Copiado</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5" />
                      <span className="text-[11px]">Copiar</span>
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>

          {/* Alerta caso a licença esteja expirada ou seja de outra máquina */}
          {!isAuthorized && licenseInfo?.warningMessage && (
            <Alert variant="destructive" className="py-2.5">
              <ShieldAlert className="h-4 w-4" />
              <AlertTitle className="text-xs font-semibold">Atenção</AlertTitle>
              <AlertDescription className="text-xs">
                {licenseInfo.warningMessage}
              </AlertDescription>
            </Alert>
          )}

          {/* Botão de Renovação idêntico ao modelo */}
          <Button
            type="button"
            variant="outline"
            className="w-full h-10 font-medium flex items-center justify-center gap-2 border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shadow-sm"
            onClick={handleOpenDialog}
          >
            <Key className="h-4 w-4 text-slate-700 dark:text-slate-300" />
            Renovar / Alterar Licença
          </Button>
        </CardContent>
      </Card>

      {/* Modal de Renovação e Gerador de Licenças */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              <Key className="h-5 w-5 text-primary" />
              Gerenciamento de Licença do Sistema
            </DialogTitle>
            <DialogDescription>
              Ative ou renove a licença para liberar o funcionamento contínuo nesta máquina.
            </DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="activate" className="w-full mt-2">
            <TabsList className="grid grid-cols-2 w-full">
              <TabsTrigger value="activate" className="text-xs sm:text-sm">
                Ativar / Renovar
              </TabsTrigger>
              <TabsTrigger value="admin" className="text-xs sm:text-sm flex items-center gap-1.5">
                <Lock className="h-3.5 w-3.5" />
                Gerador (Suporte)
              </TabsTrigger>
            </TabsList>

            {/* ABA 1: Ativação pelo Cliente / Operador */}
            <TabsContent value="activate" className="space-y-4 pt-3">
              <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
                <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground uppercase">
                  <span>ID desta Máquina (Hardware)</span>
                  <span className="text-[10px] lowercase text-muted-foreground/80">Envie este código ao suporte</span>
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    readOnly
                    value={licenseInfo?.machineId || ''}
                    className="font-mono text-xs sm:text-sm bg-background font-semibold"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="shrink-0 h-9"
                    onClick={handleCopyMachineId}
                  >
                    {copiedId ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="license-key-input" className="text-sm font-medium">
                  Chave de Licença (Código de Ativação)
                </Label>
                <Textarea
                  id="license-key-input"
                  placeholder="Cole aqui a chave de ativação fornecida (ex: LIC-eyJpbnN0aXR1dGlvbi...)"
                  value={licenseInput}
                  onChange={(e) => setLicenseInput(e.target.value)}
                  rows={4}
                  className="font-mono text-xs resize-none"
                />
                <p className="text-[11px] text-muted-foreground">
                  A chave de licença é criptografada e vinculada exclusivamente ao ID desta máquina física.
                </p>
              </div>

              <DialogFooter className="pt-2 flex flex-col sm:flex-row gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDialogOpen(false)}
                >
                  Cancelar
                </Button>
                <Button
                  type="button"
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
                  disabled={activating || !licenseInput.trim()}
                  onClick={handleActivate}
                >
                  {activating ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Validando...
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="h-4 w-4 mr-2" />
                      Validar e Ativar Licença
                    </>
                  )}
                </Button>
              </DialogFooter>
            </TabsContent>

            {/* ABA 2: Gerador de Licenças para o Desenvolvedor / Suporte Técnico */}
            <TabsContent value="admin" className="space-y-4 pt-3">
              {!adminUnlocked ? (
                <form onSubmit={handleUnlockAdmin} className="space-y-4 py-4">
                  <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3.5 flex items-start gap-2.5">
                    <Lock className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                    <div className="text-xs space-y-1">
                      <p className="font-semibold text-amber-900 dark:text-amber-200">
                        Área Restrita do Desenvolvedor / Suporte
                      </p>
                      <p className="text-amber-800 dark:text-amber-300">
                        Insira a senha mestre para gerar chaves de ativação personalizadas para clientes e escolas.
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="admin-pass" className="text-xs font-medium">
                      Senha Mestre de Desenvolvedor
                    </Label>
                    <Input
                      id="admin-pass"
                      type="password"
                      placeholder="Digite a senha mestre de desenvolvedor"
                      value={adminPassword}
                      onChange={(e) => setAdminPassword(e.target.value)}
                    />
                  </div>

                  <Button type="submit" className="w-full">
                    Desbloquear Gerador
                  </Button>
                </form>
              ) : (
                <div className="space-y-3.5">
                  <div className="flex items-center justify-between pb-1 border-b">
                    <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                      <Sparkles className="h-4 w-4" />
                      Gerador de Chaves Ativo
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-6 text-xs text-muted-foreground"
                      onClick={() => setAdminUnlocked(false)}
                    >
                      Bloquear
                    </Button>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs flex items-center gap-1.5">
                      <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                      Nome da Escola / Instituição
                    </Label>
                    <Input
                      value={genInstitution}
                      onChange={(e) => setGenInstitution(e.target.value)}
                      placeholder="Ex: EE Profº Silvio Santos de Oliveira"
                      className="text-xs"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center">
                      <Label className="text-xs flex items-center gap-1.5">
                        <Cpu className="h-3.5 w-3.5 text-muted-foreground" />
                        ID da Máquina de Destino (Hardware)
                      </Label>
                      {licenseInfo?.machineId && (
                        <button
                          type="button"
                          className="text-[11px] text-primary hover:underline"
                          onClick={() => setGenMachineId(licenseInfo.machineId)}
                        >
                          Usar Desta Máquina
                        </button>
                      )}
                    </div>
                    <Input
                      value={genMachineId}
                      onChange={(e) => setGenMachineId(e.target.value.toUpperCase())}
                      placeholder="Ex: SILVIO-88E1-A29C-8757-0E10"
                      className="font-mono text-xs"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs flex items-center gap-1.5">
                      <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                      Prazo de Validade
                    </Label>
                    <div className="grid grid-cols-3 gap-1.5">
                      {[
                        { label: '30 Dias (Teste)', val: '30' },
                        { label: '90 Dias', val: '90' },
                        { label: '180 Dias', val: '180' },
                        { label: '1 Ano (365d)', val: '365' },
                        { label: '2 Anos', val: '730' },
                        { label: 'Personalizado', val: 'custom' },
                      ].map((item) => (
                        <Button
                          key={item.val}
                          type="button"
                          size="sm"
                          variant={genDays === item.val ? 'default' : 'outline'}
                          className="text-[11px] h-8 px-2"
                          onClick={() => setGenDays(item.val)}
                        >
                          {item.label}
                        </Button>
                      ))}
                    </div>

                    {genDays === 'custom' && (
                      <div className="pt-2">
                        <Input
                          type="date"
                          value={genCustomDate}
                          onChange={(e) => setGenCustomDate(e.target.value)}
                          className="text-xs"
                        />
                      </div>
                    )}
                  </div>

                  <Button
                    type="button"
                    onClick={handleGenerateLicense}
                    className="w-full bg-primary font-medium"
                  >
                    Gerar Chave de Licença
                  </Button>

                  {generatedKeyResult && (
                    <div className="rounded-lg border bg-muted/40 p-3 space-y-2 mt-2">
                      <Label className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 block">
                        Chave Gerada com Sucesso:
                      </Label>
                      <Textarea
                        readOnly
                        value={generatedKeyResult}
                        rows={3}
                        className="font-mono text-xs bg-background resize-none"
                      />
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="flex-1 text-xs"
                          onClick={handleCopyGeneratedKey}
                        >
                          {copiedGeneratedKey ? (
                            <>
                              <Check className="h-3.5 w-3.5 mr-1 text-emerald-600" />
                              Copiado!
                            </>
                          ) : (
                            <>
                              <Copy className="h-3.5 w-3.5 mr-1" />
                              Copiar Chave
                            </>
                          )}
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs"
                          onClick={handleApplyGeneratedToCurrent}
                        >
                          <ShieldCheck className="h-3.5 w-3.5 mr-1" />
                          Ativar Nesta Máquina Agora
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </>
  );
};
