import { ScanSearch, Database, Users, TrendingUp, ShieldCheck, Zap } from 'lucide-react';

const features = [
  {
    icon: ScanSearch,
    title: "Spatial Search Engine",
    description: "Draw custom polygons on the map to find parcels in exact locations. Compare neighborhoods instantly without reloading."
  },
  {
    icon: Database,
    title: "Deep Property Data",
    description: "Access ownership details, land use codes, acreage, and valuation data sourced directly from county records."
  },
  {
    icon: Users,
    title: "Integrated CRM",
    description: "One-click 'Mark as Lead'. Track your prospects, add notes, and manage your pipeline directly from the map interface."
  },
  {
    icon: Zap,
    title: "Smart Filtering",
    description: "Filter by market value, owner type (in-state vs out-of-state), and distance to major highways to find high-intent sellers."
  },
  {
    icon: TrendingUp,
    title: "Market Analytics",
    description: "Visualize price trends and property values with heatmaps and cluster analysis to spot undervalued areas."
  },
  {
    icon: ShieldCheck,
    title: "Absentee Owner Targeting",
    description: "Instantly filter for out-of-state owners to identify high-motivation leads. Skip the locals and find sellers who just want to cash out."
  }
];

export default function Features() {
  return (
    <section className="py-24 bg-background border-y border-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-base font-semibold text-blue-600 uppercase tracking-wide">Why LandOracle?</h2>
          <p className="mt-2 text-3xl font-bold tracking-tight text-zinc-900 dark:text-white sm:text-4xl">
            Everything you need to find, analyze, and acquire land.
          </p>
          <p className="mt-4 text-lg text-zinc-600 dark:text-zinc-300">
            Built for serious investors who need more than just a list of addresses.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, index) => (
            <div 
              key={index}
              className="group relative overflow-hidden p-8 bg-white dark:bg-slate-800 rounded-2xl border border-zinc-200 dark:border-slate-700 shadow-sm hover:shadow-2xl hover:border-blue-500/50 transition-all duration-300"
            >
              {/* Shimmer Overlay */}
              <div className="absolute inset-0 -translate-x-full group-hover:animate-shimmer bg-gradient-to-r from-transparent via-blue-500/10 dark:via-blue-400/10 to-transparent z-20 pointer-events-none" />

              <div className="relative z-10">
                <div className="w-12 h-12 bg-blue-50 dark:bg-blue-500/10 rounded-lg flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                  <feature.icon className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                </div>
                <h3 className="text-xl font-bold text-zinc-900 dark:text-white mb-3">
                  {feature.title}
                </h3>
                <p className="text-zinc-600 dark:text-zinc-300 leading-relaxed">
                  {feature.description}
                </p>
              </div>
            </div>
          ))}
        </div>

      </div>
    </section>
  );
}
