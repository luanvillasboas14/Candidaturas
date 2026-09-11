'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';
import { NearbyJob } from '@/types/candidatura';

const RADIUS_OPTIONS = [5, 10, 15, 20, 30, 50];

function formatCep(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 5) return digits;
  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
}

export function VagasProximasForm() {
  const [cep, setCep] = useState('');
  const [raioKm, setRaioKm] = useState(10);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [originLabel, setOriginLabel] = useState('');
  const [jobs, setJobs] = useState<NearbyJob[] | null>(null);
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

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsLoading(true);
    setErrorMessage('');
    setJobs(null);
    setOriginLabel('');

    try {
      const response = await fetch('/api/vagas-proximas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cep, raioKm }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        setErrorMessage(result.message || 'Não foi possível buscar as vagas.');
        return;
      }

      setOriginLabel(result.originLabel || '');
      setJobs(result.jobs || []);
    } catch (error) {
      setErrorMessage('Erro inesperado ao buscar vagas próximas.');
    } finally {
      setIsLoading(false);
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

      <button type="submit" disabled={isLoading} className="submit-button">
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

          {jobs.map((job) => (
            <div key={job.id} className="nearby-item">
              <div>
                <strong>{job.title}</strong>
                <span className="nearby-meta">
                  {job.company} • {job.location}
                </span>
              </div>
              <span className="nearby-distance">
                {job.distanceKm < 1
                  ? `${Math.round(job.distanceKm * 1000)} m`
                  : `${job.distanceKm.toFixed(1)} km`}
              </span>
            </div>
          ))}
        </div>
      )}
    </form>
  );
}
