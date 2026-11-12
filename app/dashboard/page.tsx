"use client";

import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { withArea, stripArea, type SearchArea } from '@/lib/searchArea';
import { useAuth } from "@clerk/nextjs";
import Header from "@/components/dashboard/Header";
import FilterSidebar from "@/components/dashboard/FilterSidebar";
import ResultsList from "@/components/dashboard/ResultsList";
import MapView from "@/components/dashboard/MapView";
import UpsellModal from "@/components/dashboard/UpsellModal";
import CRMPanel from "@/components/dashboard/CRMPanel";

export default function Dashboard() {
  const { isLoaded, userId } = useAuth();
  
  const [filters, setFilters] = useState({
    counties: [], // Clean slate by default
    landUse: [],
    acreageMin: undefined,
    acreageMax: undefined,
    maxDistance: 0,
    ownerType: 'all', // 'all', 'in_state', 'out_of_state'
    parcelId: '',
    limit: 1000
  });

  // The drawn search area lives in its own state so changing/applying sidebar filters can never drop it.
  const [searchArea, setSearchArea] = useState<SearchArea | null>(null);
  const [clearShapeSignal, setClearShapeSignal] = useState(0);
  const areaFilters = useMemo(() => withArea(filters, searchArea), [filters, searchArea]);

  const [userTier, setUserTier] = useState<'demo' | 'trial' | 'paid'>('demo');
  const [userRole, setUserRole] = useState<string>('user'); // Admin Role

  const [parcels, setParcels] = useState<any[]>([]);
  const [geojson, setGeojson] = useState<any>({ type: 'FeatureCollection', features: [] });
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [popupInfo, setPopupInfo] = useState<any | null>(null);
  const [unlockedCounties, setUnlockedCounties] = useState<string[]>([]); // User's unlocked list
  const [showUpsell, setShowUpsell] = useState(false); // Shared Upsell State
  const [searchError, setSearchError] = useState<string | null>(null); // Error message
  const [aiResults, setAiResults] = useState<{ count: number } | null>(null); // parcels pushed in by the AI Analyst
  
  // Track leads being saved
  const [markingIds, setMarkingIds] = useState<string[]>([]);
  
  // Mobile UI State
  const [isMobileFiltersOpen, setIsMobileFiltersOpen] = useState(false);
  const [isMobileResultsOpen, setIsMobileResultsOpen] = useState(false);

  useEffect(() => {
    // Fetch user tier info
    if (userId) {
      fetch('/api/user/counties')
        .then(res => res.json())
        .then(data => {
           if (data.role) setUserRole(data.role); // Set Role
           
           if (data.selected) setUnlockedCounties(data.selected); // Set Unlocked Counties

           if (data.role === 'admin' || data.tier === 'scout' || data.tier === 'local' || data.tier === 'regional' || data.tier === 'statewide' || data.tier === 'enterprise') {
             setUserTier('paid');
           } else if (data.tier === 'trial') {
             setUserTier('trial');
           } else {
             setUserTier('demo');
           }

           // Analytics: Track Login
           import('@/lib/analytics').then(({ trackLogin }) => {
               trackLogin({ userId: userId, tier: data.tier });
           });
        })
        .catch(err => console.error("Failed to fetch tier", err));
    }
  }, [userId]);

  // Ref to track the current abort controller
  const abortControllerRef = useRef<AbortController | null>(null);

  const fetchData = useCallback(async () => {
    // Cancel previous request if exists
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Create new controller
    const controller = new AbortController();
    abortControllerRef.current = controller;
    
    setIsLoading(true);
    setSearchError(null); // Clear previous errors
    try {
      const res = await fetch('/api/parcels/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(withArea(filters, searchArea)),
        signal: controller.signal
      });
      const data = await res.json();
      console.log("[Dashboard] Search Response:", data.count, "records"); // DEBUG
      
      if (data.error) {
        console.error('Search error:', data.error);
        setSearchError(data.error || 'Search failed. Please try again.');
        setParcels([]);
        setGeojson({ type: 'FeatureCollection', features: [] });
        setTotalCount(0);
        return;
      }
      
      setParcels(data.list || []);
      setGeojson(data.geojson || { type: 'FeatureCollection', features: [] });
      setTotalCount(data.count || 0);

      // Mobile: If specific filters applied, maybe auto-close filters? 
      // User preference: let's keep it manual for now or auto-close on "Apply".
      if (window.innerWidth < 768) {
         setIsMobileFiltersOpen(false); // Auto-close drawer on search
      }

      // Analytics: Track Search
      import('@/lib/analytics').then(({ trackPropertySearch }) => {
          trackPropertySearch({
              county: filters.counties,
              acreageMin: filters.acreageMin || 0,
              acreageMax: filters.acreageMax || 0,
              resultsCount: data.count || 0
          });
      });

    } catch (err: any) {
      if (err.name === 'AbortError') {
        console.log('[Dashboard] Fetch aborted');
      } else {
        console.error('Fetch error:', err);
      }
    } finally {
      // Only unset loading if THIS request finished (not aborted)
      if (abortControllerRef.current === controller) {
        setIsLoading(false);
        abortControllerRef.current = null;
      }
    }
  }, [filters, searchArea]);

  // Debounce effect? Or simple effect.
  useEffect(() => {
    if (isLoaded) {
      fetchData();
    }
  }, [fetchData, isLoaded]);

  // AI Analyst -> dashboard: show the parcels it found in the normal list and map.
  const showAiParcels = useCallback(async (keys: string[], select?: string) => {
    try {
      const res = await fetch('/api/assistant/parcels', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ keys }) });
      const data = await res.json();
      if (data.error) { setSearchError(data.error); return; }
      abortControllerRef.current?.abort();
      setParcels(data.list || []);
      setGeojson(data.geojson || { type: 'FeatureCollection', features: [] });
      setTotalCount(data.count || 0);
      setAiResults({ count: data.count || 0 });
      if (select) {
        const hit = (data.list || []).find((p: any) => p.parcel_key === select);
        if (hit && hit.latitude && hit.longitude) setPopupInfo({ start_lat: hit.latitude, start_lng: hit.longitude, properties: hit });
      }
    } catch (err) {
      console.error('AI results error:', err);
    }
  }, []);

  useEffect(() => {
    if (!isLoaded) return;
    const take = (d: { keys?: string[]; select?: string } | null) => { if (d?.keys?.length) void showAiParcels(d.keys, d.select); };
    // Results handed over before the dashboard was open (assistant used on another page)
    try {
      const pending = sessionStorage.getItem('lo:ai-parcels');
      if (pending) { sessionStorage.removeItem('lo:ai-parcels'); take(JSON.parse(pending)); }
    } catch { /* ignore */ }
    const onShow = (e: Event) => take((e as CustomEvent).detail);
    window.addEventListener('landoracle:show-parcels', onShow);
    return () => window.removeEventListener('landoracle:show-parcels', onShow);
  }, [isLoaded, showAiParcels]);

  const handleExport = async () => {
    try {
      const res = await fetch('/api/parcels/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(filters)
      });
      
      if (!res.ok) throw new Error('Export failed');
      
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `parcels_export_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      // Analytics
      import('@/lib/analytics').then(({ trackPropertyExport }) => {
          trackPropertyExport({
              format: 'csv',
              count: totalCount,
              userTier: userTier
          });
      });
    } catch (err) {
      console.error('Export error:', err);
      alert('Failed to export data');
    }
  };

  const handleMarkLead = async (parcelId: string) => {
    if (markingIds.includes(parcelId)) return;
    
    setMarkingIds(prev => [...prev, parcelId]);
    try {
      const res = await fetch('/api/leads/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ parcel_key: parcelId })
      });
      
      if (!res.ok) throw new Error('Failed to save lead');
      
      // Update local state to reflect saved
      setParcels(prev => prev.map(p => 
        p.parcel_key === parcelId ? { ...p, is_lead: true } : p
      ));
      
      // Update map features if needed (complex re-render, maybe skip for now or update robustly)
      
    } catch (err) {
      console.error('Mark Lead Error:', err);
      alert('Failed to save lead');
    } finally {
      setMarkingIds(prev => prev.filter(id => id !== parcelId));
    }
  };
  const handleParcelSelect = (parcel: any) => {
    // Only set if coordinates exist
    if (parcel.latitude && parcel.longitude) {
      setPopupInfo({
        start_lat: parcel.latitude,
        start_lng: parcel.longitude,
        properties: parcel
      });
    } else {
        console.warn("Parcel missing coordinates", parcel);
    }
  };

  if (!isLoaded) return <div className="h-screen flex items-center justify-center">Loading...</div>;

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-gray-50 dark:bg-gray-900">
      <Header />
      
      {/* Desktop Error Notification */}
      {searchError && (
        <div className="bg-red-600 text-white px-6 py-3 shadow-lg flex items-center justify-between">
          <span className="font-medium">{searchError}</span>
          <button 
            onClick={() => setSearchError(null)}
            className="text-red-200 hover:text-white"
          >
            ✕
          </button>
        </div>
      )}
      
      {!aiResults && totalCount > 0 && !(filters as any).counties?.length && !searchArea && !(filters as any).parcelId && !(filters as any).address && (
        <div className="bg-amber-100 text-amber-900 px-6 py-2 shadow text-sm">
          No county or drawn area is selected, so this shows the first {totalCount.toLocaleString()} matches across the whole state. Pick a county or draw an area to narrow it down.
        </div>
      )}

      {aiResults && (
        <div className="bg-emerald-700 text-white px-6 py-2 shadow flex items-center justify-between text-sm">
          <span>Showing {aiResults.count} parcel{aiResults.count === 1 ? '' : 's'} from the AI Analyst</span>
          <button onClick={() => { setAiResults(null); void fetchData(); }} className="underline hover:text-emerald-100">Back to my filters</button>
        </div>
      )}

      <div className="flex-1 flex overflow-hidden relative">
        {/* Sidebar - Mobile Drawer & Desktop Static */}
        <div className={`
            fixed inset-0 z-50 bg-black/50 transition-opacity md:hidden
            ${isMobileFiltersOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}
        `} onClick={() => setIsMobileFiltersOpen(false)} />
        
        <div className={`
            fixed inset-y-0 left-0 z-50 w-80 bg-theme-sidebar shadow-2xl transform transition-transform duration-300 ease-in-out md:relative md:transform-none md:shadow-none md:flex
            ${isMobileFiltersOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        `}>
          <FilterSidebar 
            initialFilters={areaFilters}
            onFilterChange={(f: any) => setFilters(stripArea(f))}
            onClearArea={() => { setSearchArea(null); setClearShapeSignal((n) => n + 1); }}
            userTier={userTier}
            unlockedCounties={unlockedCounties}
            onUpsell={() => {
                setShowUpsell(true);
            }}
          />
          {/* Mobile Close Button */}
          <button 
             onClick={() => setIsMobileFiltersOpen(false)}
             className="absolute top-4 right-4 p-2 bg-white/10 text-white rounded-full md:hidden"
          >
             ✕
          </button>
        </div>
        
        {/* Main Content */}
        <main className="flex-1 flex relative">
          {/* Map */}
          <div className="flex-1 relative z-0">
            <MapView 
              geojson={geojson} 
              popupInfo={popupInfo}
              setPopupInfo={setPopupInfo}
              isLoading={isLoading}
              userRole={userRole}
              userTier={userTier}
              onUpsell={() => setShowUpsell(true)}
              clearShapeSignal={clearShapeSignal}
              onSearchArea={(bounds, shape) => {
                  if (shape) setSearchArea({ shape, bounds: [bounds[0], bounds[1], bounds[2], bounds[3]] });
                  else setSearchArea(null); // Clear Shape
              }}
            />
            {/* Mobile Floating Controls */}
            <div className="absolute bottom-6 left-4 right-4 flex gap-3 z-10 md:hidden pointer-events-none">
                {/* Error Notification */}
                {searchError && (
                  <div className="absolute bottom-full left-0 mb-3 w-full bg-red-600 text-white px-3 py-2 rounded-lg shadow-lg text-sm font-medium flex items-center justify-between pointer-events-auto">
                    <span>{searchError}</span>
                    <button 
                      onClick={() => setSearchError(null)}
                      className="ml-2 text-red-200 hover:text-white"
                    >
                      ✕
                    </button>
                  </div>
                )}
                <button 
                  onClick={() => setIsMobileFiltersOpen(true)}
                  className="flex-1 py-3 bg-slate-900 text-white font-bold rounded-lg shadow-lg pointer-events-auto flex items-center justify-center gap-2"
                >
                   <span>Filters</span>
                   {/* Count active filters approx */}
                   <span className="bg-blue-600 text-[10px] px-1.5 py-0.5 rounded-full">
                     {(filters.counties?.length || 0) + (filters.landUse?.length || 0)}
                   </span>
                </button>
                <button 
                  onClick={() => setIsMobileResultsOpen(true)}
                  className="flex-1 py-3 bg-white text-slate-900 font-bold rounded-lg shadow-lg pointer-events-auto border border-gray-200"
                >
                   Results ({totalCount})
                </button>
            </div>
          </div>

          
          {/* Results List or CRM Panel (Right Panel) */}
          {/* Results List or CRM Panel (Right Panel) - Mobile Drawer & Desktop Static */}
          <div className={`
              fixed inset-0 z-50 bg-black/50 transition-opacity lg:hidden
              ${isMobileResultsOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}
          `} onClick={() => setIsMobileResultsOpen(false)} />

          <div className={`
             fixed inset-y-0 right-0 z-50 w-full sm:w-96 bg-white dark:bg-gray-800 shadow-2xl transform transition-transform duration-300 ease-in-out lg:relative lg:transform-none lg:shadow-none lg:block lg:border-l lg:border-gray-200 dark:lg:border-gray-700
             ${isMobileResultsOpen ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'}
          `}>
             {/* Mobile Header for Results */}
             <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-gray-700 lg:hidden">
                <h3 className="font-bold text-lg dark:text-white">Results ({totalCount})</h3>
                <button onClick={() => setIsMobileResultsOpen(false)} className="p-2 bg-gray-100 dark:bg-gray-700 rounded-full">✕</button>
             </div>

            {popupInfo && popupInfo.properties ? (
                <CRMPanel 
                    parcel={popupInfo.properties} 
                    onClose={() => setPopupInfo(null)}
                    userRole={userRole}
                    userTier={userTier}
                    onUpsell={() => setShowUpsell(true)}
                />
            ) : (
                <ResultsList 
                  parcels={parcels}
                  totalCount={totalCount}
                  isLoading={isLoading}
                  onExport={handleExport}
                  onMarkLead={handleMarkLead}
                  onSelect={handleParcelSelect}
                  markingIds={markingIds}
                  userTier={userTier}
                  onUpsell={() => setShowUpsell(true)}
                />
            )}
          </div>
        </main>
      </div>

      <UpsellModal 
        isOpen={showUpsell} 
        onClose={() => setShowUpsell(false)} 
        feature="premium features"
      />
    </div>
  );
}
