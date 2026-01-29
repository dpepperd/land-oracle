
"use client";

import { useMemo, useState } from "react";
import { Loader2, ShieldCheck, X } from "lucide-react";
import { FLORIDA_REGIONS } from "@/lib/counties";

interface CheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedCounties: string[];
}

export default function CheckoutModal({ isOpen, onClose, selectedCounties }: CheckoutModalProps) {
  const [loading, setLoading] = useState(false);
  const [agreed, setAgreed] = useState(false);

  // Calculate Plan & Add-ons
  const plan = useMemo(() => {
    let remaining = [...selectedCounties];
    let regionsFound: string[] = [];

    // 1. Detect Full Regions
    Object.entries(FLORIDA_REGIONS).forEach(([regionName, regionCounties]: [string, any]) => {
        const hasAll = regionCounties.every((rc: string) => remaining.includes(rc));
        if (hasAll) {
            regionsFound.push(regionName);
            // Remove these from remaining to avoid double counting
            remaining = remaining.filter(c => !regionCounties.includes(c));
        }
    });

    const extraCount = remaining.length;

    // SCENARIO A: Regional Plan(s) Active
    if (regionsFound.length > 0) {
        const basePrice = 699 * regionsFound.length;
        const extraPrice = extraCount * 97;
        
        let name = `${regionsFound.join(' & ')} Region${regionsFound.length > 1 ? 's' : ''}`;
        if (extraCount > 0) name += ` + ${extraCount} Extra`;

        return {
            name,
            basePrice,
            addons: extraCount,
            total: basePrice + extraPrice,
            type: 'regional', // We might need a flexible stripe ID or meta
            limit: 100 // High limit
        };
    }

    // SCENARIO B: Standard Counting (No Full Regions)
    const count = selectedCounties.length;
    
    // Scout (1 County)
    if (count === 1) return { name: 'Scout Plan', basePrice: 199, addons: 0, total: 199, type: 'scout', limit: 1 };
    
    // Scout + 1 Addon (2 Counties) -> $199 + $97 = $296
    if (count === 2) return { name: 'Scout Plan + 1 Add-on', basePrice: 199, addons: 1, total: 296, type: 'scout_plus', limit: 2 };
    
    // Local (3 Counties)
    if (count === 3) return { name: 'Local Plan', basePrice: 349, addons: 0, total: 349, type: 'local', limit: 3 };

    // Local + Addons (>3 Counties)
    if (count > 3) {
        const extra = count - 3;
        const total = 349 + (extra * 97);
        return { name: `Local Plan + ${extra} Add-on${extra > 1 ? 's' : ''}`, basePrice: 349, addons: extra, total: total, type: 'local_plus', limit: count };
    }

    return { name: 'Select a Territory', basePrice: 0, addons: 0, total: 0, type: 'none', limit: 0 };
  }, [selectedCounties]);

  const handleCheckout = async () => {
    if (!agreed) return;
    setLoading(true);

    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
            counties: selectedCounties,
            planType: plan.type
        })
      });

      if (!res.ok) throw new Error('Checkout failed');

      const { url } = await res.json();
      window.location.href = url; // Redirect to Stripe
    } catch (error) {
        console.error(error);
        alert("Something went wrong. Please try again.");
        setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-2xl shadow-2xl border border-zinc-200 dark:border-slate-800 overflow-hidden">
        
        {/* Header */}
        <div className="p-4 border-b border-zinc-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/50">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-blue-600" />
            Confirm Selection
          </h2>
          <button onClick={onClose} className="p-1 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-full transition">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
            
            {/* Selection Summary */}
            <div className="space-y-3">
                <div className="text-sm font-medium text-slate-500">Selected Territories</div>
                <div className="flex flex-wrap gap-2">
                    {selectedCounties.map(c => (
                        <span key={c} className="px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-sm font-semibold rounded-full border border-blue-200 dark:border-blue-800">
                            {c}
                        </span>
                    ))}
                </div>
            </div>

            {/* Plan Details */}
            <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-100 dark:border-slate-700">
                <div className="flex justify-between items-center mb-1">
                    <span className="font-medium text-slate-700 dark:text-slate-300">Total Monthly</span>
                    <span className="font-bold text-lg text-foreground">${plan.total}/mo</span>
                </div>
                
                <div className="space-y-1 mt-2 pt-2 border-t border-slate-200 dark:border-slate-700 text-xs text-slate-500">
                    <div className="flex justify-between">
                        <span>Base Plan ({plan.type.includes('scout') ? 'Scout' : 'Local'})</span>
                        <span>${plan.basePrice}</span>
                    </div>
                    {plan.addons > 0 && (
                        <div className="flex justify-between text-blue-600">
                            <span>{plan.addons} x Add-on County ($97/ea)</span>
                            <span>+${plan.addons * 97}</span>
                        </div>
                    )}
                </div>
            </div>

            {/* Terms Checkbox */}
            <label className="flex items-start gap-3 cursor-pointer group">
                <div className="relative flex items-center">
                    <input 
                        type="checkbox" 
                        className="peer sr-only"
                        checked={agreed}
                        onChange={(e) => setAgreed(e.target.checked)}
                    />
                    <div className="w-5 h-5 border-2 border-slate-300 dark:border-slate-600 rounded-md peer-checked:bg-blue-600 peer-checked:border-blue-600 transition-all flex items-center justify-center text-white">
                        {agreed && <CheckIcon />}
                    </div>
                </div>
                <span className="text-xs text-slate-500 leading-snug select-none group-hover:text-slate-600 dark:group-hover:text-slate-400 transition">
                    I agree to the <a href="#" className="underline text-blue-600 hover:text-blue-700">Terms and Conditions</a> and authorize a recurring monthly charge of <b>${plan.total}</b>. I understand I can cancel anytime from my dashboard.
                </span>
            </label>

            {/* Checkout Button */}
            <button
                onClick={handleCheckout}
                disabled={!agreed || loading}
                className={`w-full py-3 rounded-xl font-bold text-white shadow-lg flex items-center justify-center gap-2 transition-all ${
                    agreed && !loading
                    ? 'bg-blue-600 hover:bg-blue-700 hover:shadow-blue-500/25 hover:scale-[1.02]' 
                    : 'bg-slate-300 dark:bg-slate-700 cursor-not-allowed text-slate-500'
                }`}
            >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Proceed to Payment'}
            </button>
        </div>

      </div>
    </div>
  );
}

function CheckIcon() {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
            <polyline points="20 6 9 17 4 12" />
        </svg>
    )
}
