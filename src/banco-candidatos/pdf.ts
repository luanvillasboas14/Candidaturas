'use client';

const OPCOES_PDF = {
  margin: [12, 12, 12, 12],
  filename: 'Rescisao-estagio-ensino-medio.pdf',
  image: { type: 'jpeg', quality: 0.98 },
  html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff' },
  jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
  pagebreak: { mode: ['css', 'legacy'] },
};

function bytesParaBase64(bytes: Uint8Array): string {
  let binary = '';
  const passo = 0x8000;
  for (let i = 0; i < bytes.length; i += passo) {
    binary += String.fromCharCode(...bytes.subarray(i, i + passo));
  }
  return btoa(binary);
}

export async function pdfBase64DeElemento(el: HTMLElement): Promise<string> {
  const html2pdf = (await import('html2pdf.js')).default;
  const buffer = await html2pdf().set(OPCOES_PDF).from(el).outputPdf('arraybuffer');
  const bytes = new Uint8Array(buffer as ArrayBuffer);
  if (bytes.length < 80 || String.fromCharCode(...bytes.subarray(0, 4)) !== '%PDF') {
    throw new Error('PDF do documento não foi gerado.');
  }
  return bytesParaBase64(bytes);
}

export async function pdfBase64DeHtml(html: string): Promise<string> {
  const host = document.createElement('div');
  host.className = 'banco-print-doc';
  host.style.position = 'fixed';
  host.style.left = '-9999px';
  host.style.top = '0';
  host.style.width = '210mm';
  host.innerHTML = html;
  document.body.appendChild(host);
  try {
    return await pdfBase64DeElemento(host);
  } finally {
    host.remove();
  }
}
