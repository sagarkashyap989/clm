import { Link } from 'react-router-dom';
import { buttonClass } from '@/components/ui';

export function LandingPage() {
  return (
    <div className="mx-auto flex min-h-screen max-w-4xl flex-col justify-center px-6 py-16">
      <p className="font-display text-5xl font-semibold text-ink-950 md:text-6xl">CML</p>
      <h1 className="mt-4 max-w-2xl text-3xl font-semibold text-ink-900 md:text-4xl">
        Contract Management for real teams
      </h1>
      <p className="mt-4 max-w-xl text-lg text-ink-500">
        Securely upload, search, edit, share, and collaborate on contracts in one
        workspace. Phase 1 ships authentication, organizations, and RBAC.
      </p>
      <div className="mt-8 flex flex-wrap gap-3">
        <Link to="/register" className={`${buttonClass} w-auto px-6`}>
          Get started
        </Link>
        <Link
          to="/login"
          className="inline-flex items-center rounded-lg border border-ink-100 bg-white px-6 py-2.5 text-sm font-semibold text-ink-900"
        >
          Sign in
        </Link>
      </div>
    </div>
  );
}
