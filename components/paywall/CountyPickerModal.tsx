'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import { checkEntitlementsAction, claimCountyAction } from '@/app/actions/territories';
import { Loader2, MapPin, CheckCircle, Lock } from 'lucide-react';
import { useRouter } from 'next/navigation';

const AVAILABLE_MARKETS = [
  { id: 'Baker', name: 'Baker County', status: 'available' },
  { id: 'Clay', name: 'Clay County', status: 'available' },
  { id: 'Duval', name: 'Duval County', status: 'available' },
  { id: 'Nassau', name: 'Nassau County', status: 'coming_soon' },
  { id: 'St. Johns', name: 'St. Johns County', status: 'coming_soon' },
];

export default function CountyPickerModal() {
  const { isLoaded, userId } = useAuth();
  const router = useRouter();
  
  const [loading, setLoading] = useState(true);
  const [needsSelection, setNeedsSelection] = useState(false);
  const [selectedCounty, setSelectedCounty] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoaded || !userId) {
        setLoading(false);
        return;
    }

    async function check() {
        try {
            const ent = await checkEntitlementsAction();
            if (ent) {
                // If Tier is Free/Scout AND they have NO counties selected -> Show Picker
                // If they have counties OR are Local+ -> Hide Picker
                if (ent.counties !== 'all' && ent.counties.length === 0) {
                    setNeedsSelection(true);
                }
            }
        } catch (e) {
            console.error('Entitlement check failed', e);
        } finally {
            setLoading(false);
        }
    }
    
    check();
  }, [isLoaded, userId]);

  const handleClaim = async () => {
    if (!selectedCounty) return;
    setSubmitting(true);
    setError(null);

    const res = await claimCountyAction(selectedCounty);
    
    if (res.success) {
        setNeedsSelection(false);
        router.refresh(); // Refresh server components
    } else {
        setError(res.error || 'Failed to claim territory');
        setSubmitting(false);
    }
  };

  if (loading || !needsSelection) return null;

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 font-sans animate-in fade-in duration-300">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="p-8 pb-4 text-center">
            <h2 className="text-3xl font-bold text-white mb-2">Claim Your Territory</h2>
            <p className="text-slate-400 text-lg">
                Select your primary market to start your <span className="text-blue-400 font-semibold">7-Day Free Trial</span>.
            </p>
        </div>

        {/* Grid */}
        <div className="p-6 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {AVAILABLE_MARKETS.map((market) => {
                const isSelected = selectedCounty === market.id;
                const isAvailable = market.status === 'available';

                return (
                    <button
                        key={market.id}
                        disabled={!isAvailable || submitting}
                        onClick={() => setSelectedCounty(market.id)}
                        className={`
                            relative p-4 rounded-xl border text-left transition-all
                            ${!isAvailable 
                                ? 'border-slate-800 bg-slate-900/50 opacity-60 cursor-not-allowed' 
                                : isSelected 
                                    ? 'border-blue-500 bg-blue-500/10 ring-1 ring-blue-500' 
                                    : 'border-slate-700 bg-slate-800 hover:border-slate-600 hover:bg-slate-750'
                            }
                        `}
                    >
                        <div className="flex justify-between items-start mb-2">
                            <MapPin className={`w-5 h-5 ${isSelected ? 'text-blue-400' : 'text-slate-500'}`} />
                            {isSelected && <CheckCircle className="w-5 h-5 text-blue-500" />}
                            {!isAvailable && <Lock className="w-4 h-4 text-slate-600" />}
                        </div>
                        <h3 className="text-white font-medium">{market.name}</h3>
                        <div className="text-xs mt-1">
                            {isAvailable 
                                ? <span className="text-green-400">● Active Data</span> 
                                : <span className="text-slate-500">Coming Soon</span>
                            }
                        </div>
                    </button>
                );
            })}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-slate-800 bg-slate-900/50 flex flex-col sm:flex-row justify-between items-center gap-4">
            <div className="text-xs text-slate-500 max-w-xs text-center sm:text-left">
                Selecting a county locks your trial to this specific market. 
                You can upgrade to <strong>Local Tier</strong> later to access all counties.
            </div>
            <button
                onClick={handleClaim}
                disabled={!selectedCounty || submitting}
                className="w-full sm:w-auto px-8 py-3 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
            >
                {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                Confirm Selection
            </button>
        </div>

        {error && (
            <div className="px-6 pb-6 text-center text-red-400 text-sm animate-in slide-in-from-bottom-2">
                {error}
            </div>
        )}

      </div>
    </div>
  );
}
