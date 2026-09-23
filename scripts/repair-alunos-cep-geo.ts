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
    // arquivo opcional
  }
}

async function main() {
  loadEnv('.env.local');
  loadEnv('.env');
  const limite = Number(process.argv[2] || 80);
  const { repararAlunosCepPorRua } = await import('../src/ativacao-cruzeiro/alunos-cep-repair');
  const result = await repararAlunosCepPorRua(limite);
  console.log(`ruas=${result.ruas} atualizados=${result.atualizados}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
