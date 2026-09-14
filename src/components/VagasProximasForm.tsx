'use client';

import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { JobContractType, NearbyJob } from '@/types/candidatura';

const RADIUS_OPTIONS = [5, 10, 15, 20, 30, 50];
const CONTRACT_OPTIONS: JobContractType[] = ['CLT', 'Estágio'];

function formatCep(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 5) return digits;
  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
}

function formatDistance(distanceKm: number): string {
  if (distanceKm < 1) return `${Math.round(distanceKm * 1000)} m`;
  return `${distanceKm.toFixed(1).replace('.', ',')} km`;
}

function buildCandidateText(jobs: NearbyJob[]): string {
  if (jobs.length === 0) return '';

  const tipos = Array.from(new Set(jobs.map((job) => job.contractType)));
  const singular = jobs.length === 1;
  const tipoLabel = tipos.length === 1 ? ` de ${tipos[0]}` : '';
  const header = singular
    ? `✨ Encontrei esta vaga${tipoLabel} próxima de você:`
    : `✨ Encontrei estas vagas${tipoLabel} próximas de você:`;

  const lines = jobs.map((job, index) => {
    const salary = job.hasBenefits
      ? `${job.salaryLabel} + benefícios`
      : job.salaryLabel;
    const parts = [
      `${index + 1}. ${job.title}`,
      `📍 ${job.location}`,
    ];
    if (job.schedule) {
      parts.push(`🕒 ${job.schedule}`);
    }
    parts.push(`💰 ${salary}`);
    return parts.join('\n');
  });

  const footer = singular
    ? 'Possui interesse?'
    : 'Possui interesse? Se sim, nos informe o número da vaga.';

  return [header, '', ...lines, '', footer].join('\n');
}

