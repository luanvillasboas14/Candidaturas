import { existsSync } from 'fs';
import path from 'path';

const OCR_TIMEOUT_MS = 45_000;

function withTimeout<T>(promise: Promise<T>, message: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), OCR_TIMEOUT_MS);
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

  const { createWorker, PSM } = await import('tesseract.js');
  const worker = await withTimeout(
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
    'O OCR demorou demais para iniciar.'
  );

  await worker.setParameters({
    tessedit_pageseg_mode: PSM.SINGLE_BLOCK,
    preserve_interword_spaces: '1',
  });

  return worker;
}

export async function recognizePhotoText(image: Buffer): Promise<string> {
  if (!workerPromise) {
    workerPromise = createOcrWorker().catch((error) => {
      workerPromise = null;
      throw error;
    });
  }

  const worker = await workerPromise;
  const result = await withTimeout(
    worker.recognize(image),
    'O OCR demorou demais para ler a foto.'
  );
  return result.data.text || '';
}
