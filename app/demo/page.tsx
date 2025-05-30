'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from "lucide-react";

export default function DemoChatRedirect() {
  const router = useRouter();

  useEffect(() => {
    const startDemo = async () => {
      try {
        const res = await fetch('/demo/api/seed', {
          method: 'GET',
          redirect: 'follow'
        });

        // If Next.js can't follow server redirect, extract final URL
        if (res.redirected) {
          router.push(res.url);
        } else {
          const { chatId } = await res.json();
          router.push(`/demo/${chatId}`);
        }
      } catch (error) {
        console.error('Failed to start demo:', error);
        router.push('/'); // fallback
      }
    };

    startDemo();
  }, [router]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background">
      <div className="flex flex-col items-center gap-4 p-8 text-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <h1 className="text-2xl font-semibold text-foreground">
          Setting up your demo chat
        </h1>
        <p className="text-sm text-muted-foreground">
          This will only take a moment...
        </p>
      </div>
    </div>
  );
}
