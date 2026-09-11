import { NextResponse } from 'next/server';
import { listJobs } from '@/lib/supabase';

export async function GET() {
  try {
    const jobs = await listJobs();
    return NextResponse.json({ success: true, jobs });
  } catch (error) {
    console.error('Erro ao carregar vagas:', error);
    return NextResponse.json(
      { success: false, message: 'Não foi possível carregar as vagas no momento.', jobs: [] },
      { status: 500 }
    );
  }
}
