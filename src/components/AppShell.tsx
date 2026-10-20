'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ThemeToggle } from './ThemeToggle';

const NAV_ITEMS: { href: string; label: string; document?: boolean }[] = [
  { href: '/', label: 'Vagas próximas' },
  { href: '/so-contrato', label: 'Só contrato' },
  { href: '/origem', label: 'Origem' },
  { href: '/ativacao-cruzeiro', label: 'Ativação Cruzeiro' },
  { href: '/ativacao-infojobs', label: 'Ativação Infojobs', document: true },
  { href: '/banco-candidatos', label: 'Banco de Candidatos' },
  { href: '/gerador-curriculo', label: 'Gerador de currículo' },
  { href: '/gerador-tce', label: 'Gerador de TCE', document: true },
  { href: '/grupos-empresas', label: 'Grupos, Empresas e Vagas' },
  { href: '/consultar-vagas', label: 'Consultar vagas' },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const hideSidebar =
    pathname.startsWith('/banco-candidatos/documento') || pathname.startsWith('/banco-candidatos/previa');

  return (
    <div className={`app-shell${hideSidebar ? ' app-shell-print' : ''}`}>
      {hideSidebar ? null : (
      <aside className="sidebar">
        <div className="sidebar-brand">
          <Image
            src="/logo-dna.png"
            alt="DNA Work"
            width={140}
            height={42}
            priority
            className="logo"
          />
        </div>

        <nav className="sidebar-nav">
          {NAV_ITEMS.map((item) => {
            const isActive =
              item.href === '/'
                ? pathname === '/'
                : pathname.startsWith(item.href);

            const className = `sidebar-link${isActive ? ' active' : ''}`;
            if (item.document) {
              return (
                <a key={item.href} href={item.href} className={className}>
                  {item.label}
                </a>
              );
            }

            return (
              <Link
                key={item.href}
                href={item.href}
                prefetch={process.env.NODE_ENV === 'production'}
                className={className}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          <ThemeToggle />
        </div>
      </aside>
      )}

      <div className="app-content">{children}</div>
    </div>
  );
}
