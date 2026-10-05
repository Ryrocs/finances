'use client';

import { useEffect } from 'react';
import { ErrorState } from '@/components/ui/States';

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <div className="pt-[calc(var(--safe-top)+2rem)]">
      <ErrorState error={error} onRetry={reset} />
    </div>
  );
}
