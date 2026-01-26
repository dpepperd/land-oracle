import Link from 'next/link';
import { Map, ArrowRight, ShieldCheck } from 'lucide-react';

export default function TerritoryHero() {
  return (
    <div className="relative overflow-hidden bg-background pt-24 pb-32">
      {/* Background decoration (Blue/Teal for Territories) */}
      <div className="absolute top-0 right-1/2 translate-x-1/2 w-[1000px] h-[600px] bg-teal-500/10 rounded-full blur-[100px] -z-10" />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col items-center text-center">
        
        <div className="mb-8 inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-50 dark:bg-teal-900/30 border border-teal-100 dark:border-teal-800 text-teal-700 dark:text-teal-300 text-xs font-semibold uppercase tracking-wide">
          <ShieldCheck className="w-4 h-4" />
          Exclusive Market Access
        </div>

        <h1 className="text-5xl md:text-7xl font-bold tracking-tight text-foreground mb-6">
          Claim Your <br/>
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-teal-500 to-blue-600">
             Territory
          </span>
        </h1>

        <p className="max-w-2xl text-lg md:text-xl text-[var(--text-secondary)] mb-10">
          Stop competing with every other investor. Secure exclusive access to real-time land data in your target counties. 
          When you own a territory, the data is yours alone.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 mb-16">
          <Link 
            href="/dashboard/settings"
            className="inline-flex items-center justify-center px-8 py-4 text-base font-bold text-white transition-all bg-teal-600 rounded-lg hover:bg-teal-700 shadow-lg hover:shadow-teal-500/30 ring-offset-2 focus:ring-2 focus:ring-teal-500"
          >
            Check Availability
            <ArrowRight className="ml-2 w-5 h-5" />
          </Link>
        </div>

        {/* Map Visual Placeholder */}
        <div className="w-full max-w-4xl p-2 bg-white dark:bg-zinc-800 rounded-2xl shadow-2xl border border-zinc-200 dark:border-zinc-700 opacity-90">
             <div className="aspect-[21/9] bg-zinc-100 dark:bg-zinc-900 rounded-xl flex items-center justify-center overflow-hidden relative">
                 <div className="absolute inset-0 bg-[url('https://api.mapbox.com/styles/v1/mapbox/light-v11/static/-82.25,30.3,9.5,0/1280x600?access_token=pk.eyJ1IjoiZGFzaGJvYXJkIiwiYSI6ImNrdjR4Z2o0MDBpMzYydm94b3g0c3drc2EifQ.W7aD4g_t8w8q8e1c6q6g')] bg-cover opacity-80 decoration-slice"></div>
                 {/* Overlay Grids representing territories */}
                 <div className="absolute inset-0 grid grid-cols-4 grid-rows-2">
                    <div className="border border-teal-500/20 bg-teal-500/10 flex items-center justify-center text-teal-700 font-bold backdrop-blur-[1px]">Baker</div>
                    <div className="border border-red-500/20 bg-red-500/10 flex items-center justify-center text-red-700 font-bold backdrop-blur-[1px]">Columbia (Sold)</div>
                    <div className="border border-teal-500/20 bg-teal-500/10 flex items-center justify-center text-teal-700 font-bold backdrop-blur-[1px]">Union</div>
                    <div className="border border-teal-500/20 hover:bg-teal-500/20 transition-colors flex items-center justify-center text-zinc-500 pointer-events-none">Nassau</div>
                 </div>
             </div>
        </div>

      </div>
    </div>
  );
}
