import LandingHeader from "@/components/landing/LandingHeader";
import Footer from "@/components/Footer";
import TerritoryGrid from "@/components/territories/TerritoryGrid";

export default function TerritoriesPage() {
  return (
    <div className="min-h-screen bg-background font-sans selection:bg-blue-200 dark:selection:bg-blue-900">
      <LandingHeader />
      <main className="pt-24 pb-16 px-4 sm:px-6 lg:px-8">
        <TerritoryGrid />
      </main>
      <Footer />
    </div>
  );
}
