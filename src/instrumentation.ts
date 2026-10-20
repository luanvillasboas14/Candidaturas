export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs' && process.env.NEXT_PHASE !== 'phase-production-build') {
    const { setDefaultResultOrder } = await import('node:dns');
    setDefaultResultOrder('ipv4first');
    const { agendarSyncVagas } = await import('@/vagas-abertas/agendar');
    agendarSyncVagas();
  }
}
