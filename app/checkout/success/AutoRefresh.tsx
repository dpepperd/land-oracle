'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

// Re-runs the server page every few seconds while we wait for the payment to finish syncing, then gives up politely.
export default function AutoRefresh({ everyMs = 3000, maxTries = 10 }: { everyMs?: number; maxTries?: number }) {
  const router = useRouter();
  const [tries, setTries] = useState(0);
  useEffect(() => {
    if (tries >= maxTries) return;
    const t = setTimeout(() => { setTries((n) => n + 1); router.refresh(); }, everyMs);
    return () => clearTimeout(t);
  }, [tries, router, everyMs, maxTries]);

  if (tries < maxTries) return null;
  return (
    <div className="space-y-3">
      <p className="text-slate-300">This is taking longer than usual. If you were charged, your plan will turn on within a few minutes.</p>
      <Link href="/dashboard" className="inline-block px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 font-semibold">Go to dashboard</Link>
    </div>
  );
}
