import { existsSync } from 'fs';
import path from 'path';
import { prepareOcrImages } from './so-contrato-image';
import type { OcrLine } from './so-contrato-ocr';

const OCR_TIMEOUT_MS = 25_000;
const INIT_TIMEOUT_MS = 45_000;

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });
}

function tessdataPath(): string {
  return path.join(process.cwd(), 'tessdata');
}

function workerScriptPath(): string {
  return path.join(
    process.cwd(),
    'node_modules',
    'tesseract.js',
    'src',
    'worker-script',
    'node',
    'index.js'
  );
}

type OcrWorker = Awaited<ReturnType<typeof import('tesseract.js')['createWorker']>>;

let workerPromise: Promise<OcrWorker> | null = null;

async function createOcrWorker(): Promise<OcrWorker> {
  const langPath = tessdataPath();
  const workerPath = workerScriptPath();

  if (!existsSync(path.join(langPath, 'por.traineddata'))) {
    throw new Error(`Arquivos de idioma do OCR não encontrados em ${langPath}.`);
  }
  if (!existsSync(workerPath)) {
    throw new Error('Worker do Tesseract não encontrado na imagem.');
  }

  const { createWorker } = await import('tesseract.js');
  return withTimeout(
    createWorker('por+eng', 1, {
      workerPath,
      langPath,
      cachePath: langPath,
      cacheMethod: 'readOnly',
      gzip: false,
      errorHandler: (error) => {
        console.error('Tesseract worker:', error);
      },
    }),
    INIT_TIMEOUT_MS,
    'O OCR demorou demais para iniciar.'
  );
}

async function getOcrWorker(): Promise<OcrWorker> {
  if (!workerPromise) {
    workerPromise = createOcrWorker().catch((error) => {
      workerPromise = null;
      throw error;
    });
  }
  return workerPromise;
}

export interface OcrPass {
  text: string;
  lines: OcrLine[];
}

export async function recognizeImageText(image: Buffer, psm?: number): Promise<string> {
  const worker = await getOcrWorker();
  const { PSM } = await import('tesseract.js');
  await worker.setParameters({
    tessedit_pageseg_mode: psm ?? PSM.AUTO,
    preserve_interword_spaces: '1',
  });
  const result = await withTimeout(
    worker.recognize(image, {}, { text: true }),
    OCR_TIMEOUT_MS,
    'O OCR demorou demais para ler a campanha.'
  );
  return result.data.text || '';
}

export async function recognizePhotoPasses(image: Buffer): Promise<OcrPass[]> {
  const variants = await prepareOcrImages(image);
  const worker = await getOcrWorker();
  const { PSM } = await import('tesseract.js');
  const passes: OcrPass[] = [];

  for (const variant of variants) {
    await worker.setParameters({
      tessedit_pageseg_mode: PSM.AUTO,
      preserve_interword_spaces: '1',
      user_defined_dpi: '300',
    });
    const result = await withTimeout(
      worker.recognize(variant, {}, { text: true, blocks: true }),
      OCR_TIMEOUT_MS,
      'O OCR demorou demais para ler a foto.'
    );
    const data = result.data as {
      text?: string;
      lines?: Array<{ text?: string; confidence?: number }>;
    };
    passes.push({
      text: data.text || '',
      lines: (data.lines || []).map((line) => ({
        text: line.text || '',
        confidence: line.confidence,
      })),
    });
  }

  return passes;
}
