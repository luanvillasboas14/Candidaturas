'use client';

import { FocusEvent, FormEvent, useEffect, useRef, useState } from 'react';
import {
  DIAS_HORARIO,
  PERIODOS,
  calcularHorario,
  horaPronta,
  mascaraHora,
  validarDias,
  type DiasGrade,
  type GradeHorario,
} from './horario';
import type { VagaFormulario, VagaLista, VagaModelo } from './vaga';
import type { Empresa, Grupo } from './validar';
import { cepMascarado, cnpjMascarado, digitosCep, digitosCnpj } from './validar';

type Modo = 'grupo' | 'empresa';
type Aba = Modo | 'vaga';

const VAGA_VAZIA = {
  empresaId: '',
  tipoVaga: '',
  quantidade: '1',
  cargo: '',
  bolsa: '',
  cargaHoraria: '',
  periodo: '',
  diaDe: '',
  diaAte: '',
  entrada: '',
  intervaloHoras: '0',
  intervaloMinutos: '0',
  escolaridade: '',
  sexo: '',
  idade: '',
  idadeAte: '',
  km: '',
  atividades: '',
  tempoHoras: '',
  tempoMinutos: '',
  beneficios: '',
  conducoes: '',
  folgasFixas: '',
  jornada: '',
  tipoTrabalho: '',
};

const TIPO_VAGA: Record<number, string> = {
  1: 'Estágio',
  2: 'CLT',
  4: 'Pessoa jurídica',
};

const VAZIO = {
  nome: '',
  email: '',
  telefone: '',
  grupoId: '',
  cnpj: '',
  razaoSocial: '',
  nomeFantasia: '',
  cep: '',
  logradouro: '',
  numero: '',
  complemento: '',
};

type Formulario = typeof VAZIO;

function soltarSugestao(event: FocusEvent<HTMLInputElement>) {
  const input = event.currentTarget;
  window.setTimeout(() => input.removeAttribute('readonly'), 120);
}

function campoSemSugestao(id: string) {
  return {
    id,
    name: id,
    autoComplete: 'one-time-code' as const,
    autoCorrect: 'off' as const,
    autoCapitalize: 'off' as const,
    spellCheck: false as const,
    readOnly: true as const,
    'data-1p-ignore': 'true',
    'data-lpignore': 'true',
    'data-form-type': 'other',
    onFocus: soltarSugestao,
  };
}

function Rotulo({ texto, obrigatorio = false }: { texto: string; obrigatorio?: boolean }) {
  return (
    <span className="ge-rotulo">
      {texto}
      {obrigatorio ? <span className="ge-obrigatorio">*</span> : null}
    </span>
  );
}

function contato(email: string | null, telefone: string | null): string {
  return [email, telefone].filter(Boolean).join(' · ') || 'Sem contato';
}

function linhaEndereco(empresa: Empresa): string {
  const rua = [empresa.logradouro, empresa.numero].filter(Boolean).join(', ');
  return [rua, empresa.complemento].filter(Boolean).join(' · ');
}

