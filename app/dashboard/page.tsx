"use client";

import { useEffect, useState, useCallback, useRef } from 'react';
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
    acreageMin: 0,
    acreageMax: 100,
    maxDistance: 0,
    ownerType: 'all', // 'all', 'in_state', 'out_of_state'
    parcelId: '',
    limit: 1000
  });

  const [userTier, setUserTier] = useState<'demo' | 'trial' | 'paid'>('demo');
  const [userRole, setUserRole] = useState<string>('user'); // Admin Role

  const [parcels, setParcels] = useState<any[]>([]);
  const [geojson, setGeojson] = useState<any>({ type: 'FeatureCollection', features: [] });
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [popupInfo, setPopupInfo] = useState<any | null>(null);
  const [unlockedCounties, setUnlockedCounties] = useState<string[]>([]); // User's unlocked list
  const [showUpsell, setShowUpsell] = useState(false); // Shared Upsell State
  
  // Track leads being saved
  const [markingIds, setMarkingIds] = useState<string[]>([]);

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
    try {
      const res = await fetch('/api/parcels/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(filters),
        signal: controller.signal
      });
      const data = await res.json();
      console.log("[Dashboard] Search Response:", data.count, "records"); // DEBUG
      
      if (data.error) {
        console.error('Search error:', data.error);
        return;
      }
      
      setParcels(data.list || []);
      setGeojson(data.geojson || { type: 'FeatureCollection', features: [] });
      setTotalCount(data.count || 0);

      // Analytics: Track Search
      import('@/lib/analytics').then(({ trackPropertySearch }) => {
          trackPropertySearch({
              county: filters.counties,
              acreageMin: filters.acreageMin,
              acreageMax: filters.acreageMax,
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
  }, [filters]);

  // Debounce effect? Or simple effect.
  useEffect(() => {
    if (isLoaded) {
      fetchData();
    }
  }, [fetchData, isLoaded]);

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
        body: JSON.stringify({ parcel_id: parcelId })
      });
      
      if (!res.ok) throw new Error('Failed to save lead');
      
      // Update local state to reflect saved
      setParcels(prev => prev.map(p => 
        p.parcel_id === parcelId ? { ...p, is_lead: true } : p
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
      
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
          <FilterSidebar 
            initialFilters={filters}
            onFilterChange={setFilters} 
            userTier={userTier}
            unlockedCounties={unlockedCounties}
            onUpsell={() => {
                setShowUpsell(true);
            }}
          />
        
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
              onSearchArea={(bounds, shape) => {
                  setFilters(prev => ({
                      ...prev,
                      minLat: bounds[0],
                      maxLat: bounds[1],
                      minLon: bounds[2],
                      maxLon: bounds[3],
                      spatialShape: shape // Pass complex geometry
                  }));
              }}
            />
          </div>
          
          {/* Results List or CRM Panel (Right Panel) */}
          <div className="w-96 border-l border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 z-10 shadow-lg shrink-0 hidden lg:block transition-all">
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
