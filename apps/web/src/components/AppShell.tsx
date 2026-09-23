import { NavLink, Outlet } from 'react-router-dom';
import { useAuthStore } from '@/stores/auth';
import { NotificationDropdown } from '@/features/collaboration/NotificationDropdown';

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `rounded-md px-3 py-2 text-sm font-medium transition ${
    isActive ? 'bg-accent text-white' : 'text-ink-700 hover:bg-white/70'
  }`;

export function AppShell() {
  const { user, currentOrg, currentRole, memberships, switchOrganization, logout } = useAuthStore();

  return (
    <div className="min-h-screen">
      {/* Mobile Top Navigation */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-ink-100 bg-white/95 px-4 py-3 backdrop-blur md:hidden">
        <div className="flex items-center gap-2">
          <span className="font-serif text-lg font-bold text-ink-950">CML</span>
          {memberships.length > 1 ? (
            <select
              className="max-w-[140px] rounded-md border border-ink-100 bg-white px-1 py-0.5 text-xs text-ink-700"
              value={currentOrg?.id ?? ''}
              onChange={(event) => switchOrganization(event.target.value)}
            >
              {memberships.map((membership) =>
                membership.organization ? (
                  <option key={membership.id} value={membership.organization.id}>
                    {membership.organization.name}
                  </option>
                ) : null,
              )}
            </select>
          ) : (
            <span className="text-xs text-ink-500">{currentOrg?.name}</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <NotificationDropdown />
          <div className="flex items-center gap-1 overflow-x-auto text-xs">
            <NavLink to="/dashboard" className={linkClass}>
              Dashboard
            </NavLink>
            <NavLink to="/contracts" className={linkClass}>
              Contracts
            </NavLink>
            <NavLink to="/settings" className={linkClass}>
              Org
            </NavLink>
          </div>
        </div>
      </header>

      <div className="mx-auto flex min-h-screen max-w-7xl gap-6 px-4 py-6 md:px-6">
        <aside className="hidden w-60 shrink-0 rounded-2xl border border-ink-100 bg-white/80 p-4 shadow-sm md:block">
          <div className="mb-8">
            <p className="font-serif text-2xl font-bold tracking-tight text-ink-950">CML</p>
            <p className="mt-0.5 text-xs text-ink-500">Contract Lifecycle Platform</p>
          </div>
          <nav className="flex flex-col gap-1">
            <NavLink to="/dashboard" className={linkClass}>
              Dashboard
            </NavLink>
            <NavLink to="/contracts" className={linkClass}>
              Contracts
            </NavLink>
            <NavLink to="/settings" className={linkClass}>
              Organization
            </NavLink>
            <NavLink to="/profile" className={linkClass}>
              Profile
            </NavLink>
          </nav>
          <div className="mt-10 border-t border-ink-100 pt-4 text-xs">
            {memberships.length > 1 ? (
              <label className="block">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-ink-400">
                  Workspace
                </span>
                <select
                  className="mt-1 w-full rounded-lg border border-ink-100 bg-white px-2 py-1.5 text-xs font-semibold text-ink-900"
                  value={currentOrg?.id ?? ''}
                  onChange={(event) => switchOrganization(event.target.value)}
                >
                  {memberships.map((membership) =>
                    membership.organization ? (
                      <option key={membership.id} value={membership.organization.id}>
                        {membership.organization.name}
                      </option>
                    ) : null,
                  )}
                </select>
              </label>
            ) : (
              <p className="font-bold text-ink-900">{currentOrg?.name ?? 'No organization'}</p>
            )}
            <p className="mt-2 text-ink-500">{user?.name}</p>
            <p className="capitalize text-ink-500">{currentRole ?? '—'}</p>
            <button
              type="button"
              onClick={() => void logout()}
              className="mt-4 text-xs font-semibold text-accent hover:underline"
            >
              Log out
            </button>
          </div>
        </aside>

        <div className="flex flex-1 flex-col gap-4">
          {/* Top Bar with Search & Notifications */}
          <div className="hidden md:flex items-center justify-between rounded-2xl border border-ink-100 bg-white px-6 py-3 shadow-2xs">
            <div className="text-xs text-ink-500">
              Workspace:{' '}
              {memberships.length > 1 ? (
                <select
                  className="ml-1 rounded-md border border-ink-100 bg-white px-2 py-1 text-xs font-semibold text-ink-800"
                  value={currentOrg?.id ?? ''}
                  onChange={(event) => switchOrganization(event.target.value)}
                >
                  {memberships.map((membership) =>
                    membership.organization ? (
                      <option key={membership.id} value={membership.organization.id}>
                        {membership.organization.name}
                      </option>
                    ) : null,
                  )}
                </select>
              ) : (
                <strong className="text-ink-800">{currentOrg?.name}</strong>
              )}{' '}
              • Role: <span className="capitalize font-semibold text-ink-800">{currentRole}</span> • Logged
              in as <strong className="text-ink-800">{user?.name}</strong>
            </div>

            <div className="flex items-center gap-3">
              <NotificationDropdown />
            </div>
          </div>

          <main className="flex-1 rounded-2xl border border-ink-100 bg-white/95 p-5 shadow-sm md:p-8">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}
