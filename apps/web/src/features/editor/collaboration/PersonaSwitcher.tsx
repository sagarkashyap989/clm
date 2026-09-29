import { useState, type FC } from 'react';
import { useAuthStore } from '@/stores/auth';
import { getUserColor } from '@/lib/userColor';

const DEMO_PERSONAS = [
  {
    id: 'usr_demo',
    name: 'Administrator',
    email: 'admin@example.com',
    role: 'admin',
    color: getUserColor('usr_demo'),
  },
  {
    id: 'usr_2',
    name: 'Sakshi Soni',
    email: 'sakshi@example.com',
    role: 'legal_counsel',
    color: getUserColor('usr_2'),
  },
  {
    id: 'usr_dsk',
    name: 'DSK Legal',
    email: 'dsk@example.com',
    role: 'external_counsel',
    color: getUserColor('usr_dsk'),
  },
  {
    id: 'usr_3',
    name: 'John Doe',
    email: 'john@example.com',
    role: 'member',
    color: getUserColor('usr_3'),
  },
  {
    id: 'usr_viewer',
    name: 'Auditor View-Only',
    email: 'viewer@example.com',
    role: 'viewer',
    color: getUserColor('usr_viewer'),
  },
];

interface PersonaSwitcherProps {
  onSwitchPersona?: (user: (typeof DEMO_PERSONAS)[0]) => void;
}

export const PersonaSwitcher: FC<PersonaSwitcherProps> = ({ onSwitchPersona }) => {
  const { user, setSession, currentOrg } = useAuthStore();
  const [isOpen, setIsOpen] = useState(false);

  const currentPersona =
    DEMO_PERSONAS.find((p) => p.id === user?.id) || {
      id: user?.id || 'usr_demo',
      name: user?.name || 'Administrator',
      email: user?.email || 'admin@example.com',
      role: 'admin',
      color: getUserColor(user?.id || user?.name || user?.email),
    };

  function selectPersona(persona: (typeof DEMO_PERSONAS)[0]) {
    setSession({
      user: {
        id: persona.id,
        name: persona.name,
        email: persona.email,
        emailVerified: true,
      },
      organization: currentOrg || { id: 'org_demo', name: 'Acme Contracts Corp' },
      role: persona.role,
    });
    onSwitchPersona?.(persona);
    setIsOpen(false);
  }

  return (
    <div className="relative inline-block text-left">
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex items-center gap-1.5 rounded-lg border border-ink-200 bg-white px-2.5 py-1 text-xs font-semibold text-ink-700 shadow-xs hover:bg-slate-50"
        title="Switch persona to test real-time multi-user collaboration"
      >
        <span
          className="h-2 w-2 rounded-full"
          style={{ backgroundColor: currentPersona.color }}
        />
        <span>Editing as: <strong className="text-ink-900">{currentPersona.name}</strong></span>
        <span className="text-[10px] text-ink-400">({currentPersona.role})</span>
        <svg className="h-3 w-3 text-ink-400" viewBox="0 0 20 20" fill="currentColor">
          <path
            fillRule="evenodd"
            d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
            clipRule="evenodd"
          />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute right-0 z-40 mt-1 w-60 rounded-xl border border-ink-100 bg-white p-1.5 shadow-xl">
          <div className="border-b border-ink-100 px-2.5 py-1.5 text-[11px] font-bold uppercase tracking-wider text-ink-400">
            Multi-User Testing Personas
          </div>
          <div className="mt-1 space-y-0.5">
            {DEMO_PERSONAS.map((p) => {
              const isActive = p.id === currentPersona.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => selectPersona(p)}
                  className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-xs transition ${
                    isActive ? 'bg-accent/10 font-bold text-accent' : 'text-ink-700 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: p.color }}
                    />
                    <div>
                      <p className="font-semibold text-ink-900">{p.name}</p>
                      <p className="text-[10px] text-ink-400">{p.email}</p>
                    </div>
                  </div>
                  <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] uppercase font-semibold text-ink-600">
                    {p.role}
                  </span>
                </button>
              );
            })}
          </div>
          <div className="mt-2 border-t border-ink-100 p-2 text-[10px] text-ink-400">
            Tip: Open this contract in two separate browser tabs to test live cursor tracking and concurrent edits.
          </div>
        </div>
      )}
    </div>
  );
};
