'use client';

import { useEffect, useMemo, useState } from 'react';
import type { JobOption } from '@/types/candidatura';
import { buscarCursos } from './curso-busca';
import type { AlunoCruzeiro, OpcoesAtivacao } from './types';

interface ListaResponse {
  total: number;
  page: number;
  pageSize: number;
  alunos: AlunoCruzeiro[];
}

function parseOptionalInt(value: string): number | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function formatCep(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 8);
  return digits.length > 5 ? `${digits.slice(0, 5)}-${digits.slice(5)}` : digits;
}

function faixaIdadeVaga(tipo?: string): { min: number; max: number } | null {
  const raw = (tipo || '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase();
  if (raw.includes('estagio')) return { min: 18, max: 22 };
  if (raw.includes('clt')) return { min: 20, max: 50 };
  return null;
}

function tipoContrato(tipo?: string): string {
  const raw = (tipo || '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase();
  if (raw.includes('estagio')) return 'Estágio';
  if (raw.includes('clt')) return 'CLT';
  return '';
}

function rotuloVaga(vaga: JobOption): string {
  return vaga.bairro ? `${vaga.title} — ${vaga.bairro}` : vaga.title;
}

export function AtivacaoCruzeiroDashboard() {
  const [idadeMin, setIdadeMin] = useState('');
  const [idadeMax, setIdadeMax] = useState('');
  const [cursos, setCursos] = useState<string[]>([]);
  const [cursoBusca, setCursoBusca] = useState('');
  const [cursoAberto, setCursoAberto] = useState(false);
  const [localPor, setLocalPor] = useState<'bairro' | 'cep'>('bairro');
  const [series, setSeries] = useState<string[]>([]);
  const [serieAberto, setSerieAberto] = useState(false);
  const [sexo, setSexo] = useState('');
  const [sexoAberto, setSexoAberto] = useState(false);
  const [cep, setCep] = useState('');
  const [bairro, setBairro] = useState('');
  const [raioKm, setRaioKm] = useState('');
  const [quantidade, setQuantidade] = useState('');
  const [vagaId, setVagaId] = useState('');
  const [vagaBusca, setVagaBusca] = useState('');
  const [vagaAberto, setVagaAberto] = useState(false);
  const [vagas, setVagas] = useState<JobOption[]>([]);
  const [page, setPage] = useState(1);
  const [opcoes, setOpcoes] = useState<OpcoesAtivacao>({ cursos: [], series: [], sexos: [] });
  const [data, setData] = useState<ListaResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [erroVaga, setErroVaga] = useState(false);
  const [erroRaio, setErroRaio] = useState(false);
  const [selecionados, setSelecionados] = useState<string[]>([]);
  const [idadeManual, setIdadeManual] = useState(false);
  const [cepManual, setCepManual] = useState(false);

  const vagaSelecionada = useMemo(
    () => vagas.find((vaga) => vaga.id === vagaId) || null,
    [vagaId, vagas]
  );

  const vagasFiltradas = useMemo(() => {
    const query = vagaBusca.trim().toLowerCase();
    if (!query) return vagas;
    const termos = query.split(/\s+/).filter(Boolean);
    return vagas.filter((vaga) => {
      const texto = `${vaga.title} ${tipoContrato(vaga.contractType)} ${vaga.bairro || ''} ${vaga.location}`.toLowerCase();
      return termos.every((termo) => texto.includes(termo));
    });
  }, [vagaBusca, vagas]);

  const cursosFiltrados = useMemo(
    () => buscarCursos(opcoes.cursos, cursoBusca),
    [cursoBusca, opcoes.cursos]
  );

  async function carregarOpcoes() {
    const [opcoesResponse, vagasResponse] = await Promise.all([
      fetch('/api/ativacao-cruzeiro/opcoes'),
      fetch('/api/vagas'),
    ]);
    const opcoesPayload = await opcoesResponse.json();
    if (!opcoesResponse.ok) throw new Error(opcoesPayload.error || 'Falha ao carregar cursos.');
    setOpcoes(opcoesPayload);

    const vagasPayload = await vagasResponse.json();
    if (!vagasResponse.ok || !vagasPayload.success) {
      throw new Error(vagasPayload.message || 'Falha ao carregar vagas.');
    }
    setVagas(vagasPayload.jobs || []);
  }

  async function aplicarVaga(vaga: JobOption) {
    setVagaId(vaga.id);
    setVagaBusca(rotuloVaga(vaga));
    setVagaAberto(false);
    setErroVaga(false);
    if (vaga.bairro) setBairro(vaga.bairro);

    if (!idadeManual) {
      const faixa = faixaIdadeVaga(vaga.contractType);
      if (faixa) {
        setIdadeMin(String(faixa.min));
        setIdadeMax(String(faixa.max));
      }
    }

    if (!cepManual) {
      setCep(vaga.cep ? formatCep(vaga.cep) : '');
    }
    if (vaga.lat != null && vaga.lng != null) {
      setRaioKm((atual) => atual || '10');
      if (!vagaId) setLocalPor('cep');
    }
  }

  function temOrigemVaga(): boolean {
    return vagaSelecionada?.lat != null && vagaSelecionada?.lng != null;
  }

  function cepIncompleto(): boolean {
    if (localPor !== 'cep') return false;
    const raio = parseOptionalInt(raioKm);
    if (temOrigemVaga() && !cepManual) return raio == null;
    const cepDigits = cep.replace(/\D/g, '');
    return cepDigits.length > 0 && (cepDigits.length !== 8 || raio == null);
  }

  function temFiltro(): boolean {
    const min = parseOptionalInt(idadeMin);
    const max = parseOptionalInt(idadeMax);
    const cepDigits = cep.replace(/\D/g, '');
    const raio = parseOptionalInt(raioKm);
    return Boolean(
      (min != null && max != null) ||
        cursos.length > 0 ||
        series.length > 0 ||
        sexo.trim() ||
        (localPor === 'bairro' && bairro.trim()) ||
        (localPor === 'cep' &&
          raio != null &&
          (temOrigemVaga() || cepDigits.length === 8))
    );
  }

  function podeFiltrar(): boolean {
    return temFiltro() && Boolean(vagaId) && !cepIncompleto();
  }

  function filtrosEnvio() {
    const min = parseOptionalInt(idadeMin);
    const max = parseOptionalInt(idadeMax);
    const cepDigits = cep.replace(/\D/g, '');
    const raio = parseOptionalInt(raioKm);
    return {
      idadeMin: min != null && max != null ? min : undefined,
      idadeMax: min != null && max != null ? max : undefined,
      curso: cursos,
      serie: series,
      sexo: sexo.trim() || undefined,
      bairro: localPor === 'bairro' && bairro.trim() ? bairro.trim() : undefined,
      cep:
        localPor === 'cep' && cepManual && cepDigits.length === 8 && raio != null
          ? cepDigits
          : undefined,
      lat:
        localPor === 'cep' && !cepManual && vagaSelecionada?.lat != null
          ? vagaSelecionada.lat
          : undefined,
      lng:
        localPor === 'cep' && !cepManual && vagaSelecionada?.lng != null
          ? vagaSelecionada.lng
          : undefined,
      raioKm: localPor === 'cep' && raio != null ? raio : undefined,
      vagaId,
    };
  }

  async function carregarAlunos(nextPage = 1) {
    if (!podeFiltrar()) {
      setData(null);
      setErrorMessage('');
      setStatusMessage('');
      return;
    }

    const params = new URLSearchParams();
    const filtros = filtrosEnvio();
    if (filtros.idadeMin != null && filtros.idadeMax != null) {
      params.set('idadeMin', String(filtros.idadeMin));
      params.set('idadeMax', String(filtros.idadeMax));
    }
    for (const item of filtros.curso) params.append('curso', item);
    for (const item of filtros.serie) params.append('serie', item);
    if (filtros.sexo) params.set('sexo', filtros.sexo);
    if (filtros.bairro) params.set('bairro', filtros.bairro);
    if (filtros.lat != null && filtros.lng != null && filtros.raioKm != null) {
      params.set('lat', String(filtros.lat));
      params.set('lng', String(filtros.lng));
      params.set('raioKm', String(filtros.raioKm));
    } else if (filtros.cep && filtros.raioKm != null) {
      params.set('cep', filtros.cep);
      params.set('raioKm', String(filtros.raioKm));
    }
    params.set('vagaId', filtros.vagaId);
    params.set('page', String(nextPage));
    params.set('pageSize', '50');

    setIsLoading(true);
    setErrorMessage('');
    try {
      const response = await fetch(`/api/ativacao-cruzeiro?${params.toString()}`);
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Falha ao filtrar alunos.');
      setData(payload);
      setPage(nextPage);
      if (nextPage === 1) {
        setSelecionados([]);
        setQuantidade('');
      }
    } catch (error) {
      setData(null);
      setErrorMessage(error instanceof Error ? error.message : 'Falha ao filtrar alunos.');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    carregarOpcoes().catch((error) => {
      setErrorMessage(error instanceof Error ? error.message : 'Falha ao carregar opções.');
    });
    fetch('/api/ativacao-cruzeiro/geo-sync')
      .then((response) => response.json())
      .then((payload) => {
        if (payload?.precisaSincronizar) {
          fetch('/api/ativacao-cruzeiro/geo-sync', { method: 'POST' }).catch(() => undefined);
        }
      })
      .catch(() => undefined);
  }, []);

  const first = data ? (data.page - 1) * data.pageSize : 0;
  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  function aplicarQuantidade(valor: string, alunos = data?.alunos || []) {
    const pedido = parseOptionalInt(valor);
    if (pedido == null) {
      setQuantidade('');
      setSelecionados([]);
      return;
    }
    const ids = alunos.slice(0, pedido).map((aluno) => aluno.pessoaId);
    setSelecionados(ids);
    setQuantidade(String(ids.length));
  }

  function alternarAluno(pessoaId: string) {
    const proximo = selecionados.includes(pessoaId)
      ? selecionados.filter((id) => id !== pessoaId)
      : [...selecionados, pessoaId];
    setSelecionados(proximo);
    setQuantidade(proximo.length ? String(proximo.length) : '');
  }

  return (
    <div className="ativacao-page">
      <form
        className="form"
        autoComplete="off"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          setStatusMessage('');
          const faltaVaga = !vagaId;
          const faltaRaio = cepIncompleto();
          setErroVaga(faltaVaga);
          setErroRaio(faltaRaio);
          if (faltaVaga || faltaRaio) return;
          if (!temFiltro()) {
            setErrorMessage('Escolha pelo menos um filtro.');
            return;
          }
          setErrorMessage('');
          carregarAlunos(1);
        }}
      >
        <div className="ativacao-filters">
          <div className="field">
            <label htmlFor="ativacao-vaga-busca">Vaga</label>
            <div className="search-select">
              <input
                id="ativacao-vaga-busca"
                name="ativacao-vaga-busca"
                type="text"
                placeholder="Buscar vaga"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="none"
                spellCheck={false}
                data-lpignore="true"
                data-1p-ignore="true"
                data-form-type="other"
                readOnly
                value={
                  vagaAberto || !vagaSelecionada ? vagaBusca : rotuloVaga(vagaSelecionada)
                }
                onFocus={(event) => {
                  event.currentTarget.readOnly = false;
                  setVagaAberto(true);
                  setVagaBusca(vagaSelecionada ? rotuloVaga(vagaSelecionada) : '');
                }}
                onChange={(event) => {
                  setVagaBusca(event.target.value);
                  setVagaId('');
                  setVagaAberto(true);
                  if (erroVaga) setErroVaga(false);
                }}
                onBlur={() => {
                  window.setTimeout(() => setVagaAberto(false), 150);
                }}
              />
              {vagaAberto && vagasFiltradas.length > 0 && (
                <ul className="dropdown">
                  {vagasFiltradas.map((vaga) => (
                    <li key={vaga.id}>
                      <button
                        type="button"
                        className={`dropdown-item${vaga.id === vagaId ? ' selected' : ''}`}
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => aplicarVaga(vaga)}
                      >
                        <span className="dropdown-title">
                          {vaga.bairro ? `${vaga.title} — ${vaga.bairro}` : vaga.title}
                        </span>
                        <span className="dropdown-meta">
                          {tipoContrato(vaga.contractType) || 'Tipo não informado'} • {vaga.location}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {erroVaga && <span className="ativacao-required-tip">Preencha este campo.</span>}
            </div>
            <p className="hint">Quem já recebeu esta vaga não aparece de novo.</p>
          </div>

          <div className="field">
            <label htmlFor="idade-min">Idade</label>
            <div className="ativacao-age">
              <input
                id="idade-min"
                type="number"
                min={1}
                max={120}
                inputMode="numeric"
                placeholder="De"
                value={idadeMin}
                onChange={(event) => {
                  setIdadeManual(true);
                  setIdadeMin(event.target.value);
                }}
              />
              <span>até</span>
              <input
                id="idade-max"
                type="number"
                min={1}
                max={120}
                inputMode="numeric"
                placeholder="Até"
                value={idadeMax}
                onChange={(event) => {
                  setIdadeManual(true);
                  setIdadeMax(event.target.value);
                }}
              />
            </div>
            <p className="hint">Os dois lados precisam estar preenchidos.</p>
          </div>

          <div className="field">
            <label htmlFor="curso">Curso</label>
            <div className="search-select">
              <input
                id="curso"
                type="text"
                placeholder="Buscar curso ou sigla (RH, ADM)"
                value={cursoAberto ? cursoBusca : cursos.join(', ')}
                onFocus={() => {
                  setCursoAberto(true);
                  setCursoBusca('');
                }}
                onChange={(event) => {
                  setCursoBusca(event.target.value);
                  setCursoAberto(true);
                }}
                onBlur={() => {
                  window.setTimeout(() => setCursoAberto(false), 150);
                }}
              />
              {cursoAberto && cursosFiltrados.length > 0 && (
                <ul className="dropdown" role="listbox" aria-multiselectable="true">
                  {cursosFiltrados.map((item) => {
                    const marcado = cursos.includes(item);
                    return (
                      <li key={item}>
                        <button
                          type="button"
                          className={`dropdown-item${marcado ? ' selected' : ''}`}
                          aria-selected={marcado}
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={() => {
                            setCursos((atual) =>
                              atual.includes(item)
                                ? atual.filter((valor) => valor !== item)
                                : [...atual, item]
                            );
                          }}
                        >
                          {marcado ? '✓ ' : ''}
                          {item}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
            <p className="hint">Pode marcar mais de um.</p>
          </div>

          <div className="field">
            <label htmlFor="serie">Semestre</label>
            <div className="ativacao-select">
              <button
                id="serie"
                type="button"
                className="ativacao-select-trigger"
                aria-haspopup="listbox"
                aria-expanded={serieAberto}
                onClick={() => setSerieAberto((open) => !open)}
                onBlur={() => window.setTimeout(() => setSerieAberto(false), 150)}
              >
                {series.length ? series.map((item) => `${item}º`).join(', ') : 'Todos'}
                <span aria-hidden>▾</span>
              </button>
              {serieAberto && (
                <ul className="dropdown" role="listbox" aria-multiselectable="true">
                  <li>
                    <button
                      type="button"
                      className={`dropdown-item${series.length === 0 ? ' selected' : ''}`}
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => setSeries([])}
                    >
                      Todos
                    </button>
                  </li>
                  {opcoes.series.map((item) => {
                    const marcado = series.includes(item);
                    return (
                      <li key={item}>
                        <button
                          type="button"
                          className={`dropdown-item${marcado ? ' selected' : ''}`}
                          aria-selected={marcado}
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={() => {
                            setSeries((atual) =>
                              atual.includes(item)
                                ? atual.filter((valor) => valor !== item)
                                : [...atual, item].sort((a, b) => Number(a) - Number(b))
                            );
                          }}
                        >
                          {marcado ? '✓ ' : ''}
                          {item}º
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
            <p className="hint">Pode marcar mais de um.</p>
          </div>

          <div className="field">
            <label htmlFor="sexo">Sexo</label>
            <div className="ativacao-select">
              <button
                id="sexo"
                type="button"
                className="ativacao-select-trigger"
                aria-haspopup="listbox"
                aria-expanded={sexoAberto}
                onClick={() => setSexoAberto((open) => !open)}
                onBlur={() => window.setTimeout(() => setSexoAberto(false), 150)}
              >
                {opcoes.sexos.find((item) => item.valor === sexo)?.label || 'Todos'}
                <span aria-hidden>▾</span>
              </button>
              {sexoAberto && (
                <ul className="dropdown" role="listbox">
                  <li>
                    <button
                      type="button"
                      className={`dropdown-item${sexo === '' ? ' selected' : ''}`}
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => {
                        setSexo('');
                        setSexoAberto(false);
                      }}
                    >
                      Todos
                    </button>
                  </li>
                  {opcoes.sexos.map((item) => (
                    <li key={item.valor}>
                      <button
                        type="button"
                        className={`dropdown-item${item.valor === sexo ? ' selected' : ''}`}
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => {
                          setSexo(item.valor);
                          setSexoAberto(false);
                        }}
                      >
                        {item.label}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <div className="field">
            <span className="filter-label">Local</span>
            <div className="filter-chips">
              <button
                type="button"
                className={`filter-chip${localPor === 'bairro' ? ' active' : ''}`}
                onClick={() => setLocalPor('bairro')}
              >
                Bairro
              </button>
              <button
                type="button"
                className={`filter-chip${localPor === 'cep' ? ' active' : ''}`}
                onClick={() => setLocalPor('cep')}
              >
                CEP
              </button>
            </div>
          </div>

          {localPor === 'bairro' ? (
            <div className="field">
              <label htmlFor="bairro">Bairro</label>
              <input
                id="bairro"
                type="text"
                placeholder="Tatuapé"
                value={bairro}
                onChange={(event) => setBairro(event.target.value)}
              />
            </div>
          ) : (
            <>
              <div className="field">
                <label htmlFor="cep">CEP</label>
                <input
                  id="cep"
                  type="text"
                  inputMode="numeric"
                  placeholder="Opcional"
                  value={cep}
                  onChange={(event) => {
                    const digits = event.target.value.replace(/\D/g, '').slice(0, 8);
                    setCepManual(digits.length > 0);
                    setCep(formatCep(digits));
                    if (!raioKm) setRaioKm('10');
                  }}
                />
                <p className="hint">
                  {temOrigemVaga()
                    ? 'O raio usa a latitude e a longitude da vaga. CEP só se você quiser outro ponto.'
                    : 'CEP só vale junto com o raio.'}
                </p>
              </div>
              <div className="field">
                <label htmlFor="raio">Raio (km)</label>
                <div className="search-select">
                  <input
                    id="raio"
                    type="number"
                    min={1}
                    max={80}
                    inputMode="numeric"
                    placeholder="10"
                    value={raioKm}
                    onChange={(event) => {
                      setRaioKm(event.target.value);
                      if (erroRaio) setErroRaio(false);
                    }}
                  />
                  {erroRaio && <span className="ativacao-required-tip">Preencha este campo.</span>}
                </div>
              </div>
            </>
          )}
        </div>

        <button type="submit" className="submit-button" disabled={isLoading}>
          {isLoading ? 'Filtrando…' : 'Filtrar'}
        </button>
      </form>

      {errorMessage && <div className="message error">{errorMessage}</div>}
      {statusMessage && <div className="message success">{statusMessage}</div>}

      {!errorMessage && !data && !isLoading && (
        <p className="subtitle">Escolha a vaga e pelo menos um filtro para ver os alunos.</p>
      )}

      {!errorMessage && data && (
        <>
          <div className="ativacao-resumo">
            <div className="origem-kpi">
              <span>Disponíveis nesta vaga</span>
              <strong>{data.total.toLocaleString('pt-BR')}</strong>
            </div>

            <div className="field">
              <label htmlFor="quantidade">Quantas pessoas</label>
              <input
                id="quantidade"
                type="number"
                min={1}
                max={40000}
                inputMode="numeric"
                placeholder="50"
                value={quantidade}
                onChange={(event) => aplicarQuantidade(event.target.value, data.alunos)}
              />
            </div>

            <button
              type="button"
              className="ativacao-page-btn"
              disabled={isLoading || data.total === 0}
              onClick={() => aplicarQuantidade(String(data.alunos.length), data.alunos)}
            >
              Selecionar todos
            </button>
          </div>

          {data.alunos.length === 0 ? (
            <p className="subtitle">Nenhum aluno com esses filtros.</p>
          ) : (
            <>
              <div className="ativacao-list">
                {data.alunos.map((aluno, index) => {
                  const selecionado = selecionados.includes(aluno.pessoaId);
                  return (
                    <button
                      key={aluno.pessoaId}
                      type="button"
                      className={`nearby-item${selecionado ? ' selected' : ''}`}
                      onClick={() => alternarAluno(aluno.pessoaId)}
                    >
                      <span className={`nearby-check${selecionado ? ' checked' : ''}`} aria-hidden>
                        {selecionado ? '✓' : ''}
                      </span>
                      <span className="nearby-item-body">
                        <strong>{aluno.nome}</strong>
                        <span className="nearby-meta">
                          {aluno.curso || 'Sem curso'}
                          {aluno.serie ? ` · ${aluno.serie}º semestre` : ''}
                          {aluno.idade != null ? ` · ${aluno.idade} anos` : ''}
                        </span>
                        <span className="nearby-meta">
                          {aluno.bairro || 'Sem bairro'}
                          {aluno.distanciaKm != null ? ` · ${aluno.distanciaKm.toLocaleString('pt-BR')} km` : ''}
                          {aluno.polo ? ` · ${aluno.polo}` : ''}
                        </span>
                      </span>
                      {aluno.celular && <span className="nearby-distance">{aluno.celular}</span>}
                    </button>
                  );
                })}
              </div>

              <div className="ativacao-pager">
                <span>
                  {(first + (data.alunos.length ? 1 : 0)).toLocaleString('pt-BR')}–
                  {(first + data.alunos.length).toLocaleString('pt-BR')} de{' '}
                  {data.total.toLocaleString('pt-BR')}
                  {selecionados.length
                    ? ` · ${selecionados.length.toLocaleString('pt-BR')} selecionados`
                    : ''}
                </span>
                <div>
                  <button
                    type="button"
                    className="ativacao-page-btn"
                    disabled={isLoading || page <= 1}
                    onClick={() => carregarAlunos(page - 1)}
                  >
                    Anterior
                  </button>
                  <button
                    type="button"
                    className="ativacao-page-btn"
                    disabled={isLoading || page >= totalPages}
                    onClick={() => carregarAlunos(page + 1)}
                  >
                    Próxima
                  </button>
                  {selecionados.length > 0 && (
                    <button type="button" className="ativacao-page-btn">
                      Ativar
                    </button>
                  )}
                </div>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
