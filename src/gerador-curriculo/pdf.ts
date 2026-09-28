'use client';

const ALTURA_UMA_PAGINA = 1123;

function opcoesPdf(filename: string) {
  return {
    margin: [0, 0, 0, 0],
    filename,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: {
      scale: 2,
      useCORS: true,
      backgroundColor: '#ffffff',
      logging: false,
    },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
    pagebreak: { mode: ['css', 'legacy'] },
  };
}

export async function baixarCurriculoPdf(el: HTMLElement, nome: string) {
  const folha = el.querySelector<HTMLElement>('.cv-folha') ?? el;
  folha.getBoundingClientRect();
  if (document.fonts?.ready) await document.fonts.ready;
  await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
  if (folha.scrollHeight < 80) {
    throw new Error('A prévia saiu em branco. Volte e gere de novo.');
  }

  const umaPagina = folha.scrollHeight <= ALTURA_UMA_PAGINA;
  const anterior = {
    height: folha.style.height,
    minHeight: folha.style.minHeight,
    maxHeight: folha.style.maxHeight,
    overflow: folha.style.overflow,
    boxShadow: folha.style.boxShadow,
  };
  if (umaPagina) {
    folha.style.boxShadow = 'none';
    folha.style.overflow = 'hidden';
    folha.style.minHeight = '0';
    folha.style.height = '1100px';
    folha.style.maxHeight = '1100px';
  } else {
    folha.style.boxShadow = 'none';
  }

  const html2pdf = (await import('html2pdf.js')).default;
  const arquivo = `Curriculo-${(nome || 'candidato').replace(/\s+/g, '-')}.pdf`;
  try {
    await html2pdf().set(opcoesPdf(arquivo)).from(folha).save();
  } finally {
    folha.style.height = anterior.height;
    folha.style.minHeight = anterior.minHeight;
    folha.style.maxHeight = anterior.maxHeight;
    folha.style.overflow = anterior.overflow;
    folha.style.boxShadow = anterior.boxShadow;
  }
}
