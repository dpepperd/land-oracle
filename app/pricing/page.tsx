"use client";

import Header from "@/components/dashboard/Header";
import { Check, Shield, Zap, Globe, Building, Map as MapIcon } from 'lucide-react';
import { useState } from 'react';

export default function PricingPage() {
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('monthly');

  const tiers = [
    {
      name: "Scout",
      monthlyPrice: "$199",
      annualPrice: "$1,910",
      description: "For new investors testing the waters.",
      features: [
        "1 County of your choice",
        "1,000 Parcel Views / Month",
        "Basic Support",
        "Standard Filtering",
        "Additional Counties: $47/mo"
      ],
      cta: "Start Scouting",
      popular: false,
      color: "gray"
    },
    {
      name: "Local",
      monthlyPrice: "$349",
      annualPrice: "$3,350",
      description: "Perfect for focused local operations.",
      features: [
        "3 Counties of your choice",
        "5,000 Parcel Views / Month",
        "Unlimited Exports",
        "Standard Filtering",
        "Additional Counties: $47/mo"
      ],
      cta: "Go Local",
      popular: false,
      color: "blue"
    },
    {
      name: "Regional",
      monthlyPrice: "$699",
      annualPrice: "$6,710",
      description: "For serious developers covering preset regions.",
      features: [
        "Preset Region Access",
        "Unlimited Parcel Views",
        "Priority Support",
        "Highway Proximity Analysis",
        "Advanced Filtering"
      ],
      cta: "Go Regional",
      popular: true,
      color: "amber"
    }
  ];

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans transition-colors duration-300">
      <Header />

      <main className="flex-1 container mx-auto px-4 py-16">
        <div className="text-center max-w-3xl mx-auto mb-12">
          <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-6">
            Choose Your <span className="text-blue-600 dark:text-blue-400">Territory</span>
          </h1>
          <p className="text-xl text-muted-foreground mb-8">
            Scalable data access for land investors of all sizes. <br className="hidden md:block"/>
            Pay only for the counties you need.
          </p>

          {/* Billing Toggle */}
          <div className="flex items-center justify-center gap-4 mb-8">
            <span className={`text-sm font-medium ${billingCycle === 'monthly' ? 'text-foreground' : 'text-muted-foreground'}`}>Monthly</span>
            <button 
                onClick={() => setBillingCycle(billingCycle === 'monthly' ? 'annual' : 'monthly')}
                className="w-14 h-7 bg-slate-200 dark:bg-slate-700 rounded-full relative transition p-1 cursor-pointer"
            >
                <div className={`w-5 h-5 bg-white rounded-full shadow-sm transition-transform ${billingCycle === 'annual' ? 'translate-x-7' : 'translate-x-0'}`} />
            </button>
            <span className={`text-sm font-medium ${billingCycle === 'annual' ? 'text-foreground' : 'text-muted-foreground'}`}>
                Annual <span className="text-green-600 text-xs font-bold ml-1">(Save ~20%)</span>
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-5 gap-4 max-w-[1400px] mx-auto">
          {tiers.map((tier) => (
            <div 
              key={tier.name}
              className={`relative flex flex-col p-6 rounded-2xl border transition-all duration-300 ${
                tier.popular 
                  ? 'bg-card border-amber-400 dark:border-amber-500 shadow-2xl scale-105 z-10' 
                  : 'bg-card border-border shadow-md hover:shadow-lg'
              }`}
            >
              {tier.popular && (
                <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-amber-500 text-white px-3 py-0.5 rounded-full text-xs font-bold shadow-md whitespace-nowrap">
                  MOST POPULAR
                </div>
              )}

              <div className="mb-4">
                <h3 className={`text-lg font-bold mb-1 ${
                    tier.color === 'blue' ? 'text-blue-600' :
                    tier.color === 'amber' ? 'text-amber-600' :
                    tier.color === 'purple' ? 'text-purple-600' : 
                    tier.color === 'gray' ? 'text-gray-500' : 'text-foreground'
                }`}>
                  {tier.name}
                </h3>
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-extrabold text-foreground">
                    {billingCycle === 'monthly' ? tier.monthlyPrice : tier.annualPrice}
                  </span>
                  <span className="text-muted-foreground text-sm font-medium">/{billingCycle === 'monthly' ? 'mo' : 'yr'}</span>
                </div>
                <p className="mt-2 text-xs text-muted-foreground min-h-[32px]">
                  {tier.description}
                </p>
              </div>

              <div className="flex-1 space-y-3 mb-6">
                {tier.features.map((feature) => (
                  <div key={feature} className="flex items-start gap-2">
                    <Check className={`w-4 h-4 shrink-0 ${
                         tier.color === 'blue' ? 'text-blue-500' :
                         tier.color === 'amber' ? 'text-amber-500' :
                         tier.color === 'purple' ? 'text-purple-500' : 'text-gray-400'
                    }`} />
                    <span className="text-xs text-foreground/80 leading-tight">{feature}</span>
                  </div>
                ))}
              </div>

              <button className={`w-full py-2.5 px-3 rounded-lg font-bold text-sm transition-all cursor-pointer ${
                tier.popular
                  ? 'bg-amber-500 hover:bg-amber-600 text-white shadow-lg hover:shadow-amber-500/30'
                  : 'bg-foreground text-background hover:opacity-90'
              }`}>
                {tier.cta}
              </button>
            </div>
          ))}
        </div>

        <div className="mt-16 text-center">
            <p className="text-muted-foreground text-sm">
                Secure payments processed by <span className="font-bold text-foreground">Stripe</span>. 
                Annual billing available with <span className="text-green-600 font-bold">~20% discount</span>.
            </p>
        </div>
      </main>
    </div>
  );
}
