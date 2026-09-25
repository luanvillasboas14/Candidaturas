'use client';

function opcoesPdf() {
  return {
    margin: [12, 12, 12, 12],
    filename: 'Rescisao-estagio-ensino-medio.pdf',
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: {
      scale: 2,
      useCORS: true,
      backgroundColor: '#ffffff',
      logging: false,
      onclone(clonedDoc: Document) {
        const root = clonedDoc.body;
        root.style.opacity = '1';
        root.style.visibility = 'visible';
        root.style.background = '#ffffff';
        root.style.color = '#111111';
        clonedDoc.querySelectorAll<HTMLElement>('body, .banco-print-doc, #corpo, .recisao-doc').forEach((el) => {
          el.style.opacity = '1';
          el.style.visibility = 'visible';
          el.style.position = 'static';
          el.style.left = 'auto';
          el.style.top = 'auto';
          el.style.zIndex = 'auto';
          el.style.transform = 'none';
          el.style.color = '#111111';
          el.style.background = '#ffffff';
        });
      },
    },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
    pagebreak: { mode: ['css', 'legacy'] },
  };
}

function bytesParaBase64(bytes: Uint8Array): string {
  let binary = '';
  const passo = 0x8000;
  for (let i = 0; i < bytes.length; i += passo) {
    binary += String.fromCharCode(...bytes.subarray(i, i + passo));
  }
  return btoa(binary);
}

async function esperarLayout(el: HTMLElement) {
  el.getBoundingClientRect();
  if (document.fonts?.ready) await document.fonts.ready;
  await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
  if (el.scrollHeight < 80) {
    throw new Error('PDF do documento saiu em branco. Abra o documento e envie de novo.');
  }
}

export async function pdfBase64DeElemento(el: HTMLElement): Promise<string> {
  await esperarLayout(el);
  const html2pdf = (await import('html2pdf.js')).default;
  const buffer = await html2pdf().set(opcoesPdf()).from(el).outputPdf('arraybuffer');
  const bytes = new Uint8Array(buffer as ArrayBuffer);
  if (bytes.length < 20000 || String.fromCharCode(...bytes.subarray(0, 4)) !== '%PDF') {
    throw new Error('PDF do documento saiu em branco. Abra o documento e envie de novo.');
  }
  return bytesParaBase64(bytes);
}

export async function pdfBase64DeHtml(html: string): Promise<string> {
  const texto = html.trim();
  if (!texto) throw new Error('PDF do documento saiu em branco. Abra o documento e envie de novo.');

  const host = document.createElement('div');
  host.className = 'banco-print-doc';
  host.style.cssText =
    'position:fixed;left:0;top:0;width:794px;z-index:0;opacity:1;pointer-events:none;background:#ffffff;color:#111111;';
  host.innerHTML = texto;
  document.body.appendChild(host);
  try {
    return await pdfBase64DeElemento(host);
  } finally {
    host.remove();
  }
}
