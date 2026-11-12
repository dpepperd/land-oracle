import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

export default function Hero() {
  return (
    <div className="relative overflow-hidden bg-background pt-24 pb-32">
      {/* Dynamic Background Elements */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[500px] bg-blue-600/20 rounded-full blur-[100px] -z-10 mix-blend-multiply dark:mix-blend-layout" />
      <div className="absolute bottom-0 right-0 w-[800px] h-[600px] bg-indigo-600/20 rounded-full blur-[120px] -z-10" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col items-center text-center">
        
        {/* Badge */}
        <div className="mb-8 inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-900/30 border border-blue-100 dark:border-blue-800 text-blue-600 dark:text-blue-300 text-xs font-semibold uppercase tracking-wide animate-in fade-in slide-in-from-bottom-4 duration-700">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
          </span>
          Live in all 67 Florida counties
        </div>

        {/* Headline */}
        <h1 className="text-5xl md:text-7xl font-bold tracking-tight text-zinc-900 dark:text-white mb-6 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-100">
          Unlock the Power of <br/>
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600">
             Spatial Intelligence
          </span>
        </h1>

        {/* Subheadline */}
        <p className="max-w-2xl text-lg md:text-xl text-zinc-600 dark:text-zinc-300 mb-10 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-200">
          Stop searching spreadsheets. Start visualizing opportunities. <br className="hidden md:block" />
          <span className="text-zinc-800 dark:text-zinc-100 font-medium">We use AI to organize complexity, surface risk, and compress analysis time — not replace human judgment.</span>
        </p>

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row gap-4 mb-20 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-300">
          <Link 
            href="/pricing"
            className="inline-flex items-center justify-center px-8 py-4 text-base font-bold text-white transition-all bg-blue-600 rounded-lg hover:bg-blue-700 shadow-lg hover:shadow-blue-500/30 ring-offset-2 focus:ring-2 focus:ring-blue-500"
          >
            Start Analyzing Now
            <ArrowRight className="ml-2 w-5 h-5" />
          </Link>
          <Link
            href="/sign-up"
            className="inline-flex items-center justify-center px-8 py-4 text-base font-bold text-zinc-700 dark:text-zinc-200 transition-all bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800 shadow-sm"
          >
            Create a free account
          </Link>
        </div>

        {/* Video Placeholder (The "WOW" Visual) */}
        <div className="w-full max-w-5xl relative group animate-in fade-in slide-in-from-bottom-12 duration-1000 delay-500">
          <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl blur opacity-25 group-hover:opacity-50 transition duration-1000"></div>
          <div className="relative aspect-video rounded-xl bg-zinc-900 border border-zinc-800 shadow-2xl overflow-hidden flex items-center justify-center">
             {/* Mock Map UI Background */}
             <div className="absolute inset-0 opacity-50 bg-[url('https://api.mapbox.com/styles/v1/mapbox/dark-v11/static/-82.2,30.3,11,0/1280x720?access_token=pk.eyJ1IjoiZGFzaGJvYXJkIiwiYSI6ImNrdjR4Z2o0MDBpMzYydm94b3g0c3drc2EifQ.W7aD4g_t8w8q8e1c6q6g')] bg-cover bg-center grayscale hover:grayscale-0 transition-all duration-700 scale-105 group-hover:scale-100" />
             

             {/* UI Mockup Details */}
             <div className="absolute top-4 left-4 right-4 flex justify-between pointer-events-none">
                <div className="h-8 w-32 bg-white/10 backdrop-blur rounded-md" />
                <div className="flex gap-2">
                   <div className="h-8 w-8 bg-white/10 backdrop-blur rounded-full" />
                   <div className="h-8 w-8 bg-white/10 backdrop-blur rounded-full" />
                </div>
             </div>
             <div className="absolute bottom-4 right-4 h-32 w-64 bg-black/60 backdrop-blur-md rounded-lg border border-white/10 p-4">
                <div className="h-4 w-3/4 bg-white/20 rounded mb-2" />
                <div className="h-3 w-1/2 bg-white/10 rounded mb-4" />
                <div className="space-y-2">
                   <div className="h-2 w-full bg-white/5 rounded" />
                   <div className="h-2 w-full bg-white/5 rounded" />
                </div>
             </div>
          </div>
        </div>
        
        {/* Trusted By / Social Proof (Optional) */}
        <p className="mt-12 text-sm font-medium text-zinc-500 uppercase tracking-widest">
           Powering Next-Gen Real Estate Investment
        </p>

      </div>
    </div>
  );
}
