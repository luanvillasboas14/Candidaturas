'use client';

import { useEffect, useState } from 'react';
import { NOME_DOCUMENTO_RESCISAO, type EnvelopeTela } from './types';
import { pdfBase64DeElemento } from './pdf';

export function DocumentoAcoes({
  nome,
  onSalvarPdf,
  gerandoPdf,
}: {
  nome: string;
  onSalvarPdf?: () => void;
  gerandoPdf?: boolean;
}) {
  const [salvando, setSalvando] = useState(false);
  const ocupado = gerandoPdf ?? salvando;

  function imprimir() {
    const anterior = document.title;
    document.title = nome;
    window.print();
    document.title = anterior;
  }

  async function salvarPadrao() {
    const el = document.querySelector('.banco-print-doc');
    if (!(el instanceof HTMLElement)) return;
    setSalvando(true);
    try {
      const html2pdf = (await import('html2pdf.js')).default;
      await html2pdf()
        .set({
          margin: [12, 12, 12, 12],
          filename: 'Rescisao-estagio-ensino-medio.pdf',
          image: { type: 'jpeg', quality: 0.98 },
          html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff' },
          jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
          pagebreak: { mode: ['css', 'legacy'] },
        })
        .from(el)
        .save();
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="banco-print-bar">
      <strong>{nome}</strong>
      <div className="banco-print-acoes">
        <button type="button" className="banco-voltar" onClick={imprimir}>
          Imprimir
        </button>
        <button type="button" className="banco-voltar" disabled={ocupado} onClick={() => (onSalvarPdf ? onSalvarPdf() : void salvarPadrao())}>
          {ocupado ? 'Gerando PDF…' : 'Salvar em PDF'}
        </button>
      </div>
    </div>
  );
}

function statusLabel(status: string): string {
  if (status === 'signed') return 'Assinado';
  if (status === 'pending' || status === 'new') return 'Pendente';
  if (status === 'link-opened') return 'Link aberto';
  return status;
}

export function DocumentoPrint({ idContrato }: { idContrato: string }) {
  const [html, setHtml] = useState('');
  const [nome, setNome] = useState(NOME_DOCUMENTO_RESCISAO);
  const [candidato, setCandidato] = useState('');
  const [empresa, setEmpresa] = useState('');
  const [cargo, setCargo] = useState('');
  const [dataDemissao, setDataDemissao] = useState('');
  const [envelope, setEnvelope] = useState<EnvelopeTela | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const [faltando, setFaltando] = useState<string[]>([]);
  const [gerandoPdf, setGerandoPdf] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [syncing, setSyncing] = useState(false);

  function aplicar(json: {
    html?: string;
    nome?: string;
    candidato?: string;
    empresa?: string;
    cargo?: string;
    dataDemissao?: string;
    envelope?: EnvelopeTela | null;
  }) {
    setHtml(json.html || '');
    setNome(json.nome || NOME_DOCUMENTO_RESCISAO);
    setCandidato(json.candidato || '');
    setEmpresa(json.empresa || '');
    setCargo(json.cargo || '');
    setDataDemissao(json.dataDemissao || '');
    setEnvelope(json.envelope || null);
  }

  useEffect(() => {
    void fetch(`/api/banco-candidatos/documento/${encodeURIComponent(idContrato)}`)
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Falha ao abrir o documento.');
        aplicar(json);
      })
      .catch((error) => {
        setErrorMessage(error instanceof Error ? error.message : 'Falha ao abrir o documento.');
      });
  }, [idContrato]);

  async function salvarPdf() {
    const el = document.querySelector('.banco-print-doc');
    if (!(el instanceof HTMLElement)) return;
    setGerandoPdf(true);
    try {
      const html2pdf = (await import('html2pdf.js')).default;
      await html2pdf()
        .set({
          margin: [12, 12, 12, 12],
          filename: 'Rescisao-estagio-ensino-medio.pdf',
          image: { type: 'jpeg', quality: 0.98 },
          html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff' },
          jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
          pagebreak: { mode: ['css', 'legacy'] },
        })
        .from(el)
        .save();
    } finally {
      setGerandoPdf(false);
    }
  }

  async function enviarAssinatura() {
    setEnviando(true);
    setStatusMessage('');
    setFaltando([]);
    try {
      const el = document.querySelector('.banco-print-doc');
      if (!(el instanceof HTMLElement)) throw new Error('Prévia do documento não encontrada.');
      const pdfBase64 = await pdfBase64DeElemento(el);
      const res = await fetch(`/api/banco-candidatos/documento/${encodeURIComponent(idContrato)}/assinatura`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pdfBase64 }),
      });
      const json = await res.json();
      if (!res.ok) {
        setFaltando(Array.isArray(json.faltando) ? json.faltando : []);
        throw new Error(json.error || 'Falha ao enviar para assinatura.');
      }
      setEnvelope(json.envelope);
      setStatusMessage(json.avisoDna || 'Envelope enviado. As partes externas receberam o e-mail da ZapSign.');
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : 'Falha ao enviar para assinatura.');
    } finally {
      setEnviando(false);
    }
  }

  async function atualizarStatus() {
    setSyncing(true);
    setStatusMessage('');
    try {
      const res = await fetch(`/api/banco-candidatos/documento/${encodeURIComponent(idContrato)}/assinatura/sync`, {
        method: 'POST',
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Falha ao atualizar o status.');
      setEnvelope(json.envelope);
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : 'Falha ao atualizar o status.');
    } finally {
      setSyncing(false);
    }
  }

  async function reenviar(token: string) {
    setStatusMessage('');
    try {
      const res = await fetch(`/api/banco-candidatos/documento/${encodeURIComponent(idContrato)}/assinatura/reenviar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Falha ao reenviar o e-mail.');
      setStatusMessage('E-mail reenviado.');
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : 'Falha ao reenviar o e-mail.');
    }
  }

  if (errorMessage) return <p className="error">{errorMessage}</p>;
  if (!html) return <p className="subtitle">Carregando documento…</p>;

  return (
    <div className="banco-print">
      <DocumentoAcoes nome={nome} gerandoPdf={gerandoPdf} onSalvarPdf={() => void salvarPdf()} />
      <div className="banco-doc-meta">
        <p>
          <strong>Documento</strong>
          {nome}
        </p>
        <p>
          <strong>Candidato</strong>
          {candidato || '—'}
        </p>
        <p>
          <strong>Empresa</strong>
          {empresa || '—'}
        </p>
        <p>
          <strong>Vaga</strong>
          {cargo || '—'}
        </p>
        <p>
          <strong>Data da demissão</strong>
          {dataDemissao || '—'}
        </p>
      </div>

      <section className="banco-assinatura">
        <h3>Assinatura digital</h3>
        {envelope ? (
          <>
            <p>
              Status do documento: <strong>{statusLabel(envelope.statusDoc)}</strong>
            </p>
            {envelope.avisoDna ? <p className="banco-aviso">{envelope.avisoDna}</p> : null}
            <div className="banco-filtro-acoes">
              <button type="button" className="ativacao-page-btn" disabled={syncing} onClick={() => void atualizarStatus()}>
                {syncing ? 'Atualizando…' : 'Atualizar status'}
              </button>
            </div>
            <table>
              <thead>
                <tr>
                  <th>Papel</th>
                  <th>Nome</th>
                  <th>E-mail</th>
                  <th>Status</th>
                  <th>Data</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {envelope.assinantes.map((item) => (
                  <tr key={item.token || item.tipoPessoa}>
                    <td>{item.papel}</td>
                    <td>{item.nome}</td>
                    <td>{item.email || (item.tipoPessoa.startsWith('agente=') ? 'assinatura automática' : '—')}</td>
                    <td>{statusLabel(item.status)}</td>
                    <td>{item.data || '—'}</td>
                    <td>
                      {item.podeReenviar ? (
                        <button type="button" className="banco-list-link" onClick={() => void reenviar(item.token)}>
                          Reenviar e-mail
                        </button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        ) : (
          <button type="button" className="banco-voltar" disabled={enviando} onClick={() => void enviarAssinatura()}>
            {enviando ? 'Enviando…' : 'Enviar para assinatura digital'}
          </button>
        )}
        {faltando.length ? (
          <ul className="error">
            {faltando.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        ) : null}
        {statusMessage ? <p>{statusMessage}</p> : null}
        <button type="button" className="banco-list-link" onClick={() => window.close()}>
          ← Voltar à lista
        </button>
      </section>

      <div className="banco-print-doc" dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
}
