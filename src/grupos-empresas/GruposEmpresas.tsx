'use client';

import { FocusEvent, FormEvent, useEffect, useRef, useState } from 'react';
import type { Empresa, Grupo } from './validar';
import { cepMascarado, cnpjMascarado, digitosCep, digitosCnpj } from './validar';

type Modo = 'grupo' | 'empresa';

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
  const [modo, setModo] = useState<Modo>('grupo');
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
  const [erro, setErro] = useState('');
  const [aviso, setAviso] = useState('');
  const [buscaGrupoCampo, setBuscaGrupoCampo] = useState('');
  const [grupoAberto, setGrupoAberto] = useState(false);
  const [filtroGrupos, setFiltroGrupos] = useState('');
  const [filtroEmpresas, setFiltroEmpresas] = useState('');

  const grupoSelecionado = grupos.find((grupo) => grupo.id === form.grupoId) || null;

  async function carregar() {
    setCarregando(true);
    setErro('');
    try {
      const [resGrupos, resEmpresas] = await Promise.all([fetch('/api/grupos'), fetch('/api/empresas')]);
      const jsonGrupos = await resGrupos.json();
      const jsonEmpresas = await resEmpresas.json();
      if (!resGrupos.ok || !jsonGrupos.success) {
        throw new Error(jsonGrupos.message || 'Não foi possível listar os grupos.');
      }
      if (!resEmpresas.ok || !jsonEmpresas.success) {
        throw new Error(jsonEmpresas.message || 'Não foi possível listar as empresas.');
      }
      setGrupos(jsonGrupos.grupos);
      setEmpresas(jsonEmpresas.empresas);
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
    }
    document.addEventListener('mousedown', fechar);
    return () => document.removeEventListener('mousedown', fechar);
  }, []);

  function limpar() {
    setEditando(null);
    setForm(VAZIO);
    setBuscaGrupoCampo('');
    setGrupoAberto(false);
    setConfirmar(false);
    setAviso('');
    setErro('');
  }

  function escolher(proximo: Modo) {
    if (proximo === modo) return;
    setModo(proximo);
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
        <button type="button" className={modo === 'grupo' ? 'ativo' : ''} onClick={() => escolher('grupo')}>
          Grupo
        </button>
        <button type="button" className={modo === 'empresa' ? 'ativo' : ''} onClick={() => escolher('empresa')}>
          Empresa
        </button>
      </div>

      <form className="form" autoComplete="off" onSubmit={(event) => void salvar(event)}>
        {modo === 'grupo' ? (
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
        {erro ? <div className="message error">{erro}</div> : null}
        {aviso ? <div className="message success">{aviso}</div> : null}
        <div className="ge-acoes">
          <button type="submit" className="submit-button" disabled={salvando || excluindo}>
            {salvando ? 'Salvando...' : editando ? 'Salvar alteração' : 'Cadastrar'}
          </button>
          {editando ? (
            <button type="button" className="ghost-button" onClick={limpar} disabled={excluindo}>
              Cancelar
            </button>
          ) : null}
          {editando ? (
            <button type="button" className="ge-excluir" onClick={() => setConfirmar(true)} disabled={excluindo}>
              Excluir
            </button>
          ) : null}
        </div>
      </form>

      {carregando ? <p className="subtitle">Carregando...</p> : null}

      <div className="ge-listas">
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
      </div>

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
