"use client";

import { FLORIDA_COUNTIES } from "@/lib/counties";
import { Check, Lock, Loader2, AlertCircle, ShoppingCart } from "lucide-react";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import CheckoutModal from "@/components/paywall/CheckoutModal"; // Import Modal

export default function TerritoryGrid({ isSidebar = false }: { isSidebar?: boolean }) {
  const { isSignedIn, isLoaded } = useUser();
  const router = useRouter();
  
  const [userData, setUserData] = useState<{
    tier: string;
    quota: number;
    used: number;
    selected: string[];
    liveCounties?: string[]; // Automation
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const [message, setMessage] = useState<{type: 'success' | 'error', text: string} | null>(null);
  
  // Checkout State
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [stagedCounties, setStagedCounties] = useState<string[]>([]);

  useEffect(() => {
    if (isLoaded) {
       // Always fetch to get "Live" status, even for guest
       fetchCounties();
    }
  }, [isLoaded, isSignedIn]);

  // Sync staged with selected initialized
  useEffect(() => {
    if (userData) {
        setStagedCounties(userData.selected);
    }
  }, [userData]);

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

    // Toggle Staged Logic (Client Side First)
    if (stagedCounties.includes(county)) {
        // Unselect (for checkout review)
        setStagedCounties(prev => prev.filter(c => c !== county));
    } else {
        // Select
        setStagedCounties(prev => [...prev, county]);
    }
  };

  // Fetch Counts
  const [parcelCounts, setParcelCounts] = useState<Record<string, number>>({});
  
  useEffect(() => {
    fetch('/api/parcels/stats')
      .then(res => res.json())
      .then(data => setParcelCounts(data))
      .catch(err => console.error("Failed to load stats", err));
  }, []);

  const formatCount = (num: number) => {
    if (!num) return '';
    if (num >= 1000) return `${(num / 1000).toFixed(1)}k`;
    return num.toString();
  };

  if (loading) {
    return (
      <div className="flex justify-center p-12">
        <Loader2 className="w-8 h-8 animate-spin text-zinc-500" />
      </div>
    );
  }

  // Derived State
  const percentage = userData ? Math.min(100, (userData.used / userData.quota) * 100) : 0;
  const LIVE_COUNTIES = userData?.liveCounties || [];
  
  // Checkout Logic: If staged > quota or staged !== selected, enable checkout
  const hasChanges = userData ? JSON.stringify(stagedCounties.sort()) !== JSON.stringify(userData.selected.sort()) : false;
  const showCheckout = hasChanges && stagedCounties.length > 0;

  return (
    <div className={isSidebar ? "p-4" : "max-w-6xl mx-auto"}>
      
      {/* Header / Stats Block */}
      <div className={`mb-6 border-b border-zinc-200 dark:border-zinc-800 pb-4 ${isSidebar ? 'text-center' : ''}`}>
          {!isSidebar && <h1 className="text-3xl font-bold mb-2 text-foreground">{isSignedIn ? "Manage Territories" : "Territory Availability"}</h1>}
          
          <div className={`bg-white dark:bg-slate-800 border border-zinc-200 dark:border-slate-700 p-4 rounded-xl shadow-sm ${isSidebar ? 'text-left' : 'min-w-[280px]'}`}>
            {isSignedIn ? (
              // AUTHED STATS
              <>
                <div className="flex justify-between items-center mb-2">
                    <span className="font-semibold text-foreground text-sm">{userData?.tier.toUpperCase()} PLAN</span>
                    <Link href="/pricing" className="text-xs text-blue-600 hover:underline">Upgrade</Link>
                </div>
                <div className="text-xs text-[var(--text-secondary)] mb-1">
                    {stagedCounties.length} Selected (Current Quota: {userData?.quota})
                </div>
                <div className="w-full bg-zinc-100 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
                    <div 
                    className="bg-blue-600 h-full rounded-full transition-all duration-500" 
                    style={{ width: `${Math.min(100, (stagedCounties.length / (userData?.quota || 1)) * 100)}%` }}
                    />
                </div>
              </>
            ) : (
                // PUBLIC Call To Action
              <>
                <div className="flex justify-between items-center mb-2">
                    <span className="font-semibold text-foreground text-sm">Start claiming today</span>
                </div>
                <Link 
                    href="/sign-up"
                    className="block w-full text-center py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
                >
                    Create Account
                </Link>
              </>
            )}
          </div>
          
        {/* Checkout Button (Sticky Bottom or Inline) */}
        {showCheckout && (
            <div className="mt-4 animate-in slide-in-from-top-2 fade-in">
                <button
                    onClick={() => setIsCheckoutOpen(true)}
                    className="w-full py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl shadow-lg shadow-green-600/20 font-bold flex items-center justify-center gap-2 transition-all hover:scale-[1.02]"
                >
                    <ShoppingCart className="w-5 h-5" />
                    Review & Checkout ({stagedCounties.length} Selected)
                </button>
                <div className="text-center mt-2 text-xs text-slate-500">
                    Includes access to {stagedCounties.length} counties
                </div>
            </div>
        )}

      </div>

      {/* The Grid: 2 columns if sidebar, else responsive 6 */}
      <div className={`grid gap-2 mb-20 ${isSidebar ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-2 md:grid-cols-4 lg:grid-cols-6'}`}>
        {FLORIDA_COUNTIES.map(county => {
          const isSelected = stagedCounties.includes(county);
          const isLive = LIVE_COUNTIES.includes(county);
          const isProcessing = processing === county; 
          const count = parcelCounts[county];

          return (
            <button
              key={county}
              onClick={() => toggleCounty(county)}
              className={`
                relative p-3 rounded-lg text-left transition-all duration-200 border flex items-center justify-between group
                ${isSelected 
                  ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800' 
                  : 'bg-white dark:bg-slate-800 border-zinc-200 dark:border-slate-700 hover:border-blue-400'
                }
                cursor-pointer hover:shadow-sm
              `}
            >
              <div className="flex flex-col">
                <span className={`font-semibold text-sm ${isSelected ? 'text-blue-700 dark:text-blue-300' : 'text-foreground'}`}>
                  {county}
                </span>
                 <div className="text-[10px] mt-0.5">
                {isLive ? (
                   <div className="flex flex-col">
                     <span className="flex items-center gap-1 text-green-600 dark:text-green-400 font-medium whitespace-nowrap">
                       <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                       Live
                     </span>
                     {count && (
                        <span className="text-zinc-500 dark:text-zinc-400 font-mono text-[9px]">
                            {formatCount(count)}
                        </span>
                     )}
                   </div>
                ) : (
                  <span className="text-[var(--text-secondary)] italic">
                     {isSignedIn ? "Soon" : "Check"}
                  </span>
                )}
              </div>
              </div>
             
              {isSelected && <Check className="w-4 h-4 text-blue-600" />}
              {isProcessing && <Loader2 className="w-4 h-4 animate-spin text-blue-600" />}
            </button>
          );
        })}
      </div>

      {/* Checkout Modal */}
      <CheckoutModal 
        isOpen={isCheckoutOpen} 
        onClose={() => setIsCheckoutOpen(false)} 
        selectedCounties={stagedCounties}
      />
    </div>
  );
}
