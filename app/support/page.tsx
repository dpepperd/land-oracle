"use client";

import Header from "@/components/dashboard/Header";
import Footer from "@/components/Footer";
import { BookOpen, AlertTriangle, Lightbulb, MousePointer, Filter, Layers, FileText, HelpCircle, Eye, EyeOff, Trash2, ZoomIn, ZoomOut, X } from "lucide-react";
import { useState } from "react";

export default function SupportPage() {
  const [activeImage, setActiveImage] = useState<string | null>(null);
  const [isZoomed, setIsZoomed] = useState(false);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 flex flex-col">
      <Header />
      
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 py-12 flex flex-col md:flex-row gap-12">
        
        {/* Sidebar Navigation */}
        <aside className="hidden md:block w-64 flex-shrink-0 sticky top-24 h-fit">
            <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-4">On this page</h3>
            <nav className="space-y-1 border-l border-gray-200 dark:border-gray-700 pl-4">
                <a href="#intro" className="block text-sm text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 py-1 transition-colors">1. What It Is</a>
                <a href="#mindset" className="block text-sm text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 py-1 transition-colors">2. Thinking about Land</a>
                <a href="#workflow" className="block text-sm text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 py-1 transition-colors">3. Core Workflow</a>
                <a href="#dashboard" className="block text-sm text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 py-1 transition-colors">4. Dashboard Overview</a>
                <a href="#ai-role" className="block text-sm text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 py-1 transition-colors">5. How AI Helps</a>
                <a href="#filters" className="block text-sm text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 py-1 transition-colors">6. Using Filters & Shapes</a>
                <a href="#reports" className="block text-sm text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 py-1 transition-colors">7. Reports & Sharing</a>
                <a href="#cases" className="block text-sm text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 py-1 transition-colors">8. Common Use Cases</a>
                <a href="#mistakes" className="block text-sm text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 py-1 transition-colors">9. Common Mistakes</a>
                <a href="#reference" className="block text-sm text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 py-1 transition-colors">10. Reference & Glossary</a>
            </nav>
        </aside>

        {/* Main Content */}
        <div className="prose prose-slate dark:prose-invert max-w-4xl">
           <div className="mb-10 text-center md:text-left">
             <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 text-xs font-semibold uppercase tracking-wide mb-4">
                <BookOpen size={14} /> Documentation v1.1
             </span>
             <h1 className="text-4xl font-extrabold text-gray-900 dark:text-white mb-4">Land Oracle AI User Guide</h1>
             <p className="text-xl text-gray-600 dark:text-gray-300 leading-relaxed">
               Understand land faster, with less friction and fewer blind spots.
             </p>
           </div>

           {/* 1. What Land Oracle AI Is */}
           <section id="intro" className="mb-16 scroll-mt-24">
             <h2 className="mb-6 font-extrabold text-blue-600 dark:text-blue-400">1. What Land Oracle AI Is (and Is Not)</h2>
             <div className="grid md:grid-cols-2 gap-6 not-prose mb-6">
                <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 h-full">
                    <h3 className="flex items-center gap-2 text-lg font-bold text-green-600 dark:text-green-400 mb-3">
                        <Lightbulb size={20} /> What Land Oracle AI Is
                    </h3>
                    <p className="text-gray-600 dark:text-gray-300 text-sm leading-relaxed mb-3">
                        A land intelligence and early-stage due diligence platform. It consolidates fragmented data—tax records, zoning, environmental constraints, and access indicators—into a <strong>single, visual decision surface</strong>.
                    </p>
                    <p className="text-gray-600 dark:text-gray-300 text-sm font-semibold">
                        The goal is not more data. The goal is faster, clearer understanding.
                    </p>
                </div>
                <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 h-full">
                    <h3 className="flex items-center gap-2 text-lg font-bold text-red-500 dark:text-red-400 mb-3">
                        <AlertTriangle size={20} /> What Land Oracle AI Is Not
                    </h3>
                    <ul className="text-gray-600 dark:text-gray-300 text-sm space-y-2 list-disc list-inside">
                        <li>It does NOT provide investment advice.</li>
                        <li>It does NOT provide legal or zoning approvals.</li>
                        <li>It does NOT predict financial returns.</li>
                        <li>It does NOT tell you what to buy or sell.</li>
                    </ul>
                    <p className="mt-4 text-xs text-gray-500 dark:text-gray-400 font-bold uppercase tracking-wide">
                        All decisions remain with the user.
                    </p>
                </div>
             </div>

             <div className="bg-blue-50 dark:bg-blue-900/10 border-l-4 border-blue-500 p-4">
                <h4 className="text-sm font-bold text-blue-800 dark:text-blue-200 mb-1">AI Transparency</h4>
                <p className="m-0 text-sm text-blue-700 dark:text-blue-300">
                    AI is used to <strong>translate</strong> complex rules, <strong>summarize</strong> overlapping constraints, and <strong>surface</strong> patterns. It is NOT used to recommend decisions or predict outcomes.
                </p>
             </div>
           </section>

           {/* 2. Thinking About Land */}
           <section id="mindset" className="mb-16 scroll-mt-24">
             <h2 className="mb-6 font-extrabold text-blue-600 dark:text-blue-400">2. How to Think About Land</h2>
             <div className="space-y-6">
                <div>
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Land Is a Constraint Problem</h3>
                    <p>Most land issues are discovered late. Land Oracle AI helps surface constraints early (e.g., environmental overlays, zoning incompatibilities, access limitations).</p>
                </div>
                <div>
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Think Spatially, Not Sequentially</h3>
                    <p>Land decisions happen on a map. Tables and exports are secondary. The map is your primary thinking surface.</p>
                </div>
                <div>
                     <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Guide Attention, Not Certainty</h3>
                     <p>Visual signals help you decide where to look closer and what differs from nearby parcels. They are indicators, not final conclusions.</p>
                </div>
             </div>
           </section>

           {/* 3. Core Workflow */}
           <section id="workflow" className="mb-16 scroll-mt-24">
             <h2 className="mb-6 font-extrabold text-blue-600 dark:text-blue-400">3. The Core Workflow</h2>
             <p className="mb-6">Land Oracle AI follows a repeatable loop that mirrors how experienced land professionals think.</p>
             
             <div className="bg-white dark:bg-slate-800 rounded-xl p-8 border border-gray-200 dark:border-gray-700 not-prose mb-8">
                <div className="flex flex-col md:flex-row items-center justify-between gap-4 text-center">
                    <div className="flex flex-col items-center gap-2">
                        <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center text-blue-600 dark:text-blue-400 font-bold">1</div>
                        <span className="text-xs font-bold uppercase tracking-wider">Map</span>
                    </div>
                    <div className="h-0.5 w-6 bg-gray-300 dark:bg-gray-600 hidden md:block"></div>
                    <div className="flex flex-col items-center gap-2">
                        <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center text-blue-600 dark:text-blue-400 font-bold">2</div>
                        <span className="text-xs font-bold uppercase tracking-wider">Filter</span>
                    </div>
                    <div className="h-0.5 w-6 bg-gray-300 dark:bg-gray-600 hidden md:block"></div>
                    <div className="flex flex-col items-center gap-2">
                        <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center text-blue-600 dark:text-blue-400 font-bold">3</div>
                        <span className="text-xs font-bold uppercase tracking-wider">Click</span>
                    </div>
                     <div className="h-0.5 w-6 bg-gray-300 dark:bg-gray-600 hidden md:block"></div>
                    <div className="flex flex-col items-center gap-2">
                        <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center text-blue-600 dark:text-blue-400 font-bold">4</div>
                        <span className="text-xs font-bold uppercase tracking-wider">Evaluate</span>
                    </div>
                     <div className="h-0.5 w-6 bg-gray-300 dark:bg-gray-600 hidden md:block"></div>
                    <div className="flex flex-col items-center gap-2">
                         <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center text-blue-600 dark:text-blue-400 font-bold">5</div>
                        <span className="text-xs font-bold uppercase tracking-wider">Decide</span>
                    </div>
                </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
                <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                    <strong className="block text-gray-900 dark:text-white mb-1">Start Broad</strong>
                    <span className="text-sm text-gray-600 dark:text-gray-400">Understand the landscape before narrowing.</span>
                </div>
                <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                    <strong className="block text-gray-900 dark:text-white mb-1">Filter Aggressively</strong>
                    <span className="text-sm text-gray-600 dark:text-gray-400">Remove obvious non-starters early.</span>
                </div>
                <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                    <strong className="block text-gray-900 dark:text-white mb-1">Click for Context</strong>
                    <span className="text-sm text-gray-600 dark:text-gray-400">Replace manual research with a unified view.</span>
                </div>
                 <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                    <strong className="block text-gray-900 dark:text-white mb-1">Evaluate Constraints</strong>
                    <span className="text-sm text-gray-600 dark:text-gray-400">Look for deal-killers or unusual conditions.</span>
                </div>
            </div>
           </section>

           {/* 4. Dashboard Overview */}
           <section id="dashboard" className="mb-16 scroll-mt-24">
             <h2 className="mb-6 font-extrabold text-blue-600 dark:text-blue-400">4. Understanding the Dashboard</h2>
             <p>The dashboard is your command center, bringing all analysis into one place.</p>
             
             <div 
                className="my-8 rounded-xl overflow-hidden shadow-lg border border-gray-200 dark:border-gray-700 group relative cursor-zoom-in"
                 onClick={() => setActiveImage("/screenshots/land oracle dashboard overview.png")}
             >
                <img src="/screenshots/land oracle dashboard overview.png" alt="Dashboard Overview" className="w-full h-auto" />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                    <div className="bg-white/90 dark:bg-black/80 text-gray-900 dark:text-white px-4 py-2 rounded-full shadow-lg flex items-center gap-2 font-medium text-sm backdrop-blur-sm">
                        <ZoomIn size={16} /> Click to Expand
                    </div>
                </div>
             </div>

             <div className="space-y-8 mt-6">
                <div className="flex gap-4 items-start">
                    <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded-lg text-slate-700 dark:text-slate-300 shrink-0 mt-1">
                        <Layers size={20} />
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white">The Map (Opportunity Surface)</h3>
                        <p className="text-slate-600 dark:text-slate-400">Shows parcels spatially. Colors guide attention. This is where you identify location context.</p>
                    </div>
                </div>

                <div className="flex gap-4 items-start">
                     <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded-lg text-slate-700 dark:text-slate-300 shrink-0 mt-1">
                        <Filter size={20} />
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white">The Filter Panel</h3>
                        <p className="text-slate-600 dark:text-slate-400">Located on the left. Filters remove parcels from view to reduce noise before analysis begins.</p>
                    </div>
                </div>

                <div className="flex gap-4 items-start">
                     <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded-lg text-slate-700 dark:text-slate-300 shrink-0 mt-1">
                        <FileText size={20} />
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white">The Context Panel</h3>
                        <p className="text-slate-600 dark:text-slate-400">Appears on the right when a parcel is clicked. Summarizes Owner, Land Use, Value, and AI Insights.</p>
                        
                        <div 
                            className="mt-6 rounded-xl overflow-hidden shadow-lg border border-gray-200 dark:border-gray-700 group relative cursor-zoom-in max-w-md"
                            onClick={() => setActiveImage("/screenshots/Parcel Details.png")}
                        >
                            <img src="/screenshots/Parcel Details.png" alt="Parcel Details Context Panel" className="w-full h-auto" />
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                                <div className="bg-white/90 dark:bg-black/80 text-gray-900 dark:text-white px-4 py-2 rounded-full shadow-lg flex items-center gap-2 font-medium text-sm backdrop-blur-sm">
                                    <ZoomIn size={16} /> Click to Expand
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                 <div className="border-t border-gray-200 dark:border-gray-700 pt-6 mt-6">
                     <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Shapes: Hide vs Clear</h3>
                     <div className="grid sm:grid-cols-2 gap-4 not-prose">
                         <div className="flex items-start gap-3 bg-slate-50 dark:bg-slate-800/50 p-4 rounded-lg">
                             <EyeOff className="text-gray-500 mt-1" size={20} />
                             <div>
                                 <strong className="block text-gray-900 dark:text-white">Hide (Eye Icon)</strong>
                                 <ul className="text-xs text-gray-600 dark:text-gray-400 list-disc list-inside mt-1 space-y-1">
                                     <li>Hides shape visually</li>
                                     <li>Keeps results visible</li>
                                     <li>Filtering remains active</li>
                                 </ul>
                             </div>
                         </div>
                         <div className="flex items-start gap-3 bg-slate-50 dark:bg-slate-800/50 p-4 rounded-lg">
                             <Trash2 className="text-red-500 mt-1" size={20} />
                             <div>
                                 <strong className="block text-gray-900 dark:text-white">Clear (Trash Icon)</strong>
                                 <ul className="text-xs text-gray-600 dark:text-gray-400 list-disc list-inside mt-1 space-y-1">
                                     <li>Removes shape entirely</li>
                                     <li>Resets results</li>
                                     <li>Clears filter</li>
                                 </ul>
                             </div>
                         </div>
                     </div>
                 </div>
             </div>
           </section>

           {/* 5. How AI Helps */}
           <section id="ai-role" className="mb-16 scroll-mt-24">
             <h2 className="mb-6 font-extrabold text-blue-600 dark:text-blue-400">5. How AI Helps (and Where It Stops)</h2>
             <div className="space-y-4">
                 <p><strong>What AI Does:</strong> Summarizes dense rules, translates codes into plain language, and highlights overlapping constraints.</p>
                 <p><strong>What AI Does Not Do:</strong> Decide feasibility, recommend purchases, or replace professionals.</p>
                 <div className="bg-yellow-50 dark:bg-yellow-900/10 border-l-4 border-yellow-500 p-4">
                     <p className="m-0 text-sm text-yellow-800 dark:text-yellow-200">
                         <strong>Interpretation:</strong> AI summaries are contextual aids. They should trigger questions, not answer them definitively.
                     </p>
                 </div>
             </div>
           </section>

           {/* 6. Filters & Shapes */}
           <section id="filters" className="mb-16 scroll-mt-24">
             <h2 className="mb-6 font-extrabold text-blue-600 dark:text-blue-400">6. Using Filters & Shapes Effective</h2>
             
             <div className="space-y-6">
                <div>
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">Filter Early Philosophy</h3>
                    <p>The biggest mistake is trying to see everything. Use filters to narrow the field immediately.</p>
                </div>
                
                <div>
                     <h3 className="text-lg font-bold text-gray-900 dark:text-white">High-Impact Filters</h3>
                     <ul className="list-disc list-inside space-y-1 text-gray-700 dark:text-gray-300">
                         <li><strong>Acreage:</strong> Define your Min/Max early.</li>
                         <li><strong>Land Use:</strong> Filter for "Residential" vs "Commercial" using the codes.</li>
                         <li><strong>Environmental:</strong> Exclude wetlands if your use case requires dry land.</li>
                     </ul>
                </div>

                 <div>
                     <h3 className="text-lg font-bold text-gray-900 dark:text-white">Avoid Over-Filtering</h3>
                     <p>If no results appear, relax your constraints or reassess your assumptions. Start grid, then narrow down.</p>
                </div>
                 <div>
                     <h3 className="text-lg font-bold text-gray-900 dark:text-white">Filters vs Layers</h3>
                     <p><strong>Filters</strong> remove parcels from the map. <strong>Layers</strong> (like Zoning or Flood Zones) add visual information without hiding parcels.</p>
                 </div>
             </div>
           </section>

           {/* 7. Reports */}
           <section id="reports" className="mb-16 scroll-mt-24">
             <h2 className="mb-6 font-extrabold text-blue-600 dark:text-blue-400">7. Reports & Sharing</h2>
             <p className="mb-4">Reports capture early-stage understanding to share with partners or document analysis.</p>
             <ul className="list-disc list-inside space-y-2 text-gray-700 dark:text-gray-300">
                 <li><strong>When to Use:</strong> Sharing with stakeholders, documenting a find, or preparing for a site visit.</li>
                 <li><strong>What Included:</strong> Parcel overview, visual maps, constraint summaries, and AI highlights.</li>
                 <li><strong>Limitation:</strong> Reports do not replace surveys, title work, or physical inspections.</li>
             </ul>
           </section>

            {/* 8. Common Use Cases */}
           <section id="cases" className="mb-16 scroll-mt-24">
             <h2 className="mb-6 font-extrabold text-blue-600 dark:text-blue-400">8. Common Use Cases</h2>
             <div className="grid sm:grid-cols-2 gap-x-8 gap-y-6">
                 <div>
                     <h4 className="font-bold text-gray-900 dark:text-white">Land Investors</h4>
                     <p className="text-sm text-gray-600 dark:text-gray-400">Screen many parcels quickly based on value spread and physical usability.</p>
                 </div>
                 <div>
                     <h4 className="font-bold text-gray-900 dark:text-white">Developers</h4>
                     <p className="text-sm text-gray-600 dark:text-gray-400">Assess feasibility (zoning, density, environmental) before capital spend.</p>
                 </div>
                 <div>
                     <h4 className="font-bold text-gray-900 dark:text-white">Solar & Energy</h4>
                     <p className="text-sm text-gray-600 dark:text-gray-400">Evaluate physical suitability (acreage, wetlands, transmission proximity) early.</p>
                 </div>
                 <div>
                     <h4 className="font-bold text-gray-900 dark:text-white">Brokers & Advisors</h4>
                     <p className="text-sm text-gray-600 dark:text-gray-400">Communicate land context clearly to clients with visual data.</p>
                 </div>
             </div>
           </section>

           {/* 9. Mistakes */}
           <section id="mistakes" className="mb-16 scroll-mt-24">
             <h2 className="mb-6 font-extrabold text-blue-600 dark:text-blue-400">9. Common Mistakes</h2>
             <ul className="space-y-2 list-disc list-inside text-gray-700 dark:text-gray-300">
                 <li>Treating the platform as advice (it's a tool).</li>
                 <li>Skipping filters and getting overwhelmed by data.</li>
                 <li>Visual overload (turn off layers you aren't using).</li>
                 <li>Confusing "Land Use" (current status) with "Zoning" (legal potential).</li>
                 <li>Expecting AI to know your specific investment strategy.</li>
             </ul>
           </section>
           
           <hr className="my-12 border-gray-200 dark:border-gray-700" />

           {/* 10. Reference */}
           <section id="reference">
             <h2 className="mb-6 font-extrabold text-blue-600 dark:text-blue-400">10. Reference & Glossary</h2>
             
             <div className="mb-8">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Common Land Use Codes (FL)</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs font-mono text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/50 p-4 rounded-lg border border-slate-200 dark:border-slate-700">
                    <div>00: Vacant Residential</div>
                    <div>01: Single Family</div>
                    <div>02: Mobile Home</div>
                    <div>10: Vacant Commercial</div>
                    <div>11: Stores/Office</div>
                    <div>40: Vacant Industrial</div>
                    <div>50-69: Agricultural</div>
                    <div>70: Institutional</div>
                    <div>80-89: Government</div>
                    <div>99: Non-Ag Acreage</div>
                </div>
                <p className="text-xs text-gray-500 mt-2 italic">Note: These are standard Dept of Revenue categories. Local variations may apply.</p>
             </div>

             <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Key Definitions</h3>
             <dl className="grid md:grid-cols-2 gap-x-8 gap-y-4 not-prose">
                <div>
                    <dt className="font-bold text-gray-900 dark:text-white">Constraint</dt>
                    <dd className="text-sm text-gray-600 dark:text-gray-400">Any factor limiting land use (e.g. Wetlands, Zoning Setbacks).</dd>
                </div>
                <div>
                    <dt className="font-bold text-gray-900 dark:text-white">Opportunity Surface</dt>
                    <dd className="text-sm text-gray-600 dark:text-gray-400">The map view, representing the field of potential deals before filtering.</dd>
                </div>
                <div>
                    <dt className="font-bold text-gray-900 dark:text-white">Layer</dt>
                    <dd className="text-sm text-gray-600 dark:text-gray-400">Data visual overlays (e.g. Satellite, Flood Zones) that aren't clickable parcels but provide context.</dd>
                </div>
                <div>
                    <dt className="font-bold text-gray-900 dark:text-white">Context Panel</dt>
                    <dd className="text-sm text-gray-600 dark:text-gray-400">The sidebar showing specific data for a selected parcel.</dd>
                </div>
             </dl>
           </section>

        </div>
      </main>
      <Footer />
      
      {/* Lightbox Modal */}
      {activeImage && (
        <div
            className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-sm flex items-center justify-center animate-in fade-in duration-200 overflow-auto"
            onClick={() => {
                setActiveImage(null);
                setIsZoomed(false);
            }}
        >
            <div className="fixed top-4 right-4 z-[110] flex gap-2">
                 <button 
                    className="p-2 bg-white/10 hover:bg-white/20 text-white rounded-full transition-colors"
                    onClick={(e) => {
                        e.stopPropagation();
                        setIsZoomed(!isZoomed);
                    }}
                >
                    {isZoomed ? <ZoomOut size={24} /> : <ZoomIn size={24} />}
                </button>
                <button 
                    className="p-2 bg-white/10 hover:bg-white/20 text-white rounded-full transition-colors"
                    onClick={(e) => {
                        e.stopPropagation();
                        setActiveImage(null);
                        setIsZoomed(false);
                    }}
                >
                    <X size={24} />
                </button>
            </div>
            
            <div 
                className={`transition-all duration-300 ease-in-out p-4 ${isZoomed ? 'w-auto h-auto' : 'w-full h-full flex items-center justify-center'}`}
                onClick={(e) => {
                    if (isZoomed) e.stopPropagation();
                }}
            >
                <img 
                    src={activeImage}
                    alt="Expanded View" 
                    className={`
                        transition-all duration-300 ease-in-out shadow-2xl rounded-sm
                        ${isZoomed 
                            ? 'max-w-none max-h-none cursor-zoom-out' 
                            : 'max-w-[95vw] max-h-[95vh] object-contain cursor-zoom-in'
                        }
                    `}
                    onClick={(e) => {
                        e.stopPropagation();
                        setIsZoomed(!isZoomed);
                    }}
                />
            </div>
        </div>
      )}
    </div>
  );
}
