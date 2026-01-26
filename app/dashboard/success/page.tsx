
"use client";

import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { CheckCircle, Map, ArrowRight, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import confetti from 'canvas-confetti';

export default function SuccessPage() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("session_id");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (sessionId) {
      // Confetti effect
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#2563eb', '#22c55e', '#f59e0b']
      });
      
      // Simulate verification delay (webhook processing)
      const timer = setTimeout(() => setLoading(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [sessionId]);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 max-w-lg w-full rounded-2xl shadow-xl border border-zinc-200 dark:border-slate-800 p-8 text-center">
        
        <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
          <CheckCircle className="w-8 h-8 text-green-600 dark:text-green-400" />
        </div>

        <h1 className="text-2xl font-bold text-foreground mb-2">Payment Successful!</h1>
        <p className="text-slate-500 dark:text-slate-400 mb-8">
          Your territory access has been secured. You can now access your detailed parcel data.
        </p>

        {loading ? (
            <div className="flex items-center justify-center gap-2 text-sm text-slate-400 mb-6 bg-slate-50 dark:bg-slate-800/50 p-3 rounded-lg animate-pulse">
                <Loader2 className="w-4 h-4 animate-spin" />
                Finalizing account setup...
            </div>
        ) : (
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-xl p-4 mb-8 text-left flex items-start gap-3">
                <div className="p-2 bg-blue-100 dark:bg-blue-800 rounded-lg">
                    <Map className="w-5 h-5 text-blue-600 dark:text-blue-300" />
                </div>
                <div>
                    <h3 className="font-semibold text-blue-900 dark:text-blue-200 text-sm">Ready to Scout</h3>
                    <p className="text-xs text-blue-700 dark:text-blue-400 mt-1">
                        Your quota has been updated. Navigate to the Territories page to view your data.
                    </p>
                </div>
            </div>
        )}

        <Link 
            href="/territories" 
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg hover:shadow-blue-600/25"
        >
            Go to Territories
            <ArrowRight className="w-4 h-4" />
        </Link>
        
      </div>
    </div>
  );
}
