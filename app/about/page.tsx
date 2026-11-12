"use client";

import Header from "@/components/dashboard/Header";
import { Trees, Database, Map as MapIcon, ShieldCheck } from "lucide-react";

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <Header />
      
      <main className="flex-1">
        {/* Hero Section */}
        <section className="bg-slate-900 text-white py-20 relative overflow-hidden">
          <div className="absolute inset-0 opacity-10 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] pointer-events-none"></div>
          <div className="max-w-4xl mx-auto px-6 text-center relative z-10">
            <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight mb-6 bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-teal-300">
              The LandOracle.ai Mission
            </h1>
            <p className="text-xl text-slate-300 max-w-2xl mx-auto leading-relaxed">
              Empowering land investors with precision data, advanced mapping, and actionable insights to discover hidden value in Florida real estate.
            </p>
          </div>
        </section>

        {/* Features / Content */}
        <section className="py-16 max-w-5xl mx-auto px-6">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            
            <div className="space-y-6">
              <h2 className="text-3xl font-bold text-theme-primary">
                Data-Driven Land Discovery
              </h2>
              <p className="text-theme-secondary text-lg leading-relaxed">
                LandOracle.ai aggregates scattered county records, geospatial data, and ownership information into a single, unified dashboard. We eliminate the noise so you can focus on finding the perfect parcel.
              </p>
              
              <div className="space-y-4 pt-4">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg text-blue-600 dark:text-blue-400">
                    <Database className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-theme-primary">Unified Records</h3>
                    <p className="text-sm text-theme-secondary">Tax roll data from all 67 Florida property appraisers, joined with parcel maps in one place.</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg text-green-600 dark:text-green-400">
                    <MapIcon className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-theme-primary">Map Layers</h3>
                    <p className="text-sm text-theme-secondary">Topographic and satellite basemaps, FEMA flood zones, and highway overlays.</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg text-purple-600 dark:text-purple-400">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-theme-primary">Owner &amp; Mailing Records</h3>
                    <p className="text-sm text-theme-secondary">Current owner name and mailing address from each county&apos;s 2026 tax roll, plus recent qualified sales. Always verify with the county before you transact.</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Illustration / Image Placeholder */}
            <div className="bg-theme-card rounded-2xl p-8 shadow-xl border border-theme relative overflow-hidden group">
               <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>
               <Trees className="w-full h-48 text-theme-primary opacity-90 mx-auto" strokeWidth={1} />
               <div className="mt-8 text-center">
                 <div className="text-sm font-semibold uppercase tracking-wider text-blue-500 mb-1">Coverage</div>
                 <h3 className="text-2xl font-bold text-theme-primary">Florida Focused</h3>
                 <p className="text-theme-secondary mt-2 text-sm">Over 10 million parcels across all 67 Florida counties</p>
               </div>
            </div>

          </div>
        </section>
      </main>
      
      {/* Simple Footer */}
      <footer className="bg-theme-card border-t border-theme py-8 text-center text-theme-secondary text-sm">
        <p>&copy; {new Date().getFullYear()} LandOracle.ai. All rights reserved.</p>
      </footer>
    </div>
  );
}
