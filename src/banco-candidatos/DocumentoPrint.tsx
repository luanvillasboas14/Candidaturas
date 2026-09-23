'use client';

import { useEffect, useState } from 'react';
import { NOME_DOCUMENTO_RESCISAO } from './types';

export function DocumentoAcoes({ nome }: { nome: string }) {
  const [gerandoPdf, setGerandoPdf] = useState(false);

  function imprimir() {
    const anterior = document.title;
    document.title = nome;
    window.print();
    document.title = anterior;
  }

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

  return (
    <div className="banco-print-bar">
      <strong>{nome}</strong>
      <div className="banco-print-acoes">
        <button type="button" className="banco-voltar" onClick={imprimir}>
          Imprimir
        </button>
        <button type="button" className="banco-voltar" disabled={gerandoPdf} onClick={() => void salvarPdf()}>
          {gerandoPdf ? 'Gerando PDF…' : 'Salvar em PDF'}
        </button>
      </div>
    </div>
  );
}

export function DocumentoPrint({ idContrato }: { idContrato: string }) {
  const [html, setHtml] = useState('');
  const [nome, setNome] = useState(NOME_DOCUMENTO_RESCISAO);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    void fetch(`/api/banco-candidatos/documento/${encodeURIComponent(idContrato)}`)
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Falha ao abrir o documento.');
        setHtml(json.html || '');
        setNome(json.nome || NOME_DOCUMENTO_RESCISAO);
      })
      .catch((error) => {
        setErrorMessage(error instanceof Error ? error.message : 'Falha ao abrir o documento.');
      });
  }, [idContrato]);

  if (errorMessage) return <p className="error">{errorMessage}</p>;
  if (!html) return <p className="subtitle">Carregando documento…</p>;

  return (
    <div className="banco-print">
      <DocumentoAcoes nome={nome} />
      <div className="banco-print-doc" dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
}
