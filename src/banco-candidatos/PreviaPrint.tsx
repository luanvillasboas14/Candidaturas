'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { DocumentoAcoes } from './DocumentoPrint';
import { NOME_DOCUMENTO_RESCISAO } from './types';

function PreviaPrintInner() {
  const searchParams = useSearchParams();
  const [html, setHtml] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    const idCandidato = searchParams.get('id') || '';
    const idVaga = searchParams.get('vaga') || '';
    const motivo = searchParams.get('motivo') || '';
    const dataDemissao = searchParams.get('data') || '';
    const avaliacao = searchParams.get('avaliacao') || '';
    const resumoAtividades = searchParams.get('resumo') || '';
    if (!idCandidato || !idVaga || !motivo || !dataDemissao || !avaliacao || !resumoAtividades) {
      setErrorMessage('Prévia incompleta. Gere de novo na ficha do candidato.');
      return;
    }
    void fetch('/api/banco-candidatos/previa', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idCandidato, idVaga, motivo, dataDemissao, avaliacao, resumoAtividades }),
    })
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Falha ao montar a prévia.');
        setHtml(json.html || '');
      })
      .catch((error) => {
        setErrorMessage(error instanceof Error ? error.message : 'Falha ao montar a prévia.');
      });
  }, [searchParams]);

  if (errorMessage) return <p className="error">{errorMessage}</p>;
  if (!html) return <p className="subtitle">Carregando prévia…</p>;

  return (
    <div className="banco-print">
      <DocumentoAcoes nome={`Prévia — ${NOME_DOCUMENTO_RESCISAO}`} />
      <div className="banco-print-doc" dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
}

export function PreviaPrint() {
  return (
    <Suspense fallback={<p className="subtitle">Carregando prévia…</p>}>
      <PreviaPrintInner />
    </Suspense>
  );
}
