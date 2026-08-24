'use client';

import { useState, useMemo, useRef, useEffect, FormEvent } from 'react';
import { JobOption, CandidaturaResponse } from '@/types/candidatura';

type Status = 'idle' | 'loading' | 'success' | 'duplicate' | 'error';

interface CandidaturaFormProps {
  jobs: JobOption[];
}

export function CandidaturaForm({ jobs }: CandidaturaFormProps) {
  const [telefone, setTelefone] = useState('');
  const [jobId, setJobId] = useState('');
  const [jobSearch, setJobSearch] = useState('');
  const [isJobDropdownOpen, setIsJobDropdownOpen] = useState(false);
  const [status, setStatus] = useState<Status>('idle');
  const [statusMessage, setStatusMessage] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  const selectedJob = useMemo(
    () => jobs.find((job) => job.id === jobId) || null,
    [jobs, jobId]
  );

  const filteredJobs = useMemo(() => {
    const query = jobSearch.trim().toLowerCase();
    if (!query) return jobs;
    const terms = query.split(/\s+/).filter(Boolean);
    return jobs.filter((job) => {
      const haystack = `${job.title} ${job.company} ${job.location}`.toLowerCase();
      return terms.every((term) => haystack.includes(term));
    });
  }, [jobs, jobSearch]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsJobDropdownOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!telefone.trim() || !jobId) {
      setStatus('error');
      setStatusMessage('Preencha o telefone e selecione uma vaga.');
      return;
    }

    setStatus('loading');
    setStatusMessage('');

    try {
      const vagaEndereco = selectedJob
        ? `${selectedJob.title} — ${selectedJob.location}`
        : '';

      const response = await fetch('/api/candidaturas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          telefone,
          job_id: jobId,
          vaga_endereco: vagaEndereco,
        }),
      });

      const result: CandidaturaResponse = await response.json();

      if (response.status === 409 || result.code === 'CANDIDATURA_DUPLICADA') {
        setStatus('duplicate');
        setStatusMessage(result.message);
        return;
      }

      if (!response.ok || !result.success) {
        setStatus('error');
        setStatusMessage(result.message || 'Erro ao criar candidatura.');
        return;
      }

      setStatus('success');
      let message = 'Candidatura criada com sucesso.';
      if (result.hasOtherCandidaturas && result.otherCandidaturasCount) {
        const count = result.otherCandidaturasCount;
        message += ` Este candidato já possui ${count} outra${count > 1 ? 's' : ''} candidatura${count > 1 ? 's' : ''} registrada${count > 1 ? 's' : ''}.`;
      }
      setStatusMessage(message);
      setTelefone('');
      setJobId('');
      setJobSearch('');
    } catch (error) {
      setStatus('error');
      setStatusMessage('Erro inesperado. Tente novamente.');
    }
  }

  const isLoading = status === 'loading';

  return (
    <form onSubmit={handleSubmit} className="form" autoComplete="off">
      <div className="field">
        <label htmlFor="telefone">Telefone do candidato</label>
        <input
          id="telefone"
          type="tel"
          autoComplete="off"
          value={telefone}
          onChange={(e) => setTelefone(e.target.value)}
          placeholder="5511999999999"
          disabled={isLoading}
          required
        />
        <span className="hint">Ex: 11999999999 ou 5511999999999</span>
      </div>

      <div className="field" ref={dropdownRef}>
        <label htmlFor="vaga">Vaga</label>
        <div className="search-select">
          <input
            id="vaga"
            type="text"
            autoComplete="off"
            value={selectedJob ? `${selectedJob.title} — ${selectedJob.company}` : jobSearch}
            onChange={(e) => {
              setJobSearch(e.target.value);
              setJobId('');
              setIsJobDropdownOpen(true);
            }}
            onFocus={() => setIsJobDropdownOpen(true)}
            placeholder="Buscar por título, empresa ou local..."
            disabled={isLoading || jobs.length === 0}
            required
          />
          {isJobDropdownOpen && filteredJobs.length > 0 && (
            <div className="dropdown">
              {filteredJobs.map((job) => (
                <button
                  key={job.id}
                  type="button"
                  className="dropdown-item"
                  onClick={() => {
                    setJobId(job.id);
                    setJobSearch('');
                    setIsJobDropdownOpen(false);
                  }}
                >
                  <span className="dropdown-title">{job.title}</span>
                  <span className="dropdown-meta">
                    {job.company} • {job.location}
                  </span>
                </button>
              ))}
            </div>
          )}
          {isJobDropdownOpen && filteredJobs.length === 0 && (
            <div className="dropdown">
              <div className="dropdown-empty">Nenhuma vaga encontrada.</div>
            </div>
          )}
        </div>
        {selectedJob && (
          <div className="selected-job">
            <span>{selectedJob.title}</span>
            <span className="selected-job-meta">
              {selectedJob.company} • {selectedJob.location}
            </span>
          </div>
        )}
      </div>

      <button type="submit" disabled={isLoading} className="submit-button">
        {isLoading ? 'Criando...' : 'Criar candidatura'}
      </button>

      {status === 'success' && (
        <div className="message success">{statusMessage}</div>
      )}
      {status === 'duplicate' && (
        <div className="message duplicate">{statusMessage}</div>
      )}
      {status === 'error' && (
        <div className="message error">{statusMessage}</div>
      )}
    </form>
  );
}
