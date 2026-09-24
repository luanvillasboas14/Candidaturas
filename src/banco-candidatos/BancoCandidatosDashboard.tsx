'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { STATUS_CANDIDATO, STATUS_LABEL, isStatusFiltro, type CandidatoLista, type FormacaoOpcao, type ModalidadeOpcao, type StatusFiltro } from './types';
import { cacheGet, cacheSet, storeGet, storeRemove, storeSet } from './cache';
import { brToIso, formatCep, hrefDetalhe, maskBrDate } from './ui';

const FILTROS_KEY = 'filtros';

type FiltrosLista = {
  nome: string;
  cadastroDe: string;
  cadastroAte: string;
  cargo: string;
  cep: string;
  raioKm: string;
  formacao: string;
  salarioMin: string;
  salarioMax: string;
  tipoContratacao: string;
  status: StatusFiltro;
  page: number;
};

function filtrosVazios(): FiltrosLista {
  return {
    nome: '',
    cadastroDe: '',
    cadastroAte: '',
    cargo: '',
    cep: '',
    raioKm: '',
    formacao: '',
    salarioMin: '',
    salarioMax: '',
    tipoContratacao: '',
    status: 'todos',
    page: 1,
  };
}

type ListaResponse = {
  total: number;
  page: number;
  pageSize: number;
  usouRaio?: boolean;
  candidatos: CandidatoLista[];
};

