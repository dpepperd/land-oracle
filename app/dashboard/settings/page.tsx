"use client";

import Header from "@/components/dashboard/Header";
import TerritoryGrid from "@/components/territories/TerritoryGrid";

export default function CountySelectionPage() {
  // We can reuse the same Grid component, just wrapped in the Dashboard Header
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans transition-colors duration-300">
      <Header />
      <main className="container mx-auto px-4 py-8 max-w-6xl">
         <TerritoryGrid />
      </main>
    </div>
  );
}
