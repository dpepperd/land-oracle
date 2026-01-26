"use client";

import { X, Check, Lock } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";

interface UpsellModalProps {
  isOpen: boolean;
  onClose: () => void;
  feature?: string;
}

export default function UpsellModal({ isOpen, onClose, feature = "this feature" }: UpsellModalProps) {
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    setMounted(true);
    // Prevent scrolling when modal is open
    if (isOpen) {
      document.body.style.overflow = "hidden";
      // Analytics: View Paywall
      import('@/lib/analytics').then(({ trackViewPaywall }) => {
          trackViewPaywall({ trigger: feature });
      });
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen, feature]);

  if (!mounted || !isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm transition-opacity">
      <div 
        className="relative w-full max-w-md bg-background border border-border rounded-xl shadow-2xl transform transition-all animate-in fade-in zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
      >
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="p-6 text-center">
          <div className="mx-auto w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mb-4">
            <Lock className="w-6 h-6 text-blue-600 dark:text-blue-400" />
          </div>
          
          <h2 className="text-xl font-bold mb-2">Unlock {feature}</h2>
          <p className="text-muted-foreground mb-6">
            Upgrade to a paid plan to export data, view unlimited parcels, and access premium county records.
          </p>

          <div className="space-y-3 mb-6 text-left bg-muted/50 p-4 rounded-lg">
            <div className="flex items-center gap-2 text-sm text-foreground">
              <Check className="w-4 h-4 text-green-500" />
              <span>Unlimited csv exports</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-foreground">
              <Check className="w-4 h-4 text-green-500" />
              <span>Full owner details</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-foreground">
              <Check className="w-4 h-4 text-green-500" />
              <span>Advanced filtering</span>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <button 
              onClick={async () => {
                 setLoading(true);
                 // Analytics
                 import('@/lib/analytics').then(({ trackBeginCheckout }) => {
                     trackBeginCheckout({ tier: 'trial' });
                 });
                 try {
                     const res = await fetch('/api/user/trial/start', { method: 'POST' });
                     if (res.ok) {
                         onClose();
                         window.location.reload(); // Refresh to update tier access in UI
                     } else {
                         const txt = await res.text();
                         console.error(txt);
                         // Fallback to pricing if failed (e.g. already used)
                         router.push('/pricing');
                     }
                 } catch (e) {
                     console.error("Trial start failed", e);
                 } finally {
                     setLoading(false);
                 }
              }}
              disabled={loading}
              className="w-full py-2.5 px-4 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-bold rounded-lg transition-all shadow-lg hover:shadow-green-500/20 flex items-center justify-center gap-2"
            >
              {loading ? "Activating..." : "Start 7-Day Free Trial"}
            </button>
            
            <div className="relative flex py-2 items-center">
                <div className="flex-grow border-t border-border"></div>
                <span className="flex-shrink mx-4 text-muted-foreground text-xs uppercase">or</span>
                <div className="flex-grow border-t border-border"></div>
            </div>
            <Link 
              href="/pricing" 
              onClick={() => {
                 import('@/lib/analytics').then(({ trackBeginCheckout }) => {
                     trackBeginCheckout({ tier: 'paid_plans' });
                 });
              }}
              className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              View Plans & Pricing
            </Link>
            <button 
              onClick={onClose}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Maybe later
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
