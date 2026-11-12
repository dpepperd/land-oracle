import { Download, Lock } from 'lucide-react';
import ParcelCard from './ParcelCard';
import { useState } from 'react';


interface ResultsListProps {
  parcels: any[];
  totalCount: number;
  isLoading: boolean;
  onExport: () => void;
  onMarkLead: (id: string) => void;
  onSelect: (parcel: any) => void;
  markingIds: string[];
  userTier?: 'demo' | 'trial' | 'paid';
  onUpsell: () => void; // Shared callback
}

export default function ResultsList({ 
  parcels, 
  totalCount, 
  isLoading, 
  onExport,
  onMarkLead,
  onSelect,
  markingIds,
  userTier = 'demo',
  onUpsell
}: ResultsListProps) {
  // const [showUpsell, setShowUpsell] = useState(false); // Removed local state
  
  return (
    <div className="h-full flex flex-col bg-theme-sidebar border-l border-theme">
      <div className="p-4 flex justify-between items-center sidebar-header shadow-sm border-b border-theme bg-theme-input">
        <div>
          <h2 className="text-lg font-bold text-theme-primary">Results</h2>
          <p className="text-sm text-theme-secondary">
            {isLoading ? 'Searching...' : `${totalCount} parcels found`}
          </p>
          {!isLoading && parcels.some((p) => p.has_outline === false) && (
            <p className="text-xs text-theme-secondary mt-0.5">
              {parcels.filter((p) => p.has_outline !== false).length} of {parcels.length} shown on the map; the rest have no map outline yet
            </p>
          )}
        </div>
        {userTier === 'demo' ? (
           <>
             <button 
               onClick={() => {
                 onUpsell();
                 // Track attempt
                 fetch('/api/analytics/demo', {
                    method: 'POST',
                    body: JSON.stringify({ eventType: 'attempt_export' })
                 });
               }}
               className="flex items-center gap-2 px-3 py-2 bg-gray-300 dark:bg-slate-700 text-gray-500 dark:text-gray-400 text-sm font-medium rounded-md cursor-pointer hover:bg-gray-400 dark:hover:bg-slate-600 transition-colors" 
               title="Upgrade to Export"
             >
               <Lock className="w-4 h-4" />
               <span className="hidden sm:inline">Export Locked</span>
             </button>
           </>
        ) : (
          <button
            onClick={onExport}
            disabled={totalCount === 0 || isLoading}
            className="flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-sm font-medium rounded-md transition-colors"
          >
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">Export CSV</span>
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {isLoading && parcels.length === 0 ? (
          <div className="flex justify-center py-10">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : parcels.length === 0 ? (
          <div className="text-center py-10 text-theme-secondary">
            No parcels found matching your criteria.
          </div>
        ) : (
          parcels.map((parcel) => (
            <ParcelCard 
              key={parcel.id} 
              parcel={parcel}
              onMarkLead={onMarkLead}
              onSelect={onSelect}
              isMarking={markingIds.includes(parcel.parcel_key)}
            />
          ))
        )}
      </div>
    </div>
  );
}
