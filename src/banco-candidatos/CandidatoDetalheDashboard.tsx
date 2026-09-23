'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AVALIACOES_DESEMPENHO, MOTIVOS_DEMISSAO, STATUS_LABEL, type CandidatoDetalhe } from './types';
import { cacheClearLista, cacheGet, cacheSet } from './cache';
import { brToIso, maskBrDate } from './ui';

function Campo({ label, valor }: { label: string; valor?: string | null }) {
  const texto = valor?.toString().trim();
  if (!texto) return null;
  return (
    <p>
      <strong>{label}</strong>
      {texto}
    </p>
  );
}

export function CandidatoDetalheDashboard({
  idCandidato,
  idVaga,
}: {
  idCandidato: string;
  idVaga?: string;
}) {
  const [detalhe, setDetalhe] = useState<CandidatoDetalhe | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [motivo, setMotivo] = useState('');
  const [dataDemissao, setDataDemissao] = useState('');
  const [motivoInterno, setMotivoInterno] = useState('');
  const [avaliacao, setAvaliacao] = useState('');
  const [resumoAtividades, setResumoAtividades] = useState('');
  const [previu, setPreviu] = useState(false);
  const [carregandoPrevia, setCarregandoPrevia] = useState(false);
  const [demitindo, setDemitindo] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');

  useEffect(() => {
    const cacheKey = `detalhe:${idCandidato}:${idVaga || ''}`;
    const cached = cacheGet<CandidatoDetalhe>(cacheKey);
    if (cached) {
      setDetalhe(cached);
      setResumoAtividades((atual) => atual || cached.atribuicoes || '');
    }
    const qs = idVaga ? `?vagaId=${encodeURIComponent(idVaga)}` : '';
    void fetch(`/api/banco-candidatos/${encodeURIComponent(idCandidato)}${qs}`)
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Falha ao abrir o candidato.');
        setDetalhe(json);
        cacheSet(cacheKey, json);
        setResumoAtividades((atual) => atual || json.atribuicoes || '');
      })
      .catch((error) => {
        if (cached) return;
        setErrorMessage(error instanceof Error ? error.message : 'Falha ao abrir o candidato.');
      });
  }, [idCandidato, idVaga]);

  const formValido = Boolean(motivo) && Boolean(brToIso(dataDemissao)) && Boolean(avaliacao) && Boolean(resumoAtividades.trim());

  function urlPrevia() {
    if (!detalhe?.idVaga) return '';
    const qs = new URLSearchParams({
      id: detalhe.idCandidato,
      vaga: detalhe.idVaga,
      motivo,
      data: brToIso(dataDemissao),
      avaliacao,
      resumo: resumoAtividades.trim(),
    });
    return `/banco-candidatos/previa?${qs.toString()}`;
  }

  function abrirPrevia() {
    const url = urlPrevia();
    if (url) window.open(url, '_blank', 'noopener,noreferrer');
  }

  async function gerarPrevia() {
    if (!detalhe?.idVaga || !formValido) return;
    setCarregandoPrevia(true);
    setStatusMessage('');
    setPreviu(false);
    abrirPrevia();
    try {
      const res = await fetch('/api/banco-candidatos/previa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          idCandidato: detalhe.idCandidato,
          idVaga: detalhe.idVaga,
          motivo,
          dataDemissao: brToIso(dataDemissao),
          avaliacao,
          resumoAtividades: resumoAtividades.trim(),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Falha ao montar a prévia.');
      setPreviu(true);
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : 'Falha ao montar a prévia.');
    } finally {
      setCarregandoPrevia(false);
    }
  }

  async function demitir() {
    if (!detalhe?.idVaga || !previu) return;
    setDemitindo(true);
    setStatusMessage('');
    try {
      const res = await fetch('/api/banco-candidatos/demitir', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          idCandidato: detalhe.idCandidato,
          idVaga: detalhe.idVaga,
          motivo,
          dataDemissao: brToIso(dataDemissao),
          motivoInterno,
          avaliacao,
          resumoAtividades: resumoAtividades.trim(),
          previu: true,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Falha ao demitir.');
      setStatusMessage('Demissão gravada. O documento único foi gerado.');
      const atualizado = { ...detalhe, jaDemitido: true, contratado: false };
      setDetalhe(atualizado);
      cacheSet(`detalhe:${detalhe.idCandidato}:${detalhe.idVaga || ''}`, atualizado);
      cacheClearLista();
      if (json.idContrato) {
        window.open(`/banco-candidatos/documento/${json.idContrato}`, '_blank');
      }
      const reload = await fetch(`/api/banco-candidatos/${encodeURIComponent(detalhe.idCandidato)}?vagaId=${encodeURIComponent(detalhe.idVaga)}`);
      if (reload.ok) setDetalhe(await reload.json());
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : 'Falha ao demitir.');
    } finally {
      setDemitindo(false);
    }
  }

  if (errorMessage) {
    return (
      <div className="banco-detalhe">
        <p className="error">{errorMessage}</p>
        <Link href="/banco-candidatos" className="banco-voltar">
          ← Voltar à lista
        </Link>
      </div>
    );
  }

  if (!detalhe) {
    return <p className="subtitle">Carregando candidato…</p>;
  }

  const podeDemitir =
    detalhe.contratado && detalhe.tipoVaga === 1 && !detalhe.jaDemitido && formValido && previu;

  return (
    <div className="banco-detalhe">
      <Link href="/banco-candidatos" className="banco-voltar">
        ← Voltar à lista
      </Link>
      <h2>{detalhe.nome}</h2>
      <div className="banco-detalhe-grid">
        <Campo label="Idade" valor={detalhe.idade != null ? `${detalhe.idade} anos` : null} />
        <Campo label="CPF" valor={detalhe.cpf} />
        <Campo label="E-mail" valor={detalhe.email} />
        <Campo label="Celular" valor={detalhe.celular} />
        <Campo label="Telefone" valor={detalhe.telefone} />
        <Campo label="Status" valor={detalhe.status ? STATUS_LABEL[detalhe.status] : null} />
        <Campo label="Tipo de ensino" valor={detalhe.tipoEnsino} />
        <Campo label="Curso" valor={detalhe.curso} />
        <Campo label="Término de estudo" valor={detalhe.terminoEstudo} />
        <Campo label="Instituição" valor={detalhe.instituicao} />
        <Campo label="Bairro" valor={detalhe.bairro} />
        <Campo label="Cidade / UF" valor={[detalhe.cidade, detalhe.estado].filter(Boolean).join(' / ')} />
        <Campo label="Cadastro" valor={detalhe.dataCadastro} />
      </div>

      {detalhe.contratado ? (
        <p>
          Contratado em {detalhe.cargoVaga || 'vaga'} · {detalhe.empresa} · {detalhe.dataInicio} a{' '}
          {detalhe.dataFim}
        </p>
      ) : (
        <p>Sem contratação ativa.</p>
      )}
      {!detalhe.contratado && (detalhe.encaminhamentoCargo || detalhe.encaminhamentoEmpresa) ? (
        <p>
          Encaminhado para entrevista
          {detalhe.encaminhamentoCargo ? ` · ${detalhe.encaminhamentoCargo}` : ''}
          {detalhe.encaminhamentoEmpresa ? ` · ${detalhe.encaminhamentoEmpresa}` : ''}
        </p>
      ) : null}

      {detalhe.contratado && detalhe.tipoVaga === 1 && !detalhe.jaDemitido ? (
        <div className="banco-demitir">
          <h3>Demitir</h3>
          <label>
            Motivo da Demissão (Em Contrato)
            <select
              value={motivo}
              onChange={(e) => {
                setMotivo(e.target.value);
                setPreviu(false);
              }}
            >
              <option value="">Selecione</option>
              {MOTIVOS_DEMISSAO.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
          <label>
            Data de Demissão
            <input
              value={dataDemissao}
              onChange={(e) => {
                setDataDemissao(maskBrDate(e.target.value));
                setPreviu(false);
              }}
              placeholder="dd/mm/aaaa"
            />
          </label>
          <label>
            Avaliação de desempenho
            <div className="banco-avaliacao" role="group">
              {AVALIACOES_DESEMPENHO.map((item) => (
                <button
                  key={item}
                  type="button"
                  className={avaliacao === item ? 'selected' : ''}
                  onClick={() => {
                    setAvaliacao(item);
                    setPreviu(false);
                  }}
                >
                  {item}
                </button>
              ))}
            </div>
          </label>
          <label>
            Resumo das atividades
            <textarea
              value={resumoAtividades}
              onChange={(e) => {
                setResumoAtividades(e.target.value);
                setPreviu(false);
              }}
              rows={4}
            />
          </label>
          <label>
            Motivo interno
            <textarea value={motivoInterno} onChange={(e) => setMotivoInterno(e.target.value)} rows={3} />
          </label>
          <button type="button" className="ativacao-page-btn" disabled={!formValido || carregandoPrevia} onClick={() => void gerarPrevia()}>
            {carregandoPrevia ? 'Montando prévia…' : 'Gerar prévia'}
          </button>
          {previu ? (
            <p>
              Prévia gerada.{' '}
              <button type="button" className="banco-list-link" onClick={abrirPrevia}>
                Abrir prévia em página inteira
              </button>
            </p>
          ) : null}
          <button type="button" className="banco-voltar" disabled={!podeDemitir || demitindo} onClick={() => void demitir()}>
            {demitindo ? 'Gerando…' : 'Gerar rescisão e demitir'}
          </button>
        </div>
      ) : null}
      {detalhe.jaDemitido ? <p>Candidato já demitido nesta vaga. Os documentos gerados estão abaixo.</p> : null}
      {detalhe.contratado && detalhe.tipoVaga !== 1 ? (
        <p>Demitir com documento único vale só para estágio.</p>
      ) : null}
      {statusMessage ? <p>{statusMessage}</p> : null}

      <section className="banco-bloco">
        <h3>Documentos gerados</h3>
        {detalhe.documentos?.length ? (
          <ul className="banco-docs">
            {detalhe.documentos.map((doc) => (
              <li key={doc.idContrato}>
                <strong>{doc.nome}</strong>
                <span>
                  {[doc.cargo, doc.empresa, doc.data, doc.status].filter(Boolean).join(' · ')}
                </span>
                <Link className="banco-list-link" href={`/banco-candidatos/documento/${doc.idContrato}`} target="_blank">
                  Ver / baixar
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p>Nenhum documento gerado.</p>
        )}
      </section>

      <section className="banco-bloco">
        <h3>Histórico / ocorrências</h3>
        {detalhe.ocorrencias?.length ? (
          <ul className="banco-docs">
            {detalhe.ocorrencias.map((item) => (
              <li key={item.id}>
                <span>{item.data}</span>
                <em>{item.descricao}</em>
              </li>
            ))}
          </ul>
        ) : (
          <p>Nenhuma ocorrência.</p>
        )}
      </section>
    </div>
  );
}
