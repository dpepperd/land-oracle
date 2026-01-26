"use client";

import { FLORIDA_COUNTIES } from "@/lib/counties";
import { Check, Lock, Loader2, AlertCircle } from "lucide-react";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";

export default function TerritoryGrid() {
  const { isSignedIn, isLoaded } = useUser();
  const router = useRouter();
  
  const [userData, setUserData] = useState<{
    tier: string;
    quota: number;
    used: number;
    selected: string[];
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const [message, setMessage] = useState<{type: 'success' | 'error', text: string} | null>(null);

  useEffect(() => {
    if (isLoaded) {
      if (isSignedIn) {
        fetchCounties();
      } else {
        setLoading(false); // Public mode, no fetch needed
      }
    }
  }, [isLoaded, isSignedIn]);

  const fetchCounties = async () => {
    try {
      const res = await fetch('/api/user/counties');
      if (res.ok) {
        setUserData(await res.json());
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const toggleCounty = async (county: string) => {
    // PUBLIC MODE: Redirect to Sign Up
    if (!isSignedIn) {
      router.push('/sign-up?intent=claim');
      return;
    }

    if (!userData) return;
    
    // Checked? Ignore (can't uncheck per current logic)
    if (userData.selected.includes(county)) return;

    // Quota Full?
    if (userData.used >= userData.quota) {
      setMessage({ type: 'error', text: `Limit reached (${userData.quota}). Upgrade to add more.` });
      return;
    }

    setProcessing(county);
    setMessage(null);

    try {
      const res = await fetch('/api/user/counties', {
        method: 'POST',
        body: JSON.stringify({ county }),
      });

      if (res.ok) {
        const data = await res.json();
        setUserData(prev => prev ? ({
          ...prev,
          used: data.used,
          selected: [...prev.selected, county]
        }) : null);
        setMessage({ type: 'success', text: `${county} claimed!` });
      } else {
        const txt = await res.text();
        setMessage({ type: 'error', text: txt });
      }
    } catch (e) {
      setMessage({ type: 'error', text: "Failed to update." });
    } finally {
      setProcessing(null);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center p-12">
        <Loader2 className="w-8 h-8 animate-spin text-zinc-500" />
      </div>
    );
  }

  // Derived State
  const remaining = userData ? userData.quota - userData.used : 0;
  const percentage = userData ? Math.min(100, (userData.used / userData.quota) * 100) : 0;
  const LIVE_COUNTIES = ['Baker'];

  return (
    <div className="max-w-6xl mx-auto">
      
      {/* Header / Stats Block */}
      <div className="mb-8 border-b border-zinc-200 dark:border-zinc-800 pb-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold mb-2 text-foreground">
              {isSignedIn ? "Manage Territories" : "Territory Availability"}
            </h1>
            <p className="text-[var(--text-secondary)]">
              {isSignedIn 
                ? "Select counties to access. Changes are permanent for this billing cycle." 
                : "Select a county to verify availability and claim your exclusive access."}
            </p>
          </div>

          <div className="bg-white dark:bg-slate-800 border border-zinc-200 dark:border-slate-700 p-4 rounded-xl shadow-sm min-w-[280px]">
            {isSignedIn ? (
              // AUTHED STATS
              <>
                <div className="flex justify-between items-center mb-2">
                    <span className="font-semibold text-foreground">{userData?.tier.toUpperCase()} PLAN</span>
                    <Link href="/pricing" className="text-xs text-blue-600 hover:underline">Upgrade</Link>
                </div>
                <div className="text-sm text-[var(--text-secondary)] mb-1">
                    {userData?.used} of {userData?.quota} Counties Used
                </div>
                <div className="w-full bg-zinc-100 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
                    <div 
                    className="bg-blue-600 h-full rounded-full transition-all duration-500" 
                    style={{ width: `${percentage}%` }}
                    />
                </div>
              </>
            ) : (
                // PUBLIC Call To Action
              <>
                <div className="flex justify-between items-center mb-2">
                    <span className="font-semibold text-foreground">Start claiming today</span>
                </div>
                <p className="text-xs text-[var(--text-secondary)] mb-3">
                    Lock down your market before competitors do.
                </p>
                <Link 
                    href="/sign-up"
                    className="block w-full text-center py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
                >
                    Create Account
                </Link>
              </>
            )}
          </div>
        </div>
        
        {message && (
          <div className={`mt-4 p-3 rounded-lg text-sm flex items-center gap-2 animate-in fade-in slide-in-from-top-2 ${
            message.type === 'success' 
                ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' 
                : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
          }`}>
            {message.type === 'success' ? <Check className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
            {message.text}
          </div>
        )}
      </div>

      {/* The Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
        {FLORIDA_COUNTIES.map(county => {
          const isSelected = userData?.selected.includes(county) ?? false;
          const isLive = LIVE_COUNTIES.includes(county);
          const isProcessing = processing === county;

          // If public, nothing is "Selected", everything is clickable (to sign up)
          // If private, follow quota rules
          const isDisabled = isSignedIn 
            ? (isSelected || (remaining === 0 && !isSelected) || isProcessing) 
            : false; // Public users can always click (to go to signup)

          return (
            <button
              key={county}
              disabled={isDisabled}
              onClick={() => toggleCounty(county)}
              className={`
                relative p-4 rounded-lg text-left transition-all duration-200 border flex flex-col justify-between min-h-[100px] group
                ${isSelected 
                  ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 ring-1 ring-blue-500/50' 
                  : 'bg-white dark:bg-slate-800 border-zinc-200 dark:border-slate-700 hover:border-blue-400 dark:hover:border-blue-500 hover:shadow-md'
                }
                ${isDisabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}
              `}
            >
              <div className="flex justify-between items-start w-full">
                <span className={`font-semibold ${isSelected ? 'text-blue-700 dark:text-blue-300' : 'text-foreground'}`}>
                  {county}
                </span>
                {isSelected && <Check className="w-4 h-4 text-blue-600" />}
                {!isSelected && isSignedIn && remaining === 0 && <Lock className="w-4 h-4 text-[var(--text-secondary)]" />}
                {isProcessing && <Loader2 className="w-4 h-4 animate-spin text-blue-600" />}
              </div>
              
              <div className="mt-2 text-xs">
                {isLive ? (
                   <span className="flex items-center gap-1 text-green-600 dark:text-green-400 font-medium">
                     <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                     Live Data
                   </span>
                ) : (
                  <span className="text-[var(--text-secondary)] italic group-hover:text-foreground transition-colors">
                     {isSignedIn ? "Coming Soon" : "Check Status"}
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