export function VagasProximasForm() {
  const [cep, setCep] = useState('');
  const [raioKm, setRaioKm] = useState(10);
  const [tipos, setTipos] = useState<JobContractType[]>(['CLT', 'Estágio']);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [originLabel, setOriginLabel] = useState('');
  const [jobs, setJobs] = useState<NearbyJob[] | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);
  const [isRadiusOpen, setIsRadiusOpen] = useState(false);
  const radiusRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (radiusRef.current && !radiusRef.current.contains(event.target as Node)) {
        setIsRadiusOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedJobs = useMemo(() => {
    if (!jobs) return [];
    const selected = new Set(selectedIds);
    return jobs.filter((job) => selected.has(job.id));
  }, [jobs, selectedIds]);

  const candidateText = useMemo(
    () => buildCandidateText(selectedJobs),
    [selectedJobs]
  );

  function toggleTipo(tipo: JobContractType) {
    setTipos((current) => {
      if (current.includes(tipo)) {
        if (current.length === 1) return current;
        return current.filter((item) => item !== tipo);
      }
      return CONTRACT_OPTIONS.filter((item) => item === tipo || current.includes(item));
    });
  }

  function toggleJob(jobId: string) {
    setSelectedIds((current) =>
      current.includes(jobId)
        ? current.filter((id) => id !== jobId)
        : [...current, jobId]
    );
    setCopied(false);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsLoading(true);
    setErrorMessage('');
    setJobs(null);
    setSelectedIds([]);
    setOriginLabel('');
    setCopied(false);

    try {
      const response = await fetch('/api/vagas-proximas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cep, raioKm, tipos }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        setErrorMessage(result.message || 'Não foi possível buscar as vagas.');
        return;
      }

      const nextJobs: NearbyJob[] = result.jobs || [];
      setOriginLabel(result.originLabel || '');
      setJobs(nextJobs);
      setSelectedIds(nextJobs.map((job) => job.id));
    } catch (error) {
      setErrorMessage('Erro inesperado ao buscar vagas próximas.');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleCopy() {
    if (!candidateText) return;
    try {
      await navigator.clipboard.writeText(candidateText);
      setCopied(true);
    } catch (error) {
      setCopied(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="form" autoComplete="off">
      <div className="nearby-fields">
        <div className="field">
          <label htmlFor="cep">CEP da pessoa</label>
          <input
            id="cep"
            type="text"
            inputMode="numeric"
            autoComplete="off"
            value={cep}
            onChange={(e) => setCep(formatCep(e.target.value))}
            placeholder="01310-100"
            disabled={isLoading}
            required
          />
        </div>

        <div className="field" ref={radiusRef}>
          <label htmlFor="raio">Raio</label>
          <button
            id="raio"
            type="button"
            className="radius-trigger"
            onClick={() => setIsRadiusOpen((open) => !open)}
            disabled={isLoading}
          >
            {raioKm} km
          </button>
          {isRadiusOpen && (
            <div className="dropdown radius-dropdown">
              {RADIUS_OPTIONS.map((option) => (
                <button
                  key={option}
                  type="button"
                  className={`dropdown-item${option === raioKm ? ' selected' : ''}`}
                  onClick={() => {
                    setRaioKm(option);
                    setIsRadiusOpen(false);
                  }}
                >
                  <span className="dropdown-title">{option} km</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="field">
        <span className="filter-label">Tipo de vaga</span>
        <div className="filter-chips">
          {CONTRACT_OPTIONS.map((tipo) => {
            const selected = tipos.includes(tipo);
            return (
              <button
                key={tipo}
                type="button"
                className={`filter-chip${selected ? ' active' : ''}`}
                aria-pressed={selected}
                onClick={() => toggleTipo(tipo)}
                disabled={isLoading}
              >
                {selected && <span className="filter-chip-check" aria-hidden>✓</span>}
                {tipo}
              </button>
            );
          })}
        </div>
      </div>

      <button type="submit" disabled={isLoading} className="submit-button nearby-search-button">
        {isLoading ? 'Buscando...' : 'Buscar vagas próximas'}
      </button>

      {errorMessage && <div className="message error">{errorMessage}</div>}

      {jobs && (
        <div className="nearby-results">
          <p className="nearby-summary">
            {jobs.length === 0
              ? `Nenhuma vaga encontrada em até ${raioKm} km${originLabel ? ` de ${originLabel}` : ''}.`
              : `${jobs.length} vaga${jobs.length > 1 ? 's' : ''} em até ${raioKm} km${originLabel ? ` de ${originLabel}` : ''}, da mais próxima para a mais distante.`}
          </p>

          {jobs.length > 0 && (
            <div className="nearby-actions">
              <button
                type="button"
                className="ghost-button"
                onClick={() => {
                  setSelectedIds(jobs.map((job) => job.id));
                  setCopied(false);
                }}
              >
                Selecionar todas
              </button>
              <button
                type="button"
                className="ghost-button"
                onClick={() => {
                  setSelectedIds([]);
                  setCopied(false);
                }}
              >
                Limpar seleção
              </button>
            </div>
          )}

          {jobs.map((job) => {
            const selected = selectedIds.includes(job.id);
            return (
              <button
                key={job.id}
                type="button"
                className={`nearby-item${selected ? ' selected' : ''}`}
                onClick={() => toggleJob(job.id)}
              >
                <span className={`nearby-check${selected ? ' checked' : ''}`} aria-hidden>
                  {selected ? '✓' : ''}
                </span>
                <span className="nearby-item-body">
                  <strong>{job.title}</strong>
                  <span className="nearby-meta">
                    {job.contractType} • {job.company} • {job.location}
                  </span>
                  {job.schedule ? (
                    <span className="nearby-schedule">{job.schedule}</span>
                  ) : null}
                </span>
                <span className="nearby-distance">{formatDistance(job.distanceKm)}</span>
              </button>
            );
          })}

          {jobs.length > 0 && (
            <div className="nearby-message">
              <div className="nearby-message-header">
                <label htmlFor="texto-candidato">Texto para o candidato</label>
                <button
                  type="button"
                  className="ghost-button"
                  onClick={handleCopy}
                  disabled={!candidateText}
                >
                  {copied ? 'Copiado' : 'Copiar'}
                </button>
              </div>
              <textarea
                id="texto-candidato"
                readOnly
                value={candidateText || 'Selecione ao menos uma vaga para montar o texto.'}
                rows={Math.min(14, Math.max(6, selectedJobs.length * 3 + 2))}
              />
            </div>
          )}
        </div>
      )}
    </form>
  );
}