export function BancoCandidatosDashboard() {
  const [nome, setNome] = useState('');
  const [cadastroDe, setCadastroDe] = useState('');
  const [cadastroAte, setCadastroAte] = useState('');
  const [cargo, setCargo] = useState('');
  const [cep, setCep] = useState('');
  const [raioKm, setRaioKm] = useState('');
  const [formacao, setFormacao] = useState('');
  const [salarioMin, setSalarioMin] = useState('');
  const [salarioMax, setSalarioMax] = useState('');
  const [tipoContratacao, setTipoContratacao] = useState('');
  const [status, setStatus] = useState<StatusFiltro>('todos');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<ListaResponse | null>(null);
  const [formacoes, setFormacoes] = useState<FormacaoOpcao[]>([]);
  const [modalidades, setModalidades] = useState<ModalidadeOpcao[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  function filtrosAtuais(): FiltrosLista {
    return {
      nome,
      cadastroDe,
      cadastroAte,
      cargo,
      cep,
      raioKm,
      formacao,
      salarioMin,
      salarioMax,
      tipoContratacao,
      status,
      page,
    };
  }

  function hidratarFiltros(f: FiltrosLista) {
    setNome(f.nome);
    setCadastroDe(f.cadastroDe);
    setCadastroAte(f.cadastroAte);
    setCargo(f.cargo);
    setCep(f.cep);
    setRaioKm(f.raioKm);
    setFormacao(f.formacao);
    setSalarioMin(f.salarioMin);
    setSalarioMax(f.salarioMax);
    setTipoContratacao(f.tipoContratacao);
    setStatus(isStatusFiltro(f.status) ? f.status : 'todos');
    setPage(f.page || 1);
  }

  useEffect(() => {
    const opcoes = cacheGet<{ formacoes: FormacaoOpcao[]; modalidades: ModalidadeOpcao[] }>('opcoes');
    if (opcoes) {
      setFormacoes(opcoes.formacoes || []);
      setModalidades(opcoes.modalidades || []);
    } else {
      void fetch('/api/banco-candidatos/opcoes')
        .then((res) => res.json())
        .then((json) => {
          setFormacoes(json.formacoes || []);
          setModalidades(json.modalidades || []);
          cacheSet('opcoes', json);
        })
        .catch(() => undefined);
    }
    const salvos = storeGet<FiltrosLista>(FILTROS_KEY);
    const filtros = salvos ? { ...filtrosVazios(), ...salvos } : filtrosVazios();
    if (!isStatusFiltro(filtros.status)) filtros.status = 'todos';
    hidratarFiltros(filtros);
    void buscar(filtros.page || 1, false, filtros);
  }, []);

  function montarParams(filtros: FiltrosLista, proxima: number): string {
    const params = new URLSearchParams();
    if (filtros.nome.trim().length >= 3) params.set('nome', filtros.nome.trim());
    const de = brToIso(filtros.cadastroDe);
    const ate = brToIso(filtros.cadastroAte);
    if (de) params.set('cadastroDe', de);
    if (ate) params.set('cadastroAte', ate);
    if (filtros.cargo.trim()) params.set('cargo', filtros.cargo.trim());
    if (filtros.cep.replace(/\D/g, '').length === 8 && filtros.raioKm) {
      params.set('cep', filtros.cep);
      params.set('raioKm', filtros.raioKm);
    }
    if (filtros.formacao) params.set('formacao', filtros.formacao);
    if (filtros.salarioMin) params.set('salarioMin', filtros.salarioMin);
    if (filtros.salarioMax) params.set('salarioMax', filtros.salarioMax);
    if (filtros.tipoContratacao) params.set('tipoContratacao', filtros.tipoContratacao);
    if (filtros.status && filtros.status !== 'todos') params.set('status', filtros.status);
    params.set('page', String(proxima));
    params.set('pageSize', '50');
    return params.toString();
  }

  async function buscar(proxima = 1, forcar = false, filtros?: FiltrosLista) {
    const usados = filtros ?? filtrosAtuais();
    setErrorMessage('');
    setPage(proxima);
    storeSet(FILTROS_KEY, { ...usados, page: proxima });
    const query = montarParams(usados, proxima);
    const cacheKey = `lista:${query}`;
    if (!forcar) {
      const cached = cacheGet<ListaResponse>(cacheKey);
      if (cached) {
        setData(cached);
        setIsLoading(false);
        return;
      }
    }
    setIsLoading(true);
    try {
      const res = await fetch(`/api/banco-candidatos?${query}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Falha ao listar.');
      setData(json);
      cacheSet(cacheKey, json);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Falha ao listar.');
    } finally {
      setIsLoading(false);
    }
  }

  function limparFiltros() {
    const vazios = filtrosVazios();
    hidratarFiltros(vazios);
    storeRemove(FILTROS_KEY);
    void buscar(1, true, vazios);
  }

  const temFiltro = Boolean(
    nome.trim() ||
      cadastroDe ||
      cadastroAte ||
      cargo.trim() ||
      formacao ||
      tipoContratacao ||
      status !== 'todos' ||
      cep.replace(/\D/g, '') ||
      raioKm ||
      salarioMin ||
      salarioMax
  );

  return (
    <div className="banco-dashboard">
      <div className="ativacao-filters">
        <label>
          Nome
          <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="mín. 3 letras" />
        </label>
        <label>
          Cadastro de
          <input
            value={cadastroDe}
            onChange={(e) => setCadastroDe(maskBrDate(e.target.value))}
            placeholder="dd/mm/aaaa"
          />
        </label>
        <label>
          Cadastro até
          <input
            value={cadastroAte}
            onChange={(e) => setCadastroAte(maskBrDate(e.target.value))}
            placeholder="dd/mm/aaaa"
          />
        </label>
        <label>
          Cargo
          <input value={cargo} onChange={(e) => setCargo(e.target.value)} />
        </label>
        <label>
          Formação
          <select value={formacao} onChange={(e) => setFormacao(e.target.value)}>
            <option value="">Todas</option>
            {formacoes.map((item) => (
              <option key={item.id} value={item.id}>
                {item.valor}
              </option>
            ))}
          </select>
        </label>
        <label>
          Contratação
          <select value={tipoContratacao} onChange={(e) => setTipoContratacao(e.target.value)}>
            <option value="">Todas</option>
            {modalidades.map((item) => (
              <option key={item.id} value={item.id}>
                {item.descricao}
              </option>
            ))}
          </select>
        </label>
        <label>
          Status
          <select value={status} onChange={(e) => setStatus(e.target.value as StatusFiltro)}>
            <option value="todos">Todos</option>
            {STATUS_CANDIDATO.map((item) => (
              <option key={item} value={item}>
                {STATUS_LABEL[item]}
              </option>
            ))}
          </select>
        </label>
        <label>
          CEP
          <input value={cep} onChange={(e) => setCep(formatCep(e.target.value))} placeholder="00000-000" />
        </label>
        <label>
          Raio (km)
          <input value={raioKm} onChange={(e) => setRaioKm(e.target.value.replace(/\D/g, ''))} />
        </label>
        <label>
          Salário de
          <input value={salarioMin} onChange={(e) => setSalarioMin(e.target.value.replace(/[^\d.]/g, ''))} />
        </label>
        <label>
          Salário até
          <input value={salarioMax} onChange={(e) => setSalarioMax(e.target.value.replace(/[^\d.]/g, ''))} />
        </label>
      </div>

      <div className="ativacao-resumo">
        <div className="banco-filtro-acoes">
          <button type="button" className="ativacao-page-btn" onClick={() => void buscar(1, true)} disabled={isLoading}>
            {isLoading ? 'Buscando…' : 'Buscar'}
          </button>
          <button type="button" className="ativacao-page-btn" onClick={limparFiltros} disabled={isLoading || !temFiltro}>
            Limpar filtros
          </button>
        </div>
        {data ? (
          <span>
            Mostrando {data.total === 0 ? 0 : (data.page - 1) * data.pageSize + 1}–
            {Math.min(data.page * data.pageSize, data.total)} de {data.total}
          </span>
        ) : null}
      </div>

      {errorMessage ? <p className="error">{errorMessage}</p> : null}

      {data ? (
        <>
          <ul className="ativacao-list banco-list">
            {data.candidatos.map((item) => (
              <li key={item.idCandidato}>
                <strong>{item.nome}</strong>
                <span>
                  Encaminhado: {item.encaminhado ? 'sim' : 'não'}
                  {item.status ? ` · ${STATUS_LABEL[item.status]}` : ''}
                  {item.idade != null ? ` · ${item.idade} anos` : ''}
                </span>
                <em>
                  {[item.terminoEstudo, item.tipoEnsino, item.instituicao, item.curso]
                    .filter(Boolean)
                    .join(' · ')}
                </em>
                <em>
                  {[item.bairro, item.cidade, item.estado, item.dataCadastro]
                    .filter(Boolean)
                    .join(' · ')}
                  {data.usouRaio && item.distanciaKm != null ? ` · ${item.distanciaKm} km` : ''}
                </em>
                <Link className="banco-list-link" href={hrefDetalhe(item.idCandidato, item.idVaga)}>
                  Ver Detalhes
                </Link>
              </li>
            ))}
          </ul>
          <div className="ativacao-pager">
            <button
              type="button"
              className="ativacao-page-btn"
              disabled={page <= 1 || isLoading}
              onClick={() => void buscar(page - 1)}
            >
              Anterior
            </button>
            <div>
              Página {data.page} de {Math.max(1, Math.ceil(data.total / data.pageSize))}
            </div>
            <button
              type="button"
              className="ativacao-page-btn"
              disabled={page * data.pageSize >= data.total || isLoading}
              onClick={() => void buscar(page + 1)}
            >
              Próxima
            </button>
          </div>
        </>
      ) : (
        <p className="subtitle">{isLoading ? 'Carregando candidatos…' : 'Nenhum candidato encontrado.'}</p>
      )}
    </div>
  );
}
