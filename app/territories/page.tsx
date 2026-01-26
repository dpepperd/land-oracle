import LandingHeader from "@/components/landing/LandingHeader";
import Footer from "@/components/Footer";
import TerritoryGrid from "@/components/territories/TerritoryGrid";
import CoverageMap from "@/components/territories/CoverageMap";

export default function TerritoriesPage() {
  return (
    <div className="min-h-screen bg-background font-sans selection:bg-blue-200 dark:selection:bg-blue-900 flex flex-col">
      <LandingHeader />
      <main className="flex-1 flex flex-col md:flex-row pt-16 overflow-hidden h-[calc(100vh)]">
         {/* Map Area - Fills remaining space */}
         <div className="flex-1 relative bg-slate-900 h-[50vh] md:h-auto">
            <CoverageMap />
         </div>

         {/* Sidebar - Fixed width on Desktop, Scrollable */}
         <div className="w-full md:w-[400px] h-full overflow-y-auto border-l border-zinc-200 dark:border-zinc-800 bg-background z-10 shadow-xl">
             <TerritoryGrid isSidebar={true} />
         </div>
      </main>
    </div>
  );
}
