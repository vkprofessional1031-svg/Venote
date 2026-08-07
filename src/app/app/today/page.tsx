'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function TodayRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/app/schedule');
  }, [router]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary-accent"></div>
    </div>
  );
}
