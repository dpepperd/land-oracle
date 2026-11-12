import { ScanSearch, Database, Users, Sparkles, ShieldCheck, Zap } from 'lucide-react';

const features = [
  {
    icon: ScanSearch,
    title: "Spatial Search Engine",
    description: "Draw custom polygons on the map to find parcels in exact locations. Compare neighborhoods instantly without reloading."
  },
  {
    icon: Database,
    title: "Deep Property Data",
    description: "See owner and mailing address, land use, acreage, value, recent sales, and the FEMA flood zone for every parcel, from Florida tax records and FEMA maps."
  },
  {
    icon: Users,
    title: "Integrated CRM",
    description: "One-click 'Mark as Lead'. Track your prospects, add notes, and manage your pipeline directly from the map interface."
  },
  {
    icon: Zap,
    title: "Smart Filtering",
    description: "Filter by market value, acreage, land use, owner type (in-state or out-of-state), and distance to major highways to narrow a county down fast."
  },
  {
    icon: Sparkles,
    title: "AI Analyst",
    description: "Ask for what you want in plain English. Matching parcels land on your map and results list. Included with Pro and Statewide."
  },
  {
    icon: ShieldCheck,
    title: "Seller Signals",
    description: "Filter for absentee and out-of-state owners, parcels with no homestead exemption, and parcels with no recent sale, to find owners who may be more likely to sell."
  }
];

export default function Features() {
  return (
    <section id="features" className="py-24 bg-background border-y border-border">
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
              className="group shiny-card relative overflow-hidden p-8 bg-white dark:bg-slate-800 rounded-2xl border border-zinc-200 dark:border-slate-700 shadow-sm hover:shadow-2xl hover:border-blue-500/50 transition-all duration-300"
            >
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
