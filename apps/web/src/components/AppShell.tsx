import { NavLink, Outlet } from 'react-router-dom';
import { useAuthStore } from '@/stores/auth';

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `rounded-md px-3 py-2 text-sm font-medium transition ${
    isActive ? 'bg-accent text-white' : 'text-ink-700 hover:bg-white/70'
  }`;

export function AppShell() {
  const { user, currentOrg, currentRole, logout } = useAuthStore();

  return (
    <div className="min-h-screen">
      <div className="mx-auto flex min-h-screen max-w-6xl gap-6 px-4 py-6 md:px-6">
        <aside className="hidden w-60 shrink-0 rounded-2xl border border-ink-100 bg-white/80 p-4 shadow-sm md:block">
          <div className="mb-8">
            <p className="font-display text-2xl font-semibold text-ink-950">CML</p>
            <p className="mt-1 text-sm text-ink-500">Contract workspace</p>
          </div>
          <nav className="flex flex-col gap-1">
            <NavLink to="/dashboard" className={linkClass}>
              Dashboard
            </NavLink>
            <NavLink to="/settings" className={linkClass}>
              Organization
            </NavLink>
            <NavLink to="/profile" className={linkClass}>
              Profile
            </NavLink>
          </nav>
          <div className="mt-10 border-t border-ink-100 pt-4 text-sm">
            <p className="font-medium text-ink-900">{currentOrg?.name ?? 'No organization'}</p>
            <p className="text-ink-500">{user?.name}</p>
            <p className="capitalize text-ink-500">{currentRole ?? '—'}</p>
            <button
              type="button"
              onClick={() => void logout()}
              className="mt-4 text-sm font-medium text-accent hover:underline"
            >
              Log out
            </button>
          </div>
        </aside>
        <main className="flex-1 rounded-2xl border border-ink-100 bg-white/90 p-5 shadow-sm md:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
