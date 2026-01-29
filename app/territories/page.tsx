"use client";

import LandingHeader from "@/components/landing/LandingHeader";
import Footer from "@/components/Footer";
import TerritoryGrid from "@/components/territories/TerritoryGrid";
import CoverageMap from "@/components/territories/CoverageMap";
import { useState } from "react";

export default function TerritoriesPage() {
  const [selectedCounties, setSelectedCounties] = useState<string[]>([]);

  return (
    <div className="h-screen bg-background font-sans selection:bg-blue-200 dark:selection:bg-blue-900 flex flex-col overflow-hidden">
      <LandingHeader />
      
      {/* 
        Main Area: Flex-1 to fill remaining height. 
        min-h-0 is critical for nested scrolling in Flexbox. 
      */}
      <main className="flex-1 flex flex-col md:flex-row min-h-0 relative pt-16">
         {/* Map Area - Fills remaining space, fixed */}
         <div className="flex-1 relative bg-slate-900 h-[40vh] md:h-full">
            <CoverageMap selectedCounties={selectedCounties} />
         </div>

         {/* Sidebar - Fixed width on Desktop, Scrollable independently */}
         <div className="w-full md:w-[480px] h-full overflow-y-auto border-l border-zinc-200 dark:border-zinc-800 bg-background z-10 shadow-2xl relative">
             <TerritoryGrid 
                isSidebar={true} 
                externalSelected={selectedCounties}
                onSelectionChange={setSelectedCounties}
             />
         </div>
      </main>
    </div>
  );
}
