import { readFileSync } from 'fs';
import { resolve } from 'path';

function loadEnv(file: string) {
  try {
    for (const line of readFileSync(resolve(file), 'utf8').split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const split = trimmed.indexOf('=');
      if (split < 0) continue;
      const key = trimmed.slice(0, split).trim();
      const value = trimmed.slice(split + 1).trim();
      if (key && process.env[key] == null) process.env[key] = value;
    }
  } catch {
    // optional
  }
}

async function main() {
  loadEnv('.env.local');
  loadEnv('.env');
  const { sincronizarAlunosCep, statusAlunosCep } = await import(
    '../src/ativacao-cruzeiro/alunos-cep-sync'
  );
  console.log('antes', await statusAlunosCep());
  console.log('depois', await sincronizarAlunosCep());
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
