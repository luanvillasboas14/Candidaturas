import { NextResponse } from 'next/server';
import { listActiveJobsForGeo } from '@/lib/supabase';
import { geocodeCep, haversineKm, normalizeCep } from '@/lib/geo';
import { NearbyJob } from '@/types/candidatura';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const cep = normalizeCep(typeof body.cep === 'string' ? body.cep : '');
    const raioKm = Number(body.raioKm);

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

    const origin = await geocodeCep(cep);
    if (!origin) {
      return NextResponse.json(
        { success: false, message: 'Não foi possível localizar esse CEP.' },
        { status: 400 }
      );
    }

    const jobs = await listActiveJobsForGeo();
    const nearby: NearbyJob[] = [];

    for (const job of jobs) {
      const distanceKm = haversineKm(origin, {
        lat: job.latitude,
        lng: job.longitude,
      });
      if (distanceKm <= raioKm) {
        nearby.push({
          id: job.id,
          title: job.title,
          company: job.company,
          location: job.location,
          distanceKm: Number(distanceKm.toFixed(2)),
        });
      }
    }

    nearby.sort((a, b) => a.distanceKm - b.distanceKm);

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
