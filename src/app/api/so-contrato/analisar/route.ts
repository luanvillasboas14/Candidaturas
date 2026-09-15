import { NextResponse } from 'next/server';
import { extractCandidatesFromText } from '@/lib/so-contrato-ocr';

export const runtime = 'nodejs';
export const maxDuration = 60;

const MAX_PHOTO_BYTES = 8 * 1024 * 1024;
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

let ocrWorker: Awaited<ReturnType<typeof import('tesseract.js')['createWorker']>> | null = null;

async function getOcrWorker() {
  if (ocrWorker) return ocrWorker;
  const { createWorker, PSM } = await import('tesseract.js');
  ocrWorker = await createWorker('por+eng');
  await ocrWorker.setParameters({
    tessedit_pageseg_mode: PSM.SINGLE_BLOCK,
    preserve_interword_spaces: '1',
  });
  return ocrWorker;
}

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const foto = form.get('foto');

    if (!(foto instanceof File) || foto.size === 0) {
      return NextResponse.json(
        { success: false, message: 'Envie a foto do contrato.' },
        { status: 400 }
      );
    }

    if (foto.size > MAX_PHOTO_BYTES) {
      return NextResponse.json(
        { success: false, message: 'A foto deve ter no máximo 8 MB.' },
        { status: 400 }
      );
    }

    if (foto.type && !ALLOWED_TYPES.has(foto.type)) {
      return NextResponse.json(
        { success: false, message: 'Envie a foto em JPG, PNG, WEBP ou GIF.' },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await foto.arrayBuffer());
    const worker = await getOcrWorker();
    const result = await worker.recognize(buffer);
    const candidatos = extractCandidatesFromText(result.data.text || '');

    if (candidatos.length === 0) {
      return NextResponse.json(
        {
          success: false,
          message: 'Não encontrei nome e telefone nessa foto. Tente uma imagem mais nítida.',
        },
        { status: 422 }
      );
    }

    return NextResponse.json({
      success: true,
      candidatos,
      message:
        candidatos.length === 1
          ? 'Encontrei 1 candidato na foto.'
          : `Encontrei ${candidatos.length} candidatos na foto.`,
    });
  } catch (error) {
    console.error('Erro ao analisar foto Só contrato:', error);
    return NextResponse.json(
      { success: false, message: 'Não foi possível ler a foto. Tente novamente.' },
      { status: 500 }
    );
  }
}
