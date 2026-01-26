'use client';

import { useRef, useState, useEffect } from 'react';
import Map, { 
  Source, 
  Layer, 
  NavigationControl, 
  Popup, 
  FullscreenControl,
  ScaleControl,
  GeolocateControl,
  MapRef
} from 'react-map-gl/mapbox';
import { Layers, X, Ruler, Edit2, CheckCircle2, ScanSearch, Eye, EyeOff } from 'lucide-react';


import EditParcelModal from './EditParcelModal';
import ConfirmModal from './ConfirmModal';
import { getPropertyAppraiserUrl } from '@/lib/countyLinks';
import { useTheme } from 'next-themes';
import * as turf from 'turf';
import 'mapbox-gl/dist/mapbox-gl.css';

// Map Styles
const MAP_STYLES = {
  streets: { label: 'Streets', url: 'mapbox://styles/mapbox/streets-v12' },
  satellite: { label: 'Satellite', url: 'mapbox://styles/mapbox/satellite-streets-v12' },
  dark: { label: 'Dark', url: 'mapbox://styles/mapbox/dark-v11' },
  outdoors: { label: 'Outdoors', url: 'mapbox://styles/mapbox/outdoors-v12' },
  usgs: { label: 'USGS Topo', url: 'mapbox://styles/mapbox/light-v11', usgs: true }
};

interface MapViewProps {
  geojson: any;
  popupInfo: any | null;
  setPopupInfo: (info: any | null) => void;
  isLoading: boolean;
  userRole?: string;
  userTier?: string;
  onUpsell?: () => void;
  onSearchArea?: (bounds: number[], shape?: any) => void;
}

// Layer Styles
const clusterLayer: any = {
  id: 'clusters',
  type: 'circle',
  filter: ['has', 'point_count'],
  paint: {
    'circle-color': ['step', ['get', 'point_count'], '#51bbd6', 100, '#f1f075', 750, '#f28cb1'],
    'circle-radius': ['step', ['get', 'point_count'], 20, 100, 30, 750, 40]
  }
};

const clusterCountLayer: any = {
  id: 'cluster-count',
  type: 'symbol',
  filter: ['has', 'point_count'],
  layout: {
    'text-field': '{point_count_abbreviated}',
    'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Bold'],
    'text-size': 12
  }
};

const unclusteredPointLayer: any = {
  id: 'unclustered-point',
  type: 'circle',
  filter: ['!', ['has', 'point_count']],
  paint: {
    'circle-color': [
        'case',
        ['boolean', ['get', 'out_of_state'], false],
        '#ef4444', 
        '#d8b4fe'  // Light Purple (was Orange)
    ],
    'circle-radius': [
        'case',
        ['==', ['geometry-type'], 'Point'],
        6, 
        0  
    ],
    'circle-stroke-width': 1,
    'circle-stroke-color': '#ffffff'
  }
};

const parcelFillLayer: any = {
  id: 'parcel-fill',
  type: 'fill',
  paint: {
    'fill-color': [
        'case',
        ['boolean', ['get', 'out_of_state'], false],
        '#ef4444', 
        '#d8b4fe' // Light Purple
    ],
    'fill-opacity': 0.4
  }
};

const parcelLineLayer: any = {
  id: 'parcel-line',
  type: 'line',
  paint: {
    'line-color': [
        'case',
        ['boolean', ['get', 'out_of_state'], false],
        '#b91c1c', 
        '#a855f7' // Darker Purple Border
    ],
    'line-width': 1
  }
};

const highwayLayer: any = {
  id: 'highway-line',
  type: 'line',
  paint: {
    'line-color': '#f97316', // Orange-500
    'line-width': 2,
    'line-opacity': 0.8
  }
};

const measureLineLayer: any = {
    id: 'measure-line',
    type: 'line',
    paint: {
        'line-color': '#06b6d4', // Cyan-500
        'line-width': 3,
        'line-dasharray': [2, 1]
    }
};

const measurePointLayer: any = {
    id: 'measure-points',
    type: 'circle',
    paint: {
        'circle-radius': 5,
        'circle-color': '#06b6d4',
        'circle-stroke-width': 2,
        'circle-stroke-color': '#ffffff'
    }
};

