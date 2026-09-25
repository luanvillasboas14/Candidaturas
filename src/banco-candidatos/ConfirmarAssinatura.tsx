'use client';

import { useEffect, useRef, useState } from 'react';
import { pdfBase64DeElemento, pdfBase64DeHtml } from './pdf';

export function ConfirmarAssinatura({ idContrato }: { idContrato: string }) {
  const docRef = useRef<HTMLDivElement>(null);
  const [html, setHtml] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [recusou, setRecusou] = useState(false);
  const [ok, setOk] = useState(false);
  const [aviso, setAviso] = useState('');
  const [faltando, setFaltando] = useState<string[]>([]);

  useEffect(() => {
    void fetch(`/api/banco-candidatos/documento/${encodeURIComponent(idContrato)}`)
      .then(async (res) => {
        const doc = await res.json();
        if (!res.ok) throw new Error(doc.error || 'Falha ao abrir o documento.');
        setHtml(String(doc.html || ''));
      })
      .catch((error) => {
        setAviso(error instanceof Error ? error.message : 'Falha ao abrir o documento.');
      });
  }, [idContrato]);

  async function enviar() {
    setEnviando(true);
    setAviso('');
    setFaltando([]);
    try {
      if (!html.trim()) throw new Error('Documento ainda não carregou. Espere um instante e clique em Sim de novo.');
      const el = docRef.current;
      const pdfBase64 =
        el && el.scrollHeight > 80 ? await pdfBase64DeElemento(el) : await pdfBase64DeHtml(html);
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
      setOk(true);
      setAviso(json.avisoDna || 'Envelope enviado.');
    } catch (error) {
      setAviso(error instanceof Error ? error.message : 'Falha ao enviar para assinatura.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="banco-confirmar-tela">
      {html ? <div ref={docRef} className="banco-print-doc banco-pdf-captura" dangerouslySetInnerHTML={{ __html: html }} /> : null}
      <div className="banco-confirmar">
        <h2>Assinatura digital</h2>
        {ok ? (
          <>
            <p>Documento enviado para assinatura.</p>
            {aviso ? <p className="banco-aviso">{aviso}</p> : null}
          </>
        ) : recusou ? (
          <p>Não enviado. Pode fechar esta aba e mandar depois em Documentos gerados, na ficha do candidato.</p>
        ) : (
          <>
            <p>Enviar este documento para assinatura digital?</p>
            <div className="banco-filtro-acoes">
              <button type="button" className="banco-voltar" disabled={enviando || !html} onClick={() => void enviar()}>
                {enviando ? 'Enviando…' : html ? 'Sim' : 'Carregando…'}
              </button>
              <button
                type="button"
                className="ativacao-page-btn"
                disabled={enviando}
                onClick={() => {
                  window.close();
                  setRecusou(true);
                }}
              >
                Não
              </button>
            </div>
          </>
        )}
        {faltando.length ? (
          <ul className="error">
            {faltando.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        ) : null}
        {aviso && !ok ? <p className="error">{aviso}</p> : null}
        <a href={`/banco-candidatos/documento/${encodeURIComponent(idContrato)}`} className="banco-list-link">
          Ver documento
        </a>
      </div>
    </div>
  );
}
