import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect, type ReactNode } from 'react';
import { AppRouter } from '@/app/router';
import { useAuthStore } from '@/stores/auth';

const queryClient = new QueryClient();

function BootstrapAuth({ children }: { children: ReactNode }) {
  const bootstrap = useAuthStore((s) => s.bootstrap);

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  return children;
}

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BootstrapAuth>
        <AppRouter />
      </BootstrapAuth>
    </QueryClientProvider>
  );
}