function normalizar(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function inclui(valor: string, termo: string): boolean {
  return normalizar(valor).includes(normalizar(termo));
}

export function GruposEmpresas() {
  const grupoRef = useRef<HTMLDivElement>(null);
  const empresaRef = useRef<HTMLDivElement>(null);
  const [aba, setAba] = useState<Aba>('grupo');
  const [modo, setModo] = useState<Modo>('grupo');
  const [vagaForm, setVagaForm] = useState(VAGA_VAZIA);
  const [vagas, setVagas] = useState<VagaLista[]>([]);
  const [erroVaga, setErroVaga] = useState('');
  const [forms, setForms] = useState<Record<Modo, Formulario>>({
    grupo: { ...VAZIO },
    empresa: { ...VAZIO },
  });
  const [editandoPorModo, setEditandoPorModo] = useState<Record<Modo, string | null>>({
    grupo: null,
    empresa: null,
  });
  const form = forms[modo];
  const editando = editandoPorModo[modo];

  function setForm(value: Formulario | ((atual: Formulario) => Formulario), alvo: Modo = modo) {
    setForms((atual) => ({
      ...atual,
      [alvo]: typeof value === 'function' ? value(atual[alvo]) : value,
    }));
  }

  function setEditando(id: string | null, alvo: Modo = modo) {
    setEditandoPorModo((atual) => ({ ...atual, [alvo]: id }));
  }
  const [grupos, setGrupos] = useState<Grupo[]>([]);
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [excluindo, setExcluindo] = useState(false);
  const [confirmar, setConfirmar] = useState(false);
  const [vagaParaExcluir, setVagaParaExcluir] = useState<VagaLista | null>(null);
  const [vagaEditando, setVagaEditando] = useState<string | null>(null);
  const [modelos, setModelos] = useState<VagaModelo[]>([]);
  const [modeloId, setModeloId] = useState('');
  const [erro, setErro] = useState('');
  const [aviso, setAviso] = useState('');
  const [buscaGrupoCampo, setBuscaGrupoCampo] = useState('');
  const [grupoAberto, setGrupoAberto] = useState(false);
  const [buscaEmpresa, setBuscaEmpresa] = useState('');
  const [empresaAberto, setEmpresaAberto] = useState(false);
  const [diasAjuste, setDiasAjuste] = useState<DiasGrade | null>(null);
  const [filtroGrupos, setFiltroGrupos] = useState('');
  const [filtroEmpresas, setFiltroEmpresas] = useState('');

  const grupoSelecionado = grupos.find((grupo) => grupo.id === form.grupoId) || null;
  const empresaSelecionada = empresas.find((empresa) => empresa.id === vagaForm.empresaId) || null;
  const empresasDoCampo = empresas.filter(
    (empresa) =>
      !buscaEmpresa.trim() || inclui(empresa.nome_fantasia, buscaEmpresa) || inclui(empresa.razao_social, buscaEmpresa)
  );
  function mudarHorario(parcial: Partial<typeof VAGA_VAZIA>) {
    setDiasAjuste(null);
    setVagaForm({ ...vagaForm, ...parcial });
  }

  let gradeHorario: GradeHorario | null = null;
  let avisoHorario = '';
  const horarioBasePronto = Boolean(
    (vagaForm.tipoVaga === '1' || vagaForm.tipoVaga === '2') &&
    vagaForm.cargaHoraria &&
    vagaForm.periodo &&
    vagaForm.diaDe &&
    vagaForm.diaAte
  );
  const entradaPronta = horaPronta(vagaForm.entrada);
  if (horarioBasePronto && (entradaPronta || /^\d{1,2}:\d{2}$/.test(vagaForm.entrada.trim()))) {
    try {
      gradeHorario = calcularHorario(vagaForm);
    } catch (error) {
      avisoHorario = error instanceof Error ? error.message : 'O horário está inválido.';
    }
  }
  const diasVisiveis = gradeHorario ? (diasAjuste ?? gradeHorario.dias) : null;
  const diaIncompleto = diasVisiveis
    ? DIAS_HORARIO.some((dia) => {
        const entrada = diasVisiveis[dia.entrada];
        const saida = diasVisiveis[dia.saida];
        return (entrada !== '' && !horaPronta(entrada)) || (saida !== '' && !horaPronta(saida));
      })
    : false;
  if (gradeHorario && diasVisiveis && !avisoHorario && !diaIncompleto) {
    try {
      validarDias(gradeHorario.cargaHoraria, gradeHorario.intervaloMinutos, diasVisiveis);
    } catch (error) {
      avisoHorario = error instanceof Error ? error.message : 'O horário está inválido.';
    }
  }

  async function carregar() {
    setCarregando(true);
    setErro('');
    try {
      const [resGrupos, resEmpresas, resVagas] = await Promise.all([
        fetch('/api/grupos'),
        fetch('/api/empresas'),
        fetch('/api/grupos-empresas/vagas'),
      ]);
      const jsonGrupos = await resGrupos.json();
      const jsonEmpresas = await resEmpresas.json();
      const jsonVagas = await resVagas.json();
      if (!resGrupos.ok || !jsonGrupos.success) {
        throw new Error(jsonGrupos.message || 'Não foi possível listar os grupos.');
      }
      if (!resEmpresas.ok || !jsonEmpresas.success) {
        throw new Error(jsonEmpresas.message || 'Não foi possível listar as empresas.');
      }
      setGrupos(jsonGrupos.grupos);
      setEmpresas(jsonEmpresas.empresas);
      if (!resVagas.ok || !jsonVagas.success) {
        setVagas([]);
        setErroVaga(jsonVagas.message || 'Não foi possível listar as vagas.');
      } else {
        setVagas(jsonVagas.vagas);
        setErroVaga('');
      }
    } catch (error) {
      setErro(error instanceof Error ? error.message : 'Não foi possível carregar.');
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    void carregar();
  }, []);

  useEffect(() => {
    function fechar(event: MouseEvent) {
      if (grupoRef.current && !grupoRef.current.contains(event.target as Node)) {
        setGrupoAberto(false);
      }
      if (empresaRef.current && !empresaRef.current.contains(event.target as Node)) {
        setEmpresaAberto(false);
      }
    }
    document.addEventListener('mousedown', fechar);
    return () => document.removeEventListener('mousedown', fechar);
  }, []);

  useEffect(() => {
    if (aba !== 'vaga' || !vagaForm.empresaId || vagaEditando) {
      setModelos([]);
      return;
    }
    let ativo = true;
    void fetch(`/api/grupos-empresas/vagas?repetidas=${encodeURIComponent(vagaForm.empresaId)}`)
      .then((response) => response.json())
      .then((payload: { success?: boolean; modelos?: VagaModelo[] }) => {
        if (ativo) setModelos(payload.success && payload.modelos ? payload.modelos : []);
      })
      .catch(() => {
        if (ativo) setModelos([]);
      });
    return () => {
      ativo = false;
    };
  }, [aba, vagaForm.empresaId, vagaEditando]);

  function limpar() {
    setEditando(null);
    setForm(VAZIO);
    setBuscaGrupoCampo('');
    setGrupoAberto(false);
    setConfirmar(false);
    setAviso('');
    setErro('');
  }

  function escolher(proximo: Aba) {
    if (proximo === aba) return;
    setAba(proximo);
    if (proximo !== 'vaga') setModo(proximo);
    setGrupoAberto(false);
    setConfirmar(false);
    setAviso('');
    setErro('');
  }

  function editarGrupo(grupo: Grupo) {
    setModo('grupo');
    setEditando(grupo.id, 'grupo');
    setForm({ ...VAZIO, nome: grupo.nome, email: grupo.email || '', telefone: grupo.telefone || '' }, 'grupo');
    setBuscaGrupoCampo('');
    setGrupoAberto(false);
    setConfirmar(false);
    setAviso('');
    setErro('');
  }

  function editarEmpresa(empresa: Empresa) {
    setModo('empresa');
    setEditando(empresa.id, 'empresa');
    setForm({
      ...VAZIO,
      grupoId: empresa.grupo_id || '',
      cnpj: cnpjMascarado(empresa.cnpj),
      razaoSocial: empresa.razao_social,
      nomeFantasia: empresa.nome_fantasia,
      email: empresa.email || '',
      telefone: empresa.telefone || '',
      cep: cepMascarado(empresa.cep),
      logradouro: empresa.logradouro,
      numero: empresa.numero || '',
      complemento: empresa.complemento || '',
    }, 'empresa');
    setBuscaGrupoCampo('');
    setGrupoAberto(false);
    setConfirmar(false);
    setAviso('');
    setErro('');
  }

  function empresaDoGrupo(grupo: Grupo, termo: string): Empresa | undefined {
    return empresas.find(
      (empresa) =>
        empresa.grupo_id === grupo.id &&
        (inclui(empresa.nome_fantasia, termo) || inclui(empresa.razao_social, termo))
    );
  }

  function grupoCombina(grupo: Grupo, termo: string): boolean {
    if (!termo.trim()) return true;
    if (inclui(grupo.nome, termo)) return true;
    return Boolean(empresaDoGrupo(grupo, termo));
  }

  function empresaCombina(empresa: Empresa, termo: string): boolean {
    if (!termo.trim()) return true;
    return (
      inclui(empresa.razao_social, termo) ||
      inclui(empresa.nome_fantasia, termo) ||
      inclui(empresa.grupo_nome, termo) ||
      (!empresa.grupo_id && inclui('Sem grupo', termo))
    );
  }

  const gruposDoCampo = grupos.filter((grupo) => grupoCombina(grupo, buscaGrupoCampo));
  const gruposVisiveis = grupos.filter((grupo) => grupoCombina(grupo, filtroGrupos));
  const empresasVisiveis = empresas.filter((empresa) => empresaCombina(empresa, filtroEmpresas));
  const nomeExclusao =
    modo === 'grupo'
      ? form.nome.trim() || 'este grupo'
      : form.nomeFantasia.trim() || form.razaoSocial.trim() || 'esta empresa';

  async function salvarVaga(event: FormEvent) {
    event.preventDefault();
    setSalvando(true);
    setErro('');
    setAviso('');
    try {
      const corpo: Record<string, unknown> = { ...vagaForm };
      if (vagaForm.tipoVaga === '1' || vagaForm.tipoVaga === '2') {
        const grade = calcularHorario(vagaForm);
        const dias = diasAjuste ?? grade.dias;
        validarDias(grade.cargaHoraria, grade.intervaloMinutos, dias);
        corpo.dias = dias;
      }
      const response = await fetch('/api/grupos-empresas/vagas', {
        method: vagaEditando ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(vagaEditando ? { ...corpo, id: vagaEditando, quantidade: '1' } : corpo),
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) {
        throw new Error(payload.message || 'Não foi possível abrir a vaga.');
      }
      setAviso(vagaEditando ? 'Alteração salva.' : 'Vaga cadastrada.');
      setDiasAjuste(null);
      setVagaEditando(null);
      setVagaForm(VAGA_VAZIA);
      setModeloId('');
      await carregar();
    } catch (error) {
      setErro(error instanceof Error ? error.message : 'Não foi possível abrir a vaga.');
    } finally {
      setSalvando(false);
    }
  }

  async function salvar(event: FormEvent) {
    event.preventDefault();
    setSalvando(true);
    setErro('');
    setAviso('');
    try {
      if (modo === 'empresa' && !form.grupoId) {
        throw new Error('Escolha um grupo.');
      }
      const url =
        modo === 'grupo'
          ? editando
            ? `/api/grupos/${editando}`
            : '/api/grupos'
          : editando
            ? `/api/empresas/${editando}`
            : '/api/empresas';
      const body =
        modo === 'grupo'
          ? { nome: form.nome, email: form.email, telefone: form.telefone }
          : {
              grupoId: form.grupoId,
              cnpj: digitosCnpj(form.cnpj),
              razaoSocial: form.razaoSocial,
              nomeFantasia: form.nomeFantasia,
              email: form.email,
              telefone: form.telefone,
              cep: digitosCep(form.cep),
              logradouro: form.logradouro,
              numero: form.numero,
              complemento: form.complemento,
            };
      const response = await fetch(url, {
        method: editando ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) {
        throw new Error(payload.message || 'Não foi possível salvar.');
      }
      setAviso(editando ? 'Alteração salva.' : 'Cadastro salvo.');
      setEditando(null);
      setForm(VAZIO);
      setBuscaGrupoCampo('');
      setGrupoAberto(false);
      await carregar();
    } catch (error) {
      setErro(error instanceof Error ? error.message : 'Não foi possível salvar.');
    } finally {
      setSalvando(false);
    }
  }

  async function aoMudarCep(valor: string) {
    const digits = digitosCep(valor);
    setForm((atual) => ({ ...atual, cep: cepMascarado(valor) }), 'empresa');
    if (digits.length !== 8) return;
    try {
      const response = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
      const data = await response.json();
      if (!response.ok || data?.erro) return;
      setForm((atual) => {
        if (digitosCep(atual.cep) !== digits) return atual;
        return {
          ...atual,
          logradouro: typeof data.logradouro === 'string' && data.logradouro ? data.logradouro : atual.logradouro,
        };
      }, 'empresa');
    } catch {
      return;
    }
  }

  function cancelarVaga() {
    setVagaEditando(null);
    setDiasAjuste(null);
    setVagaForm(VAGA_VAZIA);
    setModeloId('');
    setBuscaEmpresa('');
    setEmpresaAberto(false);
    setAviso('');
    setErro('');
  }

  async function editarVaga(vaga: VagaLista) {
    setErro('');
    setAviso('');
    setSalvando(true);
    try {
      const response = await fetch(`/api/grupos-empresas/vagas?id=${encodeURIComponent(vaga.id)}`);
      const payload = await response.json();
      if (!response.ok || !payload.success) {
        throw new Error(payload.message || 'Não foi possível abrir a vaga.');
      }
      const formulario = payload.vaga as VagaFormulario;
      const { dias, ...campos } = formulario;
      setVagaEditando(vaga.id);
      setVagaForm({ ...VAGA_VAZIA, ...campos });
      setDiasAjuste(dias);
      setBuscaEmpresa('');
      setEmpresaAberto(false);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (error) {
      setErro(error instanceof Error ? error.message : 'Não foi possível abrir a vaga.');
    } finally {
      setSalvando(false);
    }
  }

  async function excluirVaga() {
    if (!vagaParaExcluir) return;
    setExcluindo(true);
    setErro('');
    setAviso('');
    try {
      const response = await fetch(`/api/grupos-empresas/vagas?id=${encodeURIComponent(vagaParaExcluir.id)}`, {
        method: 'DELETE',
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) {
        throw new Error(payload.message || 'Não foi possível apagar a vaga.');
      }
      setVagaParaExcluir(null);
      setAviso('Vaga excluída.');
      await carregar();
    } catch (error) {
      setVagaParaExcluir(null);
      setErro(error instanceof Error ? error.message : 'Não foi possível apagar a vaga.');
    } finally {
      setExcluindo(false);
    }
  }

  async function excluir() {
    if (!editando) return;
    setExcluindo(true);
    setErro('');
    setAviso('');
    try {
      const response = await fetch(modo === 'grupo' ? `/api/grupos/${editando}` : `/api/empresas/${editando}`, {
        method: 'DELETE',
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) {
        throw new Error(payload.message || 'Não foi possível excluir.');
      }
      setConfirmar(false);
      setEditando(null);
      setForm(VAZIO);
      setBuscaGrupoCampo('');
      setAviso(modo === 'grupo' ? 'Grupo excluído.' : 'Empresa excluída.');
      await carregar();
    } catch (error) {
      setConfirmar(false);
      setErro(error instanceof Error ? error.message : 'Não foi possível excluir.');
    } finally {
      setExcluindo(false);
    }
  }

  return (
    <div className="ge-pagina">
      <div className="ge-modos" role="tablist">
        <button type="button" className={aba === 'grupo' ? 'ativo' : ''} onClick={() => escolher('grupo')}>
          Grupo
        </button>
        <button type="button" className={aba === 'empresa' ? 'ativo' : ''} onClick={() => escolher('empresa')}>
          Empresa
        </button>
        <button type="button" className={aba === 'vaga' ? 'ativo' : ''} onClick={() => escolher('vaga')}>
          Vaga
        </button>
      </div>

      <form
        className={aba === 'vaga' ? 'form ge-vaga' : 'form'}
        autoComplete="off"
        onSubmit={(event) => void (aba === 'vaga' ? salvarVaga(event) : salvar(event))}
      >
        {aba === 'vaga' ? (
          <>
            <div className="field c8" ref={empresaRef}>
              <Rotulo texto="Empresa" obrigatorio />
              <div className="search-select">
                <input
                  {...campoSemSugestao('q-ve')}
                  placeholder="Buscar pelo nome fantasia ou razão social"
                  value={empresaSelecionada ? empresaSelecionada.nome_fantasia : buscaEmpresa}
                  onFocus={(event) => {
                    soltarSugestao(event);
                    setEmpresaAberto(true);
                    event.currentTarget.select();
                  }}
                  onChange={(event) => {
                    setBuscaEmpresa(event.target.value);
                    setVagaForm({ ...vagaForm, empresaId: '' });
                    setEmpresaAberto(true);
                  }}
                />
                {empresaAberto ? (
                  <div className="dropdown">
                    {empresasDoCampo.length === 0 ? (
                      <div className="dropdown-empty">Nenhuma empresa encontrada.</div>
                    ) : (
                      empresasDoCampo.map((empresa) => (
                        <button
                          key={empresa.id}
                          type="button"
                          className={`dropdown-item${empresa.id === vagaForm.empresaId ? ' selected' : ''}`}
                          onClick={() => {
                            setVagaForm({ ...vagaForm, empresaId: empresa.id });
                            setModeloId('');
                            setBuscaEmpresa('');
                            setEmpresaAberto(false);
                          }}
                        >
                          <span className="dropdown-title">{empresa.nome_fantasia}</span>
                          {empresa.razao_social !== empresa.nome_fantasia ? (
                            <span className="dropdown-meta">{empresa.razao_social}</span>
                          ) : null}
                        </button>
                      ))
                    )}
                  </div>
                ) : null}
              </div>
            </div>
            <div className="field c4">
              <Rotulo texto="Tipo" obrigatorio />
              <select
                value={vagaForm.tipoVaga}
                onChange={(event) => {
                  setDiasAjuste(null);
                  const tipoVaga = event.target.value;
                  const cargas = tipoVaga === '2' ? ['44', '40'] : tipoVaga === '1' ? ['30', '20'] : [];
                  setVagaForm({
                    ...vagaForm,
                    tipoVaga,
                    cargaHoraria: cargas.includes(vagaForm.cargaHoraria) ? vagaForm.cargaHoraria : '',
                  });
                }}
              >
                <option value="">Selecione</option>
                <option value="1">Estágio</option>
                <option value="2">CLT</option>
              </select>
            </div>
            {!vagaEditando && vagaForm.empresaId && modelos.length > 0 ? (
              <div className="field c12">
                <Rotulo texto="Vaga já aberta nesta empresa" />
                <select
                  value={modeloId}
                  onChange={(event) => {
                    const id = event.target.value;
                    setModeloId(id);
                    const modelo = modelos.find((item) => item.vagaId === id);
                    if (!modelo) return;
                    const { dias, ...campos } = modelo.formulario;
                    setDiasAjuste(dias);
                    setVagaForm({
                      ...VAGA_VAZIA,
                      ...campos,
                      empresaId: vagaForm.empresaId,
                      quantidade: vagaForm.quantidade || '1',
                    });
                  }}
                >
                  <option value="">Nova vaga</option>
                  {modelos.map((modelo) => (
                    <option key={modelo.vagaId} value={modelo.vagaId}>
                      {modelo.formulario.cargo} · {TIPO_VAGA[Number(modelo.formulario.tipoVaga)] || 'Vaga'}
                      {modelo.formulario.cargaHoraria ? ` · ${modelo.formulario.cargaHoraria}h` : ''}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
            {vagaForm.tipoVaga ? (
              <>
                <div className="field c2">
                  <Rotulo texto="Quantidade" obrigatorio />
                  <input
                    {...campoSemSugestao('q-v1')}
                    inputMode="numeric"
                    value={vagaForm.quantidade}
                    disabled={Boolean(vagaEditando)}
                    onChange={(event) => setVagaForm({ ...vagaForm, quantidade: event.target.value })}
                  />
                </div>
                <div className="field c4">
                  <Rotulo texto="Cargo" obrigatorio />
                  <input
                    {...campoSemSugestao('q-v2')}
                    value={vagaForm.cargo}
                    onChange={(event) => setVagaForm({ ...vagaForm, cargo: event.target.value })}
                  />
                </div>
                <div className="field c3">
                  <Rotulo texto="Idade de" obrigatorio />
                  <input
                    {...campoSemSugestao('q-v3')}
                    inputMode="numeric"
                    value={vagaForm.idade}
                    onChange={(event) => setVagaForm({ ...vagaForm, idade: event.target.value })}
                  />
                </div>
                <div className="field c3">
                  <Rotulo texto="Idade até" obrigatorio />
                  <input
                    {...campoSemSugestao('q-v4')}
                    inputMode="numeric"
                    value={vagaForm.idadeAte}
                    onChange={(event) => setVagaForm({ ...vagaForm, idadeAte: event.target.value })}
                  />
                </div>
                <div className="field c6">
                  <Rotulo texto="Atividades" obrigatorio />
                  <textarea
                    value={vagaForm.atividades}
                    onChange={(event) => setVagaForm({ ...vagaForm, atividades: event.target.value })}
                  />
                </div>
                <div className="field c6">
                  <Rotulo texto="Benefícios" />
                  <textarea
                    value={vagaForm.beneficios}
                    onChange={(event) => setVagaForm({ ...vagaForm, beneficios: event.target.value })}
                  />
                </div>
                {vagaForm.tipoVaga === '1' || vagaForm.tipoVaga === '2' ? (
                  <>
                    <div className="field c3">
                      <Rotulo texto="Salário" obrigatorio={vagaForm.tipoVaga === '1'} />
                      <input
                        {...campoSemSugestao('q-v5')}
                        inputMode="decimal"
                        value={vagaForm.bolsa}
                        onChange={(event) => setVagaForm({ ...vagaForm, bolsa: event.target.value })}
                      />
                    </div>
                    <div className="field c6">
                        <Rotulo texto="Formação" obrigatorio />
                        <select
                          value={vagaForm.escolaridade}
                          onChange={(event) => setVagaForm({ ...vagaForm, escolaridade: event.target.value })}
                        >
                          <option value="">Selecione</option>
                          <option value="0">Sem formação</option>
                          <option value="31">Ensino Médio</option>
                          <option value="32">Ensino Técnico</option>
                          <option value="33">Ensino Superior</option>
                          <option value="36">Ensino Supletivo</option>
                        </select>
                    </div>
                    <div className="field c3">
                      <Rotulo texto="Sexo" obrigatorio />
                      <select
                        value={vagaForm.sexo}
                        onChange={(event) => setVagaForm({ ...vagaForm, sexo: event.target.value })}
                      >
                        <option value="">Selecione</option>
                        <option value="I">Ambos</option>
                        <option value="M">Masculino</option>
                        <option value="F">Feminino</option>
                      </select>
                    </div>
                    <div className="field c4">
                      <Rotulo texto="Distância máxima (km)" />
                      <input
                        {...campoSemSugestao('q-v6')}
                        inputMode="decimal"
                        value={vagaForm.km}
                        onChange={(event) => setVagaForm({ ...vagaForm, km: event.target.value })}
                      />
                    </div>
                    <div className="field c5">
                      <Rotulo texto="Tempo até o local" />
                      <div className="ge-relogio">
                        <input
                          {...campoSemSugestao('q-v7')}
                          inputMode="numeric"
                          placeholder="Horas"
                          value={vagaForm.tempoHoras}
                          onChange={(event) => setVagaForm({ ...vagaForm, tempoHoras: event.target.value })}
                        />
                        <span>h</span>
                        <input
                          {...campoSemSugestao('q-v8')}
                          inputMode="numeric"
                          placeholder="Min"
                          value={vagaForm.tempoMinutos}
                          onChange={(event) => setVagaForm({ ...vagaForm, tempoMinutos: event.target.value })}
                        />
                        <span>min</span>
                      </div>
                    </div>
                  </>
                ) : null}
                <div className="field c4">
                  <Rotulo texto="Conduções" />
                  <input
                    {...campoSemSugestao('q-cond')}
                    value={vagaForm.conducoes}
                    onChange={(event) => setVagaForm({ ...vagaForm, conducoes: event.target.value })}
                  />
                </div>
                {vagaForm.tipoVaga === '4' ? (
                  <div className="field c4">
                    <Rotulo texto="Folgas fixas" />
                    <select
                      value={vagaForm.folgasFixas}
                      onChange={(event) => setVagaForm({ ...vagaForm, folgasFixas: event.target.value })}
                    >
                      <option value="">Selecione</option>
                      <option value="sim">Sim</option>
                      <option value="nao">Não</option>
                    </select>
                  </div>
                ) : null}
                {vagaForm.tipoVaga === '1' || vagaForm.tipoVaga === '2' ? (
                  <div className="ge-horario">
                    <div className="field c3">
                      <Rotulo texto="Carga horária" obrigatorio />
                      <select
                        value={vagaForm.cargaHoraria}
                        onChange={(event) => mudarHorario({ cargaHoraria: event.target.value })}
                      >
                        <option value="">Selecione</option>
                        {(vagaForm.tipoVaga === '2' ? ['44', '40'] : ['30', '20']).map((carga) => (
                          <option key={carga} value={carga}>
                            {carga}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="field c3">
                      <Rotulo texto="Turno" obrigatorio />
                      <select
                        value={vagaForm.periodo}
                        onChange={(event) => mudarHorario({ periodo: event.target.value })}
                      >
                        <option value="">Selecione</option>
                        {PERIODOS.map((periodo) => (
                          <option key={periodo.id} value={periodo.id}>
                            {periodo.nome}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="field c3">
                      <Rotulo texto="Jornada" obrigatorio />
                      <select
                        value={vagaForm.jornada}
                        onChange={(event) => setVagaForm({ ...vagaForm, jornada: event.target.value })}
                      >
                        <option value="">Selecione</option>
                        <option value="fixa">Fixa</option>
                        <option value="escala">Escala</option>
                      </select>
                    </div>
                    <div className="field c3">
                      <Rotulo texto="Tipo de trabalho" obrigatorio />
                      <select
                        value={vagaForm.tipoTrabalho}
                        onChange={(event) => setVagaForm({ ...vagaForm, tipoTrabalho: event.target.value })}
                      >
                        <option value="">Selecione</option>
                        <option value="presencial">Presencial</option>
                        <option value="remoto">Remoto</option>
                        <option value="hibrido">Híbrido</option>
                      </select>
                    </div>
                    <div className="field c3">
                      <Rotulo texto="Do dia" obrigatorio />
                      <select value={vagaForm.diaDe} onChange={(event) => mudarHorario({ diaDe: event.target.value })}>
                        <option value="">Selecione</option>
                        {DIAS_HORARIO.map((dia) => (
                          <option key={dia.numero} value={String(dia.numero)}>
                            {dia.nome}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="field c3">
                      <Rotulo texto="Até o dia" obrigatorio />
                      <select value={vagaForm.diaAte} onChange={(event) => mudarHorario({ diaAte: event.target.value })}>
                        <option value="">Selecione</option>
                        {DIAS_HORARIO.map((dia) => (
                          <option key={dia.numero} value={String(dia.numero)}>
                            {dia.nome}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="field c3">
                      <Rotulo texto="Entrada" obrigatorio />
                      <input
                        {...campoSemSugestao('q-entrada')}
                        inputMode="numeric"
                        placeholder="00:00"
                        value={vagaForm.entrada}
                        onChange={(event) => mudarHorario({ entrada: mascaraHora(event.target.value) })}
                      />
                    </div>
                    <div className="field c3">
                      <Rotulo texto="Intervalo" />
                      <div className="ge-relogio">
                        <input
                          {...campoSemSugestao('q-vi-h')}
                          inputMode="numeric"
                          placeholder="Horas"
                          value={vagaForm.intervaloHoras}
                          onChange={(event) => mudarHorario({ intervaloHoras: event.target.value })}
                        />
                        <span>h</span>
                        <input
                          {...campoSemSugestao('q-vi-m')}
                          inputMode="numeric"
                          placeholder="Min"
                          value={vagaForm.intervaloMinutos}
                          onChange={(event) => mudarHorario({ intervaloMinutos: event.target.value })}
                        />
                        <span>min</span>
                      </div>
                    </div>
                    {gradeHorario ? <p className="subtitle ge-horario-resumo">{gradeHorario.texto}</p> : null}
                    {diasVisiveis ? (
                      <div className="ge-dias">
                        {DIAS_HORARIO.map((dia) => (
                          <div className="ge-dia" key={dia.numero}>
                            <span>{dia.nome}</span>
                            <input
                              inputMode="numeric"
                              placeholder="Entrada"
                              aria-label={`Entrada de ${dia.nome}`}
                              value={diasVisiveis[dia.entrada]}
                              onChange={(event) =>
                                setDiasAjuste({
                                  ...diasVisiveis,
                                  [dia.entrada]: mascaraHora(event.target.value),
                                })
                              }
                            />
                            <input
                              inputMode="numeric"
                              placeholder="Saída"
                              aria-label={`Saída de ${dia.nome}`}
                              value={diasVisiveis[dia.saida]}
                              onChange={(event) =>
                                setDiasAjuste({ ...diasVisiveis, [dia.saida]: mascaraHora(event.target.value) })
                              }
                            />
                          </div>
                        ))}
                      </div>
                    ) : null}
                    {avisoHorario ? <p className="message error ge-horario-resumo">{avisoHorario}</p> : null}
                  </div>
                ) : null}
              </>
            ) : null}
          </>
        ) : modo === 'grupo' ? (
          <div className="field">
            <Rotulo texto="Nome" obrigatorio />
            <input
              {...campoSemSugestao('q-a')}
              value={form.nome}
              onChange={(event) => setForm({ ...form, nome: event.target.value })}
            />
          </div>
        ) : (
          <>
            <div className="field" ref={grupoRef}>
              <Rotulo texto="Grupo" obrigatorio />
              <div className="search-select">
                <input
                  {...campoSemSugestao('q-b')}
                  placeholder="Buscar pelo nome do grupo ou da empresa"
                  value={grupoSelecionado ? grupoSelecionado.nome : buscaGrupoCampo}
                  onFocus={(event) => {
                    soltarSugestao(event);
                    setGrupoAberto(true);
                    event.currentTarget.select();
                  }}
                  onChange={(event) => {
                    setBuscaGrupoCampo(event.target.value);
                    setForm({ ...form, grupoId: '' });
                    setGrupoAberto(true);
                  }}
                />
                {grupoAberto ? (
                  <div className="dropdown">
                    {gruposDoCampo.length === 0 ? (
                      <div className="dropdown-empty">Nenhum grupo encontrado.</div>
                    ) : (
                      gruposDoCampo.map((grupo) => {
                        const empresa = buscaGrupoCampo.trim() ? empresaDoGrupo(grupo, buscaGrupoCampo) : undefined;
                        return (
                          <button
                            key={grupo.id}
                            type="button"
                            className={`dropdown-item${grupo.id === form.grupoId ? ' selected' : ''}`}
                            onClick={() => {
                              setForm({ ...form, grupoId: grupo.id });
                              setBuscaGrupoCampo('');
                              setGrupoAberto(false);
                            }}
                          >
                            <span className="dropdown-title">{grupo.nome}</span>
                            {empresa ? (
                              <span className="dropdown-meta">
                                {empresa.nome_fantasia}
                                {empresa.razao_social !== empresa.nome_fantasia ? ` · ${empresa.razao_social}` : ''}
                              </span>
                            ) : null}
                          </button>
                        );
                      })
                    )}
                  </div>
                ) : null}
              </div>
            </div>
            <div className="field">
              <Rotulo texto="CNPJ" obrigatorio />
              <input
                {...campoSemSugestao('q-c')}
                inputMode="numeric"
                value={form.cnpj}
                onChange={(event) => setForm({ ...form, cnpj: cnpjMascarado(event.target.value) })}
              />
            </div>
            <div className="field">
              <Rotulo texto="Razão social" obrigatorio />
              <input
                {...campoSemSugestao('q-d')}
                value={form.razaoSocial}
                onChange={(event) => setForm({ ...form, razaoSocial: event.target.value })}
              />
            </div>
            <div className="field">
              <Rotulo texto="Nome fantasia" obrigatorio />
              <input
                {...campoSemSugestao('q-e')}
                value={form.nomeFantasia}
                onChange={(event) => setForm({ ...form, nomeFantasia: event.target.value })}
              />
            </div>
            <div className="field">
              <Rotulo texto="CEP" obrigatorio />
              <input
                {...campoSemSugestao('q-f')}
                inputMode="numeric"
                value={form.cep}
                onChange={(event) => void aoMudarCep(event.target.value)}
              />
            </div>
            <div className="field">
              <Rotulo texto="Endereço" obrigatorio />
              <input
                {...campoSemSugestao('q-g')}
                value={form.logradouro}
                onChange={(event) => setForm({ ...form, logradouro: event.target.value })}
              />
            </div>
            <div className="field">
              <Rotulo texto="Número" />
              <input
                {...campoSemSugestao('q-h')}
                value={form.numero}
                onChange={(event) => setForm({ ...form, numero: event.target.value })}
              />
            </div>
            <div className="field">
              <Rotulo texto="Complemento" />
              <input
                {...campoSemSugestao('q-i')}
                value={form.complemento}
                onChange={(event) => setForm({ ...form, complemento: event.target.value })}
              />
            </div>
          </>
        )}
        {aba === 'vaga' ? null : (
        <>
        <div className="field">
          <Rotulo texto="E-mail" obrigatorio={!form.telefone.trim()} />
          <input
            {...campoSemSugestao('q-j')}
            value={form.email}
            onChange={(event) => setForm({ ...form, email: event.target.value })}
          />
        </div>
        <div className="field">
          <Rotulo texto="Telefone" obrigatorio={!form.email.trim()} />
          <input
            {...campoSemSugestao('q-k')}
            value={form.telefone}
            onChange={(event) => setForm({ ...form, telefone: event.target.value })}
          />
        </div>
        </>
        )}
        {erro ? <div className="message error">{erro}</div> : null}
        {aviso ? <div className="message success">{aviso}</div> : null}
        <div className="ge-acoes">
          <button type="submit" className="submit-button" disabled={salvando || excluindo}>
            {salvando ? 'Salvando...' : vagaEditando || (aba !== 'vaga' && editando) ? 'Salvar alteração' : 'Cadastrar'}
          </button>
          {aba === 'vaga' && vagaEditando ? (
            <button type="button" className="ghost-button" onClick={cancelarVaga} disabled={salvando || excluindo}>
              Cancelar
            </button>
          ) : null}
          {aba !== 'vaga' && editando ? (
            <button type="button" className="ghost-button" onClick={limpar} disabled={excluindo}>
              Cancelar
            </button>
          ) : null}
          {aba !== 'vaga' && editando ? (
            <button type="button" className="ge-excluir" onClick={() => setConfirmar(true)} disabled={excluindo}>
              Excluir
            </button>
          ) : null}
        </div>
      </form>

      {carregando ? <p className="subtitle">Carregando...</p> : null}

      <div className="ge-listas">
        {aba === 'vaga' ? (
          <section>
            <h2>Vagas</h2>
            {erroVaga ? <p className="subtitle">{erroVaga}</p> : vagas.length === 0 ? (
              <p className="subtitle">Nenhuma vaga cadastrada por esta tela.</p>
            ) : (
              <ul className="ge-lista">
                {vagas.map((vaga) => (
                  <li key={vaga.id}>
                    <div>
                      <strong>{vaga.cargo}</strong>
                      <span>
                        {vaga.empresaNome} · {TIPO_VAGA[vaga.tipoVaga] || 'Vaga'}
                        {vaga.codigo ? ` · ${vaga.codigo}` : ''}
                      </span>
                    </div>
                    <div className="ge-acoes">
                      <button type="button" className="ghost-button" onClick={() => void editarVaga(vaga)} disabled={salvando}>
                        Editar
                      </button>
                      <button
                        type="button"
                        className="ge-excluir"
                        onClick={() => setVagaParaExcluir(vaga)}
                        disabled={excluindo}
                      >
                        Excluir
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ) : (
          <>
        <section>
          <h2>Grupos</h2>
          <input
            {...campoSemSugestao('q-l')}
            className="ge-busca"
            value={filtroGrupos}
            placeholder="Buscar por nome do grupo ou da empresa"
            onChange={(event) => setFiltroGrupos(event.target.value)}
          />
          {erro ? null : grupos.length === 0 ? (
            <p className="subtitle">Nenhum grupo cadastrado.</p>
          ) : gruposVisiveis.length === 0 ? (
            <p className="subtitle">Nenhum grupo encontrado.</p>
          ) : (
            <ul className="ge-lista">
              {gruposVisiveis.map((grupo) => (
                <li key={grupo.id}>
                  <div>
                    <strong>{grupo.nome}</strong>
                    <span>{contato(grupo.email, grupo.telefone)}</span>
                  </div>
                  <button type="button" className="ghost-button" onClick={() => editarGrupo(grupo)}>
                    Editar
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section>
          <h2>Empresas</h2>
          <input
            {...campoSemSugestao('q-m')}
            className="ge-busca"
            value={filtroEmpresas}
            placeholder="Buscar por razão social, nome fantasia ou grupo"
            onChange={(event) => setFiltroEmpresas(event.target.value)}
          />
          {erro ? null : empresas.length === 0 ? (
            <p className="subtitle">Nenhuma empresa cadastrada.</p>
          ) : empresasVisiveis.length === 0 ? (
            <p className="subtitle">Nenhuma empresa encontrada.</p>
          ) : (
            <ul className="ge-lista">
              {empresasVisiveis.map((empresa) => (
                <li key={empresa.id}>
                  <div>
                    <strong>{empresa.nome_fantasia}</strong>
                    <span>
                      {empresa.grupo_nome || 'Sem grupo'} · {cnpjMascarado(empresa.cnpj)} · {empresa.razao_social}
                    </span>
                    {linhaEndereco(empresa) ? <span>{linhaEndereco(empresa)}</span> : null}
                    <span>{contato(empresa.email, empresa.telefone)}</span>
                  </div>
                  <button type="button" className="ghost-button" onClick={() => editarEmpresa(empresa)}>
                    Editar
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
          </>
        )}
      </div>

      {vagaParaExcluir ? (
        <div className="ge-modal" role="dialog" aria-modal="true" aria-labelledby="ge-excluir-vaga">
          <div className="ge-modal-card">
            <h2 id="ge-excluir-vaga">Excluir {vagaParaExcluir.cargo}?</h2>
            <p>
              {vagaParaExcluir.codigo ? `A vaga ${vagaParaExcluir.codigo} sai ` : 'A vaga sai '}
              desta lista e do sistema antigo. Essa exclusão não pode ser desfeita.
            </p>
            <div className="ge-acoes">
              <button type="button" className="ge-excluir" onClick={() => void excluirVaga()} disabled={excluindo}>
                {excluindo ? 'Excluindo...' : 'Excluir'}
              </button>
              <button
                type="button"
                className="ghost-button"
                onClick={() => setVagaParaExcluir(null)}
                disabled={excluindo}
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {confirmar ? (
        <div className="ge-modal" role="dialog" aria-modal="true" aria-labelledby="ge-excluir-titulo">
          <div className="ge-modal-card">
            <h2 id="ge-excluir-titulo">Excluir {nomeExclusao}?</h2>
            <p>Essa exclusão não pode ser desfeita.</p>
            <div className="ge-acoes">
              <button type="button" className="ge-excluir" onClick={() => void excluir()} disabled={excluindo}>
                {excluindo ? 'Excluindo...' : 'Excluir'}
              </button>
              <button type="button" className="ghost-button" onClick={() => setConfirmar(false)} disabled={excluindo}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
