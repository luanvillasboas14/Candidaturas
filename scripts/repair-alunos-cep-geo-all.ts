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
    // opcional
  }
}

async function main() {
  loadEnv('.env.local');
  loadEnv('.env');
  const concurrency = Number(process.argv[2] || 3);
  const {
    carregarGruposRua,
    processarRuas,
    ruasPendentes,
  } = await import('../src/ativacao-cruzeiro/alunos-cep-repair');

  console.log('carregando ruas do snapshot…');
  const grupos = await carregarGruposRua();
  const fila = await ruasPendentes(grupos);
  console.log(`ruas=${grupos.size} pendentes=${fila.length} paralelismo=${concurrency}`);
  if (!fila.length) {
    console.log('fim ruas=0 atualizados=0');
    return;
  }

  const inicio = Date.now();
  const result = await processarRuas(grupos, fila, concurrency);
  const min = ((Date.now() - inicio) / 60000).toFixed(1);
  console.log(`fim ruas=${result.ruas} atualizados=${result.atualizados} · ${min} min`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
