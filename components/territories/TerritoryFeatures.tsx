import { Lock, Users, BarChart3, Globe2 } from 'lucide-react';

const features = [
  {
    icon: Lock,
    title: "Exclusive Data Rights",
    description: "Once you secure a territory, our data stream for that county is locked to your account. We cap licenses per county to ensure you aren't fighting for the same leads."
  },
  {
    icon: Users,
    title: "Team Assignment",
    description: "Multi-seat capability. Assign your acquisition managers to specific territories. They only see what you want them to see."
  },
  {
    icon: BarChart3,
    title: "Market Saturation Index",
    description: "See exactly how many other investors are active in adjacent markets. Use our heatmaps to find the path of least resistance."
  },
  {
    icon: Globe2,
    title: "Multi-State Expansion",
    description: "Scale your operation without leaving your desk. Add new counties in Florida, Georgia, or Alabama with a single click."
  }
];

export default function TerritoryFeatures() {
  return (
    <section className="py-24 bg-background border-y border-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-base font-semibold text-teal-600 uppercase tracking-wide">Scale Your Operation</h2>
          <p className="mt-2 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Build your land empire, one county at a time.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {features.map((feature, index) => (
            <div 
              key={index}
              className="flex gap-6 p-8 bg-white dark:bg-slate-800 rounded-2xl border border-zinc-200 dark:border-slate-700 shadow-sm hover:border-teal-500/30 transition-all"
            >
              <div className="shrink-0 w-12 h-12 bg-teal-50 dark:bg-teal-500/10 rounded-lg flex items-center justify-center">
                <feature.icon className="w-6 h-6 text-teal-600 dark:text-teal-400" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-zinc-900 dark:text-white mb-2">
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
