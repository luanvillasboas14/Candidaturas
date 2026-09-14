import { NextResponse } from 'next/server';
import { listActiveJobsForGeo } from '@/lib/supabase';
import { listJobSchedulesByCodigo } from '@/lib/dna-work-hours';
import { geocodeCep, haversineKm, normalizeCep } from '@/lib/geo';
import { JobContractType, NearbyJob } from '@/types/candidatura';

const CONTRACT_TYPES: JobContractType[] = ['CLT', 'Estágio'];

function normalizeContractType(value: unknown): JobContractType | null {
  const raw = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (raw === 'clt' || raw === 'clr') return 'CLT';
  if (raw === 'estágio' || raw === 'estagio') return 'Estágio';
  return null;
}

function parseTipos(value: unknown): JobContractType[] {
  const raw = Array.isArray(value) ? value : [];
  const unique = new Set<JobContractType>();
  for (const item of raw) {
    const tipo = normalizeContractType(item);
    if (tipo) unique.add(tipo);
  }
  return CONTRACT_TYPES.filter((tipo) => unique.has(tipo));
}

function formatSalaryLabel(job: {
  salaryMin: number;
  salaryMax: number;
  salaryRange: string;
}): string {
  const amount = job.salaryMax || job.salaryMin;
  if (!amount || amount <= 0) return 'salário a combinar';
  if (job.salaryRange) return `R$ ${job.salaryRange}`;
  return `R$ ${amount.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function dedupeKey(job: NearbyJob): string {
  return [job.title, job.company, job.location, job.contractType, job.schedule]
    .map((part) => part.trim().toLowerCase().replace(/\s+/g, ' '))
    .join('|');
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const cep = normalizeCep(typeof body.cep === 'string' ? body.cep : '');
    const raioKm = Number(body.raioKm);
    const tipos = parseTipos(body.tipos);

    if (!cep) {
      return NextResponse.json(
        { success: false, message: 'Informe um CEP válido com 8 dígitos.' },
        { status: 400 }
      );
    }

    if (!Number.isFinite(raioKm) || raioKm <= 0 || raioKm > 100) {
      return NextResponse.json(
        { success: false, message: 'Informe um raio entre 1 e 100 km.' },
        { status: 400 }
      );
    }

    if (tipos.length === 0) {
      return NextResponse.json(
        { success: false, message: 'Selecione CLT ou Estágio.' },
        { status: 400 }
      );
    }

    const origin = await geocodeCep(cep);
    if (!origin) {
      return NextResponse.json(
        { success: false, message: 'Não foi possível localizar esse CEP.' },
        { status: 400 }
      );
    }

    const [jobs, schedules] = await Promise.all([
      listActiveJobsForGeo(),
      listJobSchedulesByCodigo(),
    ]);
    const nearbyByKey = new Map<string, NearbyJob>();

    for (const job of jobs) {
      const contractType = normalizeContractType(job.contractType);
      if (!contractType || !tipos.includes(contractType)) continue;

      const distanceKm = haversineKm(origin, {
        lat: job.latitude,
        lng: job.longitude,
      });
      if (distanceKm > raioKm) continue;

      const candidate: NearbyJob = {
        id: job.id,
        title: job.title,
        company: job.company,
        location: job.location,
        contractType,
        salaryLabel: formatSalaryLabel(job),
        hasBenefits: Boolean(job.benefits),
        schedule: job.codigo ? schedules.get(job.codigo) || '' : '',
        distanceKm: Number(distanceKm.toFixed(2)),
      };
      const key = dedupeKey(candidate);
      const current = nearbyByKey.get(key);
      if (!current || candidate.distanceKm < current.distanceKm) {
        nearbyByKey.set(key, candidate);
      }
    }

    const nearby = Array.from(nearbyByKey.values()).sort(
      (a, b) => a.distanceKm - b.distanceKm
    );

    return NextResponse.json({
      success: true,
      originLabel: `${cep.slice(0, 5)}-${cep.slice(5)}`,
      jobs: nearby,
    });
  } catch (error) {
    console.error('Erro ao buscar vagas próximas:', error);
    return NextResponse.json(
      { success: false, message: 'Erro inesperado ao buscar vagas próximas.' },
      { status: 500 }
    );
  }
}
