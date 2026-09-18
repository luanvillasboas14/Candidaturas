'use client';

import { MouseEvent, useEffect, useMemo, useRef, useState } from 'react';
import {
  addMonthsIso,
  brasiliaTodayIso,
  clampOrigemRange,
  isoToBr,
  rangeForPreset,
  type PeriodPreset,
} from './date-range';

interface OrigemItem {
  nome: string;
  quantidade: number;
  percentual: number;
}

interface CampanhaItem {
  origem: string;
  campanha: string;
  quantidade: number;
}

interface DashboardData {
  total: number;
  origens: OrigemItem[];
  campanhas: CampanhaItem[];
}

interface PieSlice {
  item: OrigemItem;
  start: number;
  end: number;
  color: string;
}

interface PieHover {
  item: OrigemItem;
  color: string;
  x: number;
  y: number;
}

const PIE_COLORS = ['#ff7a08', '#6a5cff', '#38bdf8', '#4ade80', '#f472b6', '#facc15', '#fb7185'];

function maskBrDate(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

function brToIso(value: string): string | null {
  const match = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return null;
  const [, day, month, year] = match;
  const iso = `${year}-${month}-${day}`;
  const date = new Date(`${iso}T00:00:00`);
  if (
    Number.isNaN(date.getTime()) ||
    date.getFullYear() !== Number(year) ||
    date.getMonth() + 1 !== Number(month) ||
    date.getDate() !== Number(day)
  ) {
    return null;
  }
  return iso;
}

function polar(cx: number, cy: number, r: number, angle: number) {
  const rad = ((angle - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function slicePath(cx: number, cy: number, r: number, start: number, end: number): string {
  const startPoint = polar(cx, cy, r, start);
  const endPoint = polar(cx, cy, r, end);
  const large = end - start > 180 ? 1 : 0;
  return `M ${cx} ${cy} L ${startPoint.x} ${startPoint.y} A ${r} ${r} 0 ${large} 1 ${endPoint.x} ${endPoint.y} Z`;
}

function CanalPie({ origens }: { origens: OrigemItem[] }) {
  const [hover, setHover] = useState<PieHover | null>(null);
  const slices = useMemo<PieSlice[]>(() => {
    let angle = 0;
    return origens.map((item, index) => {
      const sweep = (item.percentual / 100) * 360;
      const start = angle;
      const end = angle + sweep;
      angle = end;
      return { item, start, end, color: PIE_COLORS[index % PIE_COLORS.length] };
    });
  }, [origens]);

  function moveTooltip(event: MouseEvent<SVGElement>, slice: PieSlice) {
    const box = event.currentTarget.closest('.origem-pie-chart')?.getBoundingClientRect();
    if (!box) return;
    setHover({
      item: slice.item,
      color: slice.color,
      x: event.clientX - box.left,
      y: event.clientY - box.top,
    });
  }

  return (
    <div className="origem-pie-block">
      <div className="origem-pie-chart">
        <svg
          viewBox="0 0 240 240"
          className="origem-pie"
          role="img"
          aria-label="Canais de origem"
          onMouseLeave={() => setHover(null)}
        >
          {slices.length === 1 ? (
            <circle
              cx="120"
              cy="120"
              r="100"
              fill={slices[0].color}
              onMouseMove={(event) => moveTooltip(event, slices[0])}
            />
          ) : (
            slices.map((slice) => (
              <path
                key={slice.item.nome}
                d={slicePath(120, 120, 100, slice.start, slice.end)}
                fill={slice.color}
                onMouseMove={(event) => moveTooltip(event, slice)}
              />
            ))
          )}
        </svg>
        {hover && (
          <div
            className="origem-pie-tooltip"
            style={{ left: hover.x, top: hover.y }}
          >
            <strong>{hover.item.nome}</strong>
            <span>
              <i style={{ background: hover.color }} />
              {hover.item.quantidade} leads ({hover.item.percentual}%)
            </span>
          </div>
        )}
      </div>
      <ul className="origem-pie-legend">
        {slices.map((slice) => (
          <li key={slice.item.nome}>
            <i style={{ background: slice.color }} />
            <span>{slice.item.nome}</span>
            <em>
              {slice.item.quantidade} ({slice.item.percentual}%)
            </em>
          </li>
        ))}
      </ul>
    </div>
  );
}

const PERIOD_OPTIONS: Array<{ value: PeriodPreset; label: string }> = [
  { value: '7d', label: '7 dias' },
  { value: '1m', label: '1 mês' },
  { value: '3m', label: '3 meses' },
];

function periodLabel(preset: PeriodPreset | 'custom'): string {
  if (preset === 'custom') return 'Personalizado';
  return PERIOD_OPTIONS.find((option) => option.value === preset)?.label || '7 dias';
}

const WEEKDAYS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
const MONTHS = [
  'janeiro',
  'fevereiro',
  'março',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro',
];

function toIso(year: number, month: number, day: number): string {
  const date = new Date(year, month - 1, day);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function OrigemCalendar({
  value,
  min,
  max,
  onSelect,
}: {
  value: string;
  min: string;
  max: string;
  onSelect: (iso: string) => void;
}) {
  const [year, month] = value.split('-').map(Number);
  const [viewYear, setViewYear] = useState(year || new Date().getFullYear());
  const [viewMonth, setViewMonth] = useState(month || new Date().getMonth() + 1);

  const firstWeekday = new Date(viewYear, viewMonth - 1, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth, 0).getDate();
  const prevMonthDays = new Date(viewYear, viewMonth - 1, 0).getDate();
  const cells: Array<{ iso: string; day: number; outside: boolean }> = [];

  for (let i = 0; i < firstWeekday; i += 1) {
    const day = prevMonthDays - firstWeekday + 1 + i;
    cells.push({ iso: toIso(viewYear, viewMonth - 1, day), day, outside: true });
  }
  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push({ iso: toIso(viewYear, viewMonth, day), day, outside: false });
  }
  while (cells.length < 42) {
    const day = cells.length - (firstWeekday + daysInMonth) + 1;
    cells.push({ iso: toIso(viewYear, viewMonth + 1, day), day, outside: true });
  }

  function shiftMonth(delta: number) {
    const next = new Date(viewYear, viewMonth - 1 + delta, 1);
    setViewYear(next.getFullYear());
    setViewMonth(next.getMonth() + 1);
  }

  const today = brasiliaTodayIso();

  return (
    <div className="origem-calendar" role="dialog" aria-label="Calendário">
      <div className="origem-calendar-head">
        <button type="button" onClick={() => shiftMonth(-1)} aria-label="Mês anterior">
          ‹
        </button>
        <strong>
          {MONTHS[viewMonth - 1]} de {viewYear}
        </strong>
        <button type="button" onClick={() => shiftMonth(1)} aria-label="Próximo mês">
          ›
        </button>
      </div>
      <div className="origem-calendar-week">
        {WEEKDAYS.map((day, index) => (
          <span key={`${day}-${index}`}>{day}</span>
        ))}
      </div>
      <div className="origem-calendar-grid">
        {cells.map((cell) => (
          <button
            key={cell.iso}
            type="button"
            className={`${cell.outside ? 'outside' : ''} ${cell.iso === value ? 'selected' : ''}`}
            disabled={cell.iso < min || cell.iso > max}
            onClick={() => onSelect(cell.iso)}
          >
            {cell.day}
          </button>
        ))}
      </div>
      <div className="origem-calendar-foot">
        <button
          type="button"
          disabled={today < min || today > max}
          onClick={() => onSelect(today)}
        >
          Hoje
        </button>
      </div>
    </div>
  );
}

function OrigemDateField({
  label,
  display,
  iso,
  min,
  max,
  onTyped,
  onPicked,
}: {
  label: string;
  display: string;
  iso: string;
  min: string;
  max: string;
  onTyped: (value: string) => void;
  onPicked: (iso: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const fieldRef = useRef<HTMLLabelElement>(null);

  useEffect(() => {
    if (!open) return;
    function close(event: Event) {
      if (!fieldRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  return (
    <label className="origem-date-label" ref={fieldRef}>
      {label}
      <div className="origem-date-field">
        <input
          type="text"
          inputMode="numeric"
          placeholder="dd/mm/aaaa"
          value={display}
          onChange={(event) => onTyped(maskBrDate(event.target.value))}
          onClick={() => setOpen(true)}
        />
        <button
          type="button"
          className="origem-date-calendar"
          aria-label={`Abrir calendário de ${label.toLowerCase()}`}
          onClick={() => setOpen((current) => !current)}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="5" width="18" height="16" rx="2" />
            <path d="M8 3v4M16 3v4M3 11h18" />
          </svg>
        </button>
        {open && (
          <OrigemCalendar
            value={iso}
            min={min}
            max={max}
            onSelect={(next) => {
              onPicked(next);
              setOpen(false);
            }}
          />
        )}
      </div>
    </label>
  );
}

const initialRange = rangeForPreset('7d');

export function OrigemDashboard() {
  const [preset, setPreset] = useState<PeriodPreset | 'custom'>('7d');
  const [fromDisplay, setFromDisplay] = useState(isoToBr(initialRange.from));
  const [toDisplay, setToDisplay] = useState(isoToBr(initialRange.to));
  const [queryRange, setQueryRange] = useState(initialRange);
  const [data, setData] = useState<DashboardData | null>(null);
  const [periodOpen, setPeriodOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const periodRef = useRef<HTMLDivElement>(null);

  const parsedFrom = brToIso(fromDisplay);
  const parsedTo = brToIso(toDisplay);

  useEffect(() => {
    function close(event: Event) {
      if (!periodRef.current?.contains(event.target as Node)) setPeriodOpen(false);
    }
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  useEffect(() => {
    if (!parsedFrom || !parsedTo) return;
    const next = clampOrigemRange(parsedFrom, parsedTo);
    setQueryRange((current) =>
      current.from === next.from && current.to === next.to ? current : next
    );
    const nextFrom = isoToBr(next.from);
    const nextTo = isoToBr(next.to);
    if (fromDisplay !== nextFrom) setFromDisplay(nextFrom);
    if (toDisplay !== nextTo) setToDisplay(nextTo);
  }, [parsedFrom, parsedTo, fromDisplay, toDisplay]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setIsLoading(true);
      setErrorMessage('');
      try {
        const params = new URLSearchParams({ from: queryRange.from, to: queryRange.to });
        const response = await fetch(`/api/tracker-leads?${params.toString()}`);
        const payload = await response.json();
        if (!response.ok || !payload.success) {
          throw new Error(payload.message || 'Não foi possível carregar o dashboard.');
        }
        if (!cancelled) setData(payload);
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(
            error instanceof Error ? error.message : 'Erro ao carregar o dashboard.'
          );
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [queryRange.from, queryRange.to]);

  function applyPreset(next: PeriodPreset) {
    const selected = rangeForPreset(next);
    setPreset(next);
    setFromDisplay(isoToBr(selected.from));
    setToDisplay(isoToBr(selected.to));
  }

  return (
    <div className="origem-dashboard">
      <div className="origem-filters">
        <div className="origem-period" ref={periodRef}>
          Período
          <button
            type="button"
            className="origem-period-trigger"
            aria-haspopup="listbox"
            aria-expanded={periodOpen}
            onClick={() => setPeriodOpen((open) => !open)}
          >
            {periodLabel(preset)}
            <span aria-hidden>▾</span>
          </button>
          {periodOpen && (
            <ul className="origem-period-menu" role="listbox">
              {PERIOD_OPTIONS.map((option) => (
                <li key={option.value}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={preset === option.value}
                    onClick={() => {
                      applyPreset(option.value);
                      setPeriodOpen(false);
                    }}
                  >
                    {option.label}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <OrigemDateField
          label="Data inicial"
          display={fromDisplay}
          iso={parsedFrom || queryRange.from}
          min={addMonthsIso(queryRange.to, -3)}
          max={queryRange.to}
          onTyped={(value) => {
            setPreset('custom');
            setFromDisplay(value);
          }}
          onPicked={(iso) => {
            setPreset('custom');
            setFromDisplay(isoToBr(iso));
          }}
        />
        <OrigemDateField
          label="Data final"
          display={toDisplay}
          iso={parsedTo || queryRange.to}
          min={queryRange.from}
          max={brasiliaTodayIso()}
          onTyped={(value) => {
            setPreset('custom');
            setToDisplay(value);
          }}
          onPicked={(iso) => {
            setPreset('custom');
            setToDisplay(isoToBr(iso));
          }}
        />
      </div>

      {isLoading && <p className="subtitle">Carregando origem dos candidatos…</p>}
      {errorMessage && <div className="message error">{errorMessage}</div>}
      {!isLoading && !errorMessage && data && data.total === 0 && (
        <p className="subtitle">Nenhum lead nesse período.</p>
      )}

      {!isLoading && !errorMessage && data && data.total > 0 && (
        <>
          <div className="origem-kpi">
            <span>Total de leads</span>
            <strong>{data.total}</strong>
          </div>

          <section>
            <h2>Canais</h2>
            <CanalPie origens={data.origens} />
          </section>

          <section>
            <h2>Campanhas</h2>
            {data.campanhas.length === 0 ? (
              <p className="subtitle">Nenhuma campanha nomeada nesse período.</p>
            ) : (
              <ul className="origem-campaigns">
                {data.campanhas.map((item) => (
                  <li key={`${item.origem}-${item.campanha}`}>
                    <div>
                      <strong>{item.campanha}</strong>
                      <span>{item.origem}</span>
                    </div>
                    <em>{item.quantidade}</em>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}
