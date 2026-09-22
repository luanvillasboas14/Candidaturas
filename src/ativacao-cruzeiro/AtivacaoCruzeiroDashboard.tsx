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

export function AtivacaoCruzeiroDashboard() {
  const [idadeMin, setIdadeMin] = useState('');
  const [idadeMax, setIdadeMax] = useState('');
  const [curso, setCurso] = useState('');
  const [cursoBusca, setCursoBusca] = useState('');
  const [cursoAberto, setCursoAberto] = useState(false);
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

  const vagaSelecionada = useMemo(
    () => vagas.find((vaga) => vaga.id === vagaId) || null,
    [vagaId, vagas]
  );

  const vagasFiltradas = useMemo(() => {
    const query = vagaBusca.trim().toLowerCase();
    if (!query) return vagas;
    const termos = query.split(/\s+/).filter(Boolean);
    return vagas.filter((vaga) => {
      const texto = `${vaga.title} ${vaga.company} ${vaga.location}`.toLowerCase();
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

  function cepIncompleto(): boolean {
    const cepDigits = cep.replace(/\D/g, '');
    return cepDigits.length > 0 && (cepDigits.length !== 8 || parseOptionalInt(raioKm) == null);
  }

  function temFiltro(): boolean {
    const min = parseOptionalInt(idadeMin);
    const max = parseOptionalInt(idadeMax);
    const cepDigits = cep.replace(/\D/g, '');
    const raio = parseOptionalInt(raioKm);
    return Boolean(
      (min != null && max != null) ||
        curso.trim() ||
        series.length > 0 ||
        sexo.trim() ||
        bairro.trim() ||
        (cepDigits.length === 8 && raio != null)
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
      curso: curso.trim() || undefined,
      serie: series,
      sexo: sexo.trim() || undefined,
      bairro: bairro.trim() || undefined,
      cep: cepDigits.length === 8 && raio != null ? cepDigits : undefined,
      raioKm: cepDigits.length === 8 && raio != null ? raio : undefined,
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
    if (filtros.curso) params.set('curso', filtros.curso);
    for (const item of filtros.serie) params.append('serie', item);
    if (filtros.sexo) params.set('sexo', filtros.sexo);
    if (filtros.bairro) params.set('bairro', filtros.bairro);
    if (filtros.cep && filtros.raioKm != null) {
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

  const qtdSelecionada = parseOptionalInt(quantidade);
  const first = data ? (data.page - 1) * data.pageSize : 0;
  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

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
                onChange={(event) => setIdadeMin(event.target.value)}
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
                onChange={(event) => setIdadeMax(event.target.value)}
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
                value={cursoAberto || !curso ? cursoBusca : curso}
                onFocus={() => {
                  setCursoAberto(true);
                  setCursoBusca(curso);
                }}
                onChange={(event) => {
                  setCursoBusca(event.target.value);
                  setCurso('');
                  setCursoAberto(true);
                }}
                onBlur={() => {
                  window.setTimeout(() => setCursoAberto(false), 150);
                }}
              />
              {cursoAberto && cursosFiltrados.length > 0 && (
                <ul className="dropdown">
                  {cursosFiltrados.map((item) => (
                    <li key={item}>
                      <button
                        type="button"
                        className={`dropdown-item${item === curso ? ' selected' : ''}`}
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => {
                          setCurso(item);
                          setCursoBusca(item);
                          setCursoAberto(false);
                        }}
                      >
                        {item}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
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
            <label htmlFor="bairro">Bairro</label>
            <input
              id="bairro"
              type="text"
              placeholder="Tatuapé"
              value={bairro}
              onChange={(event) => setBairro(event.target.value)}
            />
          </div>

          <div className="field">
            <label htmlFor="cep">CEP</label>
            <input
              id="cep"
              type="text"
              inputMode="numeric"
              placeholder="01310-100"
              value={cep}
              onChange={(event) => {
                const digits = event.target.value.replace(/\D/g, '').slice(0, 8);
                setCep(digits.length > 5 ? `${digits.slice(0, 5)}-${digits.slice(5)}` : digits);
                if (!digits) {
                  setRaioKm('');
                  setErroRaio(false);
                }
              }}
            />
            <p className="hint">CEP só vale junto com o raio.</p>
          </div>

          {cep.replace(/\D/g, '').length > 0 && (
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
          )}

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
                value={vagaAberto || !vagaSelecionada ? vagaBusca : vagaSelecionada.title}
                onFocus={(event) => {
                  event.currentTarget.readOnly = false;
                  setVagaAberto(true);
                  setVagaBusca(vagaSelecionada?.title || '');
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
                        onClick={() => {
                          setVagaId(vaga.id);
                          setVagaBusca(vaga.title);
                          setVagaAberto(false);
                          setErroVaga(false);
                        }}
                      >
                        <span className="dropdown-title">{vaga.title}</span>
                        <span className="dropdown-meta">
                          {vaga.company} • {vaga.location}
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
                onChange={(event) => setQuantidade(event.target.value)}
              />
            </div>

            <button
              type="button"
              className="ativacao-page-btn"
              disabled={isLoading || data.total === 0}
              onClick={() => setQuantidade(String(data.total))}
            >
              Selecionar todos
            </button>
          </div>

          {data.alunos.length === 0 ? (
            <p className="subtitle">Nenhum aluno com esses filtros.</p>
          ) : (
            <>
              <ul className="ativacao-list">
                {data.alunos.map((aluno, index) => {
                  const selecionado =
                    qtdSelecionada != null && first + index < qtdSelecionada;
                  return (
                    <li key={aluno.pessoaId} className={selecionado ? 'selected' : undefined}>
                      <div>
                        <strong>{aluno.nome}</strong>
                        <span>
                          {aluno.curso || 'Sem curso'}
                          {aluno.serie ? ` · ${aluno.serie}º semestre` : ''}
                          {aluno.idade != null ? ` · ${aluno.idade} anos` : ''}
                        </span>
                        <em>
                          {aluno.bairro || 'Sem bairro'}
                          {aluno.distanciaKm != null ? ` · ${aluno.distanciaKm.toLocaleString('pt-BR')} km` : ''}
                          {aluno.polo ? ` · ${aluno.polo}` : ''}
                        </em>
                      </div>
                      {aluno.celular && <em>{aluno.celular}</em>}
                    </li>
                  );
                })}
              </ul>

              <div className="ativacao-pager">
                <span>
                  {(first + (data.alunos.length ? 1 : 0)).toLocaleString('pt-BR')}–
                  {(first + data.alunos.length).toLocaleString('pt-BR')} de{' '}
                  {data.total.toLocaleString('pt-BR')}
                  {qtdSelecionada != null
                    ? ` · ${Math.min(qtdSelecionada, data.total).toLocaleString('pt-BR')} selecionados`
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
                  {qtdSelecionada != null && (
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