const FL_GEOJSON = "https://raw.githubusercontent.com/danielcs88/fl_geo_json/master/geojson-fl-counties-fips.json";

export default function MapView({ 
  geojson, 
  popupInfo, 
  setPopupInfo, 
  isLoading, 
  userRole = 'user',
  userTier = 'demo',
  onUpsell,
  onSearchArea 
}: MapViewProps) {
  const mapRef = useRef<MapRef>(null);
  const { theme } = useTheme();
  const [activeStyle, setActiveStyle] = useState<string>('outdoors');
  const [styleMenuOpen, setStyleMenuOpen] = useState(false);
  const [highways, setHighways] = useState<any>(null);
  const [showHighways, setShowHighways] = useState(true);
  const [showBoundaries, setShowBoundaries] = useState(true); // Default ON
  const [scaleUnit, setScaleUnit] = useState<'imperial' | 'metric'>('imperial'); // Default to MILES
  
  // Measure Tool State
  const [isMeasureMode, setIsMeasureMode] = useState(false);
  const [measurePoints, setMeasurePoints] = useState<any[]>([]);
  const [measureDistance, setMeasureDistance] = useState<number | null>(null);

  // Drawing Tool State (Spatial Search)
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawPoints, setDrawPoints] = useState<any[]>([]);
  const [isShapeVisible, setIsShapeVisible] = useState(true);

  // Admin Edit State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  // External Link State
  const [externalLink, setExternalLink] = useState<{ url: string; county: string } | null>(null);

  // Auto-zoom to Results
  useEffect(() => {
    console.log("[MapView] GeoJSON Update:", geojson?.features?.length, "features");
    if (!geojson || !geojson.features || geojson.features.length === 0) return;
    if (!mapRef.current) {
        console.log("[MapView] Map ref is null");
        return;
    }

    try {
        console.log("[MapView] Calculating BBox...");
        const bbox = turf.bbox(geojson) as [number, number, number, number];
        console.log("[MapView] BBox:", bbox);
        
        if (bbox) {
            console.log("[MapView] fitting bounds...");
            mapRef.current.fitBounds(
                [[bbox[0], bbox[1]], [bbox[2], bbox[3]]],
                { padding: 50, duration: 2000, maxZoom: 17 } // Smooth zoom
            );
        } else {
             console.log("[MapView] BBox is null/undefined");
        }
    } catch (e) {
        console.error("Failed to fit bounds:", e);
    }
  }, [geojson]);

  // Notes logic moved to CRMPanel
  // Only minimal popup logic remains here
  
  // Handle Save (Keep for Admin Edit Modal if needed, or move to Panel?)
  // For now keeping Admin Edit Modal logic here as it's separate from Notes.

  // Handle Save
  const handleSaveParcel = async (updatedData: any) => {
    try {
        const res = await fetch(`/api/parcels/${updatedData.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updatedData)
        });

        if (!res.ok) throw new Error('Failed to update');

        // Update local popup info to reflect changes immediately
        if (popupInfo && popupInfo.properties.parcel_id === updatedData.id) {
            setPopupInfo({
                ...popupInfo,
                properties: {
                    ...popupInfo.properties,
                    ...updatedData
                }
            });
        }
        alert('Parcel updated successfully!');
    } catch (err) {
        console.error(err);
        alert('Failed to update parcel.');
    }
  };

  // Fetch Highways once on mount
  useEffect(() => {
    fetch('/api/highways')
      .then(res => res.json())
      .then(data => setHighways(data))
      .catch(err => console.error("Failed to load highways", err));
  }, []);
  
  // Sync Map Style with Theme
  useEffect(() => {
    const isThemeable = activeStyle === 'streets' || activeStyle === 'dark';
    if (isThemeable) {
      if (theme === 'dark') {
        setActiveStyle('dark');
      } else {
        setActiveStyle('streets');
      }
    }
  }, [theme]);
  
  // Fly to Popup Location when it changes
  useEffect(() => {
    if (popupInfo && popupInfo.start_lat && popupInfo.start_lng) {
      mapRef.current?.flyTo({
        center: [popupInfo.start_lng, popupInfo.start_lat],
        zoom: 16,
        duration: 1500
      });
    }
  }, [popupInfo]);
  
  // FIX: Helper function to properly format bbox for API
  // turf.bbox returns [minLon, minLat, maxLon, maxLat] (GeoJSON standard)
  // API expects [minLat, maxLat, minLon, maxLon]
  const formatBboxForApi = (bbox: number[]): number[] => {
    // bbox from turf: [west/minLon, south/minLat, east/maxLon, north/maxLat]
    //                 [bbox[0],     bbox[1],      bbox[2],     bbox[3]]
    // API expects:    [minLat,      maxLat,       minLon,      maxLon]
    return [bbox[1], bbox[3], bbox[0], bbox[2]];
  };

  const initialViewState = {
    latitude: 27.6648,
    longitude: -81.5158,
    zoom: 6
  };

  return (
    <div className="w-full h-full relative group map-container">
      <Map
        ref={mapRef}
        initialViewState={initialViewState}
        mapStyle={MAP_STYLES[activeStyle as keyof typeof MAP_STYLES].url}
        mapboxAccessToken={process.env.NEXT_PUBLIC_MAPBOX_TOKEN}
        interactiveLayerIds={['clusters', 'parcel-fill', 'unclustered-point']}
        onClick={(event) => {
            if (isDrawing) {
                const newPoint = [event.lngLat.lng, event.lngLat.lat];
                setDrawPoints(prev => [...prev, newPoint]);
                return;
            }

            if (isMeasureMode) {
                const newPoints = [...measurePoints, [event.lngLat.lng, event.lngLat.lat]];
                if (newPoints.length > 2) {
                    setMeasurePoints([[event.lngLat.lng, event.lngLat.lat]]);
                    setMeasureDistance(null);
                } else {
                    setMeasurePoints(newPoints);
                    if (newPoints.length === 2) {
                        const from = { type: 'Feature' as const, properties: {}, geometry: { type: 'Point' as const, coordinates: newPoints[0] } };
                        const to = { type: 'Feature' as const, properties: {}, geometry: { type: 'Point' as const, coordinates: newPoints[1] } };
                        try {
                            const dist = turf.distance(from, to, 'miles');
                            setMeasureDistance(dist);
                        } catch(e) { console.error(e); }
                    } else {
                        setMeasureDistance(null);
                    }
                }
                return;
            }

            const feature = event.features?.[0];
            if (feature?.layer?.id === 'parcel-fill' || feature?.layer?.id === 'unclustered-point') {
                setPopupInfo({
                    start_lat: event.lngLat.lat,
                    start_lng: event.lngLat.lng,
                    properties: feature.properties
                });
            } else {
                 if (!feature) setPopupInfo(null);
            }
        }}
        onMouseMove={(event) => {
             if (isMeasureMode || isDrawing) {
                 mapRef.current?.getCanvas().style.setProperty('cursor', 'crosshair');
             }
        }}
        onMouseEnter={() => mapRef.current?.getCanvas().style.setProperty('cursor', 'pointer')}
        onMouseLeave={() => mapRef.current?.getCanvas().style.setProperty('cursor', '')}
      >
        <GeolocateControl position="top-right" />
        <FullscreenControl position="top-right" />
        <NavigationControl position="top-right" />
        <ScaleControl unit={scaleUnit} />

         {activeStyle === 'usgs' && (
            <Source
              id="usgs-topo"
              type="raster"
              tiles={['https://basemap.nationalmap.gov/arcgis/rest/services/USGSTopo/MapServer/tile/{z}/{y}/{x}']}
              tileSize={256}
              attribution="USGS"
            >
              <Layer id="usgs-topo-layer" type="raster" />
            </Source>
         )}

         {highways && showHighways && (
            <Source id="highways" type="geojson" data={highways}>
                <Layer {...highwayLayer} />
            </Source>
         )}

         {/* Custom Drawing Layer */}
         {drawPoints.length > 0 && isShapeVisible && (
             <Source 
               id="draw-source"
               type="geojson"
               data={{
                   type: 'FeatureCollection',
                   features: [
                       {
                           type: 'Feature',
                           properties: {},
                           geometry: {
                               type: 'Polygon',
                               coordinates: [[...drawPoints, drawPoints[0]]] // Correctly close ring
                           }
                       },
                       {
                           type: 'Feature',
                           properties: {},
                           geometry: {
                               type: 'LineString',
                               coordinates: [...drawPoints, drawPoints[0]] // Outline
                           }
                       },
                       // Only show points while drawing or editing
                       ...(isDrawing ? drawPoints.map(pt => ({
                           type: 'Feature',
                           properties: {},
                           geometry: { type: 'Point', coordinates: pt }
                       })) : [])
                   ] as any
               }}
             >
                 <Layer 
                    id="draw-fill"
                    type="fill"
                    paint={{
                        'fill-color': '#3b82f6', // Blue-500 (Clean modern blue)
                        'fill-opacity': 0.15 // Subtler
                    }}
                 />
                 <Layer 
                    id="draw-line"
                    type="line"
                    paint={{
                        'line-color': '#2563eb', // Blue-600
                        'line-width': 2
                    }}
                 />
                 {isDrawing && (
                    <Layer 
                        id="draw-points"
                        type="circle"
                        paint={{
                            'circle-radius': 5,
                            'circle-color': '#ffffff',
                            'circle-stroke-width': 2,
                            'circle-stroke-color': '#2563eb'
                        }}
                    />
                 )}
             </Source>
         )}

         {measurePoints.length > 0 && (
             <Source 
               id="measure-source"
               type="geojson"
               data={{
                   type: 'FeatureCollection',
                   features: [
                       {
                           type: 'Feature' as const,
                           properties: {},
                           geometry: {
                               type: 'LineString',
                               coordinates: measurePoints
                           }
                       },
                       ...measurePoints.map(pt => ({
                           type: 'Feature' as const,
                           properties: {},
                           geometry: { type: 'Point' as const, coordinates: pt }
                       }))
                   ]
               }}
             >
                 <Layer {...measureLineLayer} />
                 <Layer {...measurePointLayer} />
             </Source>
         )}

        <Source
          id="parcels"
          type="geojson"
          data={geojson}
          cluster={false}
        >
          <Layer {...parcelFillLayer} />
          <Layer {...parcelLineLayer} />
          <Layer {...clusterLayer} />
          <Layer {...clusterCountLayer} />
          <Layer {...unclusteredPointLayer} />
        </Source>

        {showBoundaries && (
            <Source
                id="fl-counties"
                type="geojson"
                data={FL_GEOJSON}
            >
                <Layer 
                    id="county-boundary-line"
                    type="line"
                    paint={{
                        'line-color': '#000000', // Black
                        'line-width': 1,
                        'line-opacity': 0.8,
                    }}
                />
                <Layer
                    id="county-boundary-label"
                    type="symbol"
                    minzoom={6.5}
                    layout={{
                        'text-field': ['get', 'NAME'],
                        'text-font': ['Open Sans Semibold', 'Arial Unicode MS Bold'],
                        'text-size': 12,
                        'text-transform': 'uppercase',
                        'symbol-placement': 'point'
                    }}
                    paint={{
                        'text-color': '#ffffff', // White Text
                        'text-halo-color': '#000000', // Black Halo
                        'text-halo-width': 1.25, // Thin, crisp shadow
                        'text-opacity': 0.95
                    }}
                />
                 {/* Only labels at higher zooms? Or keep simple for now */}
            </Source>
        )}
        
        {popupInfo && (popupInfo.properties?.geojson || popupInfo.start_lat) && (
            <Source
                id="selected-parcel"
                type="geojson"
                data={popupInfo.properties.geojson || {
                    type: 'Feature',
                    geometry: { type: 'Point', coordinates: [popupInfo.start_lng, popupInfo.start_lat] }
                }}
            >
                <Layer 
                    id="highlight-line"
                    type="line"
                    paint={{
                        'line-color': '#fbbf24', // Amber
                        'line-width': 4,
                        'line-opacity': 1
                    }}
                />
            </Source>
        )}

        {popupInfo && (
           <Popup
           longitude={popupInfo.start_lng}
           latitude={popupInfo.start_lat}
           anchor="bottom"
           onClose={() => setPopupInfo(null)}
           closeButton={false}
           closeOnClick={false}
           className="z-50"
           maxWidth="320px"
         >
           <div className="p-1 min-w-[280px] relative">
             <button 
               onClick={(e) => {
                   e.stopPropagation();
                   setPopupInfo(null);
               }}
               className="absolute -top-3 -right-3 p-1.5 bg-white rounded-full shadow-md hover:bg-gray-100 border border-gray-200 text-gray-500 hover:text-red-500 transition-colors z-20 cursor-pointer"
               title="Close"
             >
               <X size={20} strokeWidth={2.5} />
             </button>
             <h3 className="text-blue-600 font-semibold text-base mb-2 border-b border-gray-200 pb-1 pr-6">Parcel Info</h3>
             
             <div className="grid grid-cols-[100px_1fr] gap-y-1 text-xs text-gray-700 leading-tight">
               <span className="font-bold text-gray-900">County:</span>
               <span>{popupInfo.properties.county}</span>

               <span className="font-bold text-gray-900">Parcel ID:</span>
               <span>
                 {getPropertyAppraiserUrl(popupInfo.properties.county, popupInfo.properties.parcel_id) ? (
                   <button 
                     onClick={(e) => {
                         e.preventDefault();
                         e.stopPropagation();
                         // Auto-copy ID
                         if (popupInfo.properties.parcel_id) {
                            navigator.clipboard.writeText(popupInfo.properties.parcel_id).catch(() => {});
                         }
                         const url = getPropertyAppraiserUrl(popupInfo.properties.county, popupInfo.properties.parcel_id);
                         if (url) setExternalLink({ url, county: popupInfo.properties.county });
                     }}
                     className="text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1 focus:outline-none"
                     title="ID Copied! View on County Appraiser Site"
                   >
                     {popupInfo.properties.parcel_id}
                     <span className="text-[10px] text-gray-500 font-normal no-underline">↗</span>
                   </button>
                 ) : (
                   popupInfo.properties.parcel_id
                 )}
               </span>
               
               <span className="font-bold text-gray-900">Acres:</span>
               <span>{Number(popupInfo.properties.acreage).toFixed(2)}</span>
               
               <span className="font-bold text-gray-900">Land Use:</span>
               <span>{popupInfo.properties.land_use || 'N/A'}</span>
               
               <span className="font-bold text-gray-900">Property Value:</span>
               <span>${Number(popupInfo.properties.market_value).toLocaleString()}</span>
             </div>

             <div className="mt-3">
               <div className="font-bold text-gray-900 text-xs mb-0.5">Property Address:</div>
               <div className="text-gray-600 text-xs uppercase">
                   {popupInfo.properties.property_address || 'N/A'}
               </div>
             </div>

             <div className="mt-3">
               <div className="font-bold text-gray-900 text-xs mb-0.5 max-w-[250px] truncate">Owner: <span className="font-normal uppercase">{popupInfo.properties.owner_name}</span></div>
               <div className="font-bold text-gray-900 text-xs mb-0.5">Owner Address:</div>
               <div className="text-gray-600 text-xs uppercase">
                 {popupInfo.properties.owner_address}<br/>
                 {popupInfo.properties.owner_city}, {popupInfo.properties.owner_state} {popupInfo.properties.owner_zip}
               </div>
             </div>

              {/* Contact Info (Premium Blurring) */}
              <div className="mt-3 pt-2 border-t border-gray-100">
                  <div className="font-bold text-gray-900 text-xs mb-1">Contact Info:</div>
                  
                  {/* Phone */}
                  <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-gray-600">Phone:</span>
                      {userRole === 'admin' || userTier === 'paid' ? (
                          <span className="font-mono">{popupInfo.properties.owner_phone || 'N/A'}</span>
                      ) : (
                           <span 
                             onClick={(e) => { e.stopPropagation(); if(onUpsell) onUpsell(); }}
                             className="font-mono text-transparent bg-gray-200 rounded px-1 cursor-pointer select-none blur-[2px] hover:bg-gray-300 transition-colors"
                             title="Upgrade to view"
                           >
                              (555) 000-0000
                           </span>
                      )}
                  </div>

                  {/* Email */}
                  <div className="flex items-center justify-between text-xs">
                      <span className="text-gray-600">Email:</span>
                      {userRole === 'admin' || userTier === 'paid' ? (
                          <span className="font-mono">{popupInfo.properties.owner_email || 'N/A'}</span>
                      ) : (
                           <span 
                             onClick={(e) => { e.stopPropagation(); if(onUpsell) onUpsell(); }}
                             className="font-mono text-transparent bg-gray-200 rounded px-1 cursor-pointer select-none blur-[2px] hover:bg-gray-300 transition-colors"
                             title="Upgrade to view"
                           >
                              user@example.com
                           </span>
                      )}
                  </div>
              </div>

              {/* CRM Notes Section */}
              {/* CRM Notes Section */}
              {/* Notes Removed - See CRMPanel */}

              {/* Admin Edit Button */}
              {userRole === 'admin' && (
                  <button
                    onClick={(e) => {
                        e.stopPropagation();
                        setIsEditModalOpen(true);
                    }}
                    className="mt-3 w-full flex items-center justify-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-700 py-1.5 rounded-md text-xs font-medium transition-colors border border-gray-300"
                  >
                      <Edit2 size={14} />
                      Edit Parcel Data
                  </button>
              )}

           </div>
         </Popup>
        )}
      </Map>

      {/* Style Switcher */}
      <div className="absolute top-4 left-4 z-10">
        <div className="relative">
          <button
            onClick={() => setStyleMenuOpen(!styleMenuOpen)}
            className="bg-white dark:bg-slate-800 p-2 rounded-md shadow-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-slate-700 text-gray-700 dark:text-gray-200 transition-colors flex items-center gap-2"
          >
            <Layers className="w-5 h-5" />
            <span className="text-sm font-medium hidden sm:inline">Map Layers</span>
          </button>
          
          {styleMenuOpen && (
            <div className="absolute top-full left-0 mt-2 w-48 bg-white dark:bg-slate-800 rounded-md shadow-xl border border-gray-200 dark:border-gray-700 overflow-hidden py-1">
              {Object.entries(MAP_STYLES).map(([key, style]) => (
                <button
                  key={key}
                  onClick={() => {
                    setActiveStyle(key);
                    setStyleMenuOpen(false);
                  }}
                  className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors ${
                    activeStyle === key
                      ? 'text-blue-600 dark:text-blue-400 font-semibold bg-blue-50 dark:bg-slate-700/50' 
                      : 'text-gray-700 dark:text-gray-300'
                  }`}
                >
                  {style.label}
                </button>
              ))}

              <div className="border-t border-gray-200 dark:border-gray-700 mt-1 pt-1">
                <label className="flex items-center space-x-2 px-4 py-2 hover:bg-gray-100 dark:hover:bg-slate-700 cursor-pointer">
                   <input 
                     type="checkbox"
                     checked={showHighways}
                     onChange={(e) => setShowHighways(e.target.checked)}
                     className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                   />
                   <span className="text-sm text-gray-700 dark:text-gray-300">Show Highways</span>
                </label>
                <label className="flex items-center space-x-2 px-4 py-2 hover:bg-gray-100 dark:hover:bg-slate-700 cursor-pointer">
                   <input 
                     type="checkbox"
                     checked={showBoundaries}
                     onChange={(e) => setShowBoundaries(e.target.checked)}
                     className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                   />
                   <span className="text-sm text-gray-700 dark:text-gray-300">County Boundaries</span>
                </label>
              </div>

              <div className="border-t border-gray-200 dark:border-gray-700 mt-1 pt-1">
                 <div className="px-4 py-2">
                    <span className="block text-xs font-semibold text-gray-500 mb-1">Scale Units</span>
                    <div className="flex bg-gray-100 dark:bg-slate-700 rounded p-1">
                        <button
                          onClick={() => setScaleUnit('imperial')}
                          className={`flex-1 text-xs py-1 rounded transition-colors ${
                              scaleUnit === 'imperial' 
                              ? 'bg-white dark:bg-slate-600 shadow text-blue-600 dark:text-blue-400 font-medium' 
                              : 'text-gray-500 hover:text-gray-700'
                          }`}
                        >
                            Miles
                        </button>
                        <button
                          onClick={() => setScaleUnit('metric')}
                          className={`flex-1 text-xs py-1 rounded transition-colors ${
                              scaleUnit === 'metric' 
                              ? 'bg-white dark:bg-slate-600 shadow text-blue-600 dark:text-blue-400 font-medium' 
                              : 'text-gray-500 hover:text-gray-700'
                          }`}
                        >
                            Metric
                        </button>
                    </div>
                 </div>
              </div>
            </div>
          )}
        </div>
      </div>
      
         {/* Spatial Search Controls */}
       <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 flex gap-2 w-full justify-center pointer-events-none">
          {/* Container needs pointer-events-auto for children */}
          
          {/* IDLE STATE */}
          {!isDrawing && drawPoints.length === 0 && (
              <div className="pointer-events-auto flex gap-2 bg-white dark:bg-slate-800 p-1 rounded-full shadow-lg border border-gray-200 dark:border-gray-700">
                 <button
                     onClick={() => {
                         setIsDrawing(true);
                         setDrawPoints([]); // Reset
                     }}
                     className="flex items-center gap-2 px-4 py-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-full transition-all text-blue-600 dark:text-blue-400 font-bold text-sm"
                     title="Draw a custom search area on the map"
                 >
                     <Edit2 className="w-4 h-4" />
                     <span>DRAW SEARCH AREA</span>
                 </button>
              </div>
          )}

          {/* DRAWING STATE */}
          {isDrawing && (
              <div className="pointer-events-auto flex flex-col items-center gap-2">
                  <div className="flex gap-2">
                       <button
                          onClick={() => {
                              // Finish Drawing POLYGON
                              if (drawPoints.length >= 3) {
                                  const polygon = {
                                      type: 'Feature',
                                      geometry: {
                                          type: 'Polygon',
                                          coordinates: [[...drawPoints, drawPoints[0]]]
                                      }
                                  };
                                  
                                  try {
                                      // @ts-ignore
                                      const bbox = turf.bbox(polygon);
                                      if (onSearchArea) {
                                          onSearchArea([bbox[1], bbox[3], bbox[0], bbox[2]], polygon);
                                      }
                                  } catch (e) {
                                      console.error('Error calculating bbox', e);
                                  }
                                  setIsDrawing(false);
                              } else {
                                  alert("Please click at least 3 points on the map to define an area.");
                              }
                          }}
                          className={`flex items-center gap-2 px-6 py-2 rounded-full shadow-xl transition-all font-bold text-sm animate-in fade-in zoom-in duration-200 ${
                              drawPoints.length >= 3 
                              ? 'bg-blue-600 hover:bg-blue-700 text-white ring-4 ring-blue-500/30 scale-105' 
                              : 'bg-gray-400 text-white cursor-not-allowed'
                          }`}
                          disabled={drawPoints.length < 3}
                       >
                          <CheckCircle2 className="w-5 h-5" />
                          <span>APPLY SEARCH AREA</span>
                       </button>
                       
                       <button
                          onClick={() => {
                              setIsDrawing(false);
                              setDrawPoints([]);
                          }}
                          className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 text-red-500 rounded-full shadow-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 transition-all font-semibold text-sm"
                       >
                          <X className="w-4 h-4" />
                          <span>Cancel</span>
                       </button>
                  </div>
                  
                  {/* Instructional Banner */}
                  <div className="bg-black/75 text-white px-3 py-1 rounded-md text-xs backdrop-blur-sm">
                      {drawPoints.length === 0 ? "Click map to start drawing" : 
                       drawPoints.length < 3 ? "Click more points..." : 
                       "Shape ready! Click 'APPLY SEARCH AREA' above"}
                  </div>
              </div>
          )}

          {/* HAS DRAWN SHAPE STATE (Active Filter) */}
          {!isDrawing && drawPoints.length > 0 && (
              <div className="pointer-events-auto flex gap-2">
                  <div className="flex items-center gap-2 px-4 py-2 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full shadow-lg border border-blue-200 dark:border-blue-700 font-semibold text-sm">
                     <ScanSearch className="w-4 h-4" />
                     <span>Custom Area Active</span>
                  </div>
                  
                  <button
                     onClick={() => setIsShapeVisible(!isShapeVisible)}
                     className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-slate-800 text-gray-700 dark:text-gray-300 rounded-full shadow-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 transition-all font-medium text-sm"
                     title={isShapeVisible ? "Hide Shape Overlay" : "Show Shape Overlay"}
                  >
                     {isShapeVisible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                     <span>{isShapeVisible ? "Hide" : "Show"}</span>
                  </button>

                  <button
                     onClick={() => {
                         // Clear Visuals
                         setDrawPoints([]); 
                         
                         // Clear Data Filter
                         if (onSearchArea) {
                             // Send undefined shape and empty bounds to reset filter
                             onSearchArea([0, 0, 0, 0], undefined);
                         }
                     }}
                     className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 text-gray-700 dark:text-gray-300 rounded-full shadow-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 transition-all font-semibold text-sm group"
                  >
                     <X className="w-4 h-4 text-gray-400 group-hover:text-red-500" />
                     <span>Clear Shape</span>
                  </button>
              </div>
          )}
       </div>

      {/* Measure Tool Control - Keep separate */}
      <div className="absolute top-26 right-3 z-10 flex flex-col gap-2">
         <button
            onClick={() => {
                setIsMeasureMode(!isMeasureMode);
                setMeasurePoints([]);
                setMeasureDistance(null);
            }}
            className={`p-2 rounded-md shadow-lg transition-colors border ${
                isMeasureMode 
                ? 'bg-cyan-600 text-white border-cyan-700' 
                : 'bg-white dark:bg-slate-800 text-gray-700 dark:text-gray-200 border-gray-200 dark:border-gray-700 hover:bg-gray-50'
            }`}
            title="Measure Distance"
         >
            <Ruler className="w-5 h-5" />
         </button>
      </div>

      {/* Measure Result */}
      {measureDistance !== null && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-white dark:bg-slate-900 px-4 py-2 rounded-lg shadow-xl border-l-4 border-cyan-500 z-20 flex items-center gap-3">
             <div>
                <div className="text-xs text-gray-500 dark:text-gray-300 font-bold uppercase tracking-wider">Distance</div>
                <div className="text-lg font-bold text-gray-900 dark:text-white">
                    {measureDistance.toFixed(2)} <span className="text-sm font-normal text-gray-500 dark:text-gray-400">miles</span>
                </div>
             </div>
             <button 
               onClick={() => {
                   setMeasurePoints([]);
                   setMeasureDistance(null);
               }}
               className="ml-2 p-1 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-full text-gray-500 dark:text-gray-300 hover:text-gray-700 dark:hover:text-white transition-colors"
            >
                <X size={16} />
             </button>
          </div>
      )}
      
       {isLoading && (
         <div className="absolute inset-0 bg-black/20 backdrop-blur-[1px] flex items-center justify-center z-50">
             <div className="bg-white dark:bg-slate-900 p-4 rounded-lg shadow-xl flex items-center gap-3">
                 <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                 <span className="text-sm font-medium text-gray-900 dark:text-white">Loading Map Data...</span>
             </div>
         </div>
      )}

      {/* Admin Edit Modal */}
      {isEditModalOpen && popupInfo && (
          <EditParcelModal
            isOpen={isEditModalOpen}
            onClose={() => setIsEditModalOpen(false)}
            parcel={popupInfo}
            onSave={handleSaveParcel}
          />
      )}
      {/* External Link Confirmation */}
      <ConfirmModal 
        isOpen={!!externalLink}
        onClose={() => setExternalLink(null)}
        onConfirm={() => {
            if (externalLink) window.open(externalLink.url, '_blank');
        }}
        title="Leaving Land Oracle"
        message={
            (externalLink?.county?.toLowerCase() === 'union' || externalLink?.county?.toLowerCase() === 'bradford' || externalLink?.county?.toLowerCase() === 'putnam') 
            ? `You are visiting the ${externalLink?.county} GIS. Direct linking is restricted, so we have copied the Parcel ID to your clipboard. Please PASTE it into the search bar.`
            : `You are about to visit the ${externalLink?.county || 'County'} Property Appraiser's official website.`
        }
        confirmLabel="Continue to Site"
        isExternal={true}
      />
    </div>
  );
}

