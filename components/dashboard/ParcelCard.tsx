import { MapPin, StickyNote, Home, Droplets } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { floodLabel, FLOOD_TONE_CLASS } from '@/lib/floodLabel';
import { useFlood, requestFlood } from '@/lib/floodClient';

interface Parcel {
  parcel_id: string;
  parcel_key: string;
  county: string;
  owner_name: string;
  owner_state: string;
  acreage: number;
  owner_city?: string;
  is_lead?: boolean;
  has_note?: boolean;
  property_address?: string;
  flood_lat?: number | null;
  flood_lon?: number | null;
  latitude?: number | null;
  longitude?: number | null;
  is_absentee?: boolean;
  out_of_state?: boolean;
  sale1_date?: string | null;
  has_outline?: boolean;
  state?: string;
  likely_vacant?: boolean;
}

interface ParcelCardProps {
  parcel: Parcel;
  onMarkLead: (parcelId: string) => void;
  onSelect: (parcel: Parcel) => void;
  isMarking: boolean;
}

export default function ParcelCard({ parcel, onMarkLead, onSelect, isMarking }: ParcelCardProps) {
  const ref = useRef<HTMLDivElement>(null);
  const flood = useFlood(parcel.parcel_key);
  // Look up the flood zone only once the card scrolls into view
  useEffect(() => {
    const el = ref.current;
    if (!el || flood) return;
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        requestFlood(parcel.parcel_key, parcel.flood_lat ?? parcel.latitude, parcel.flood_lon ?? parcel.longitude);
        io.disconnect();
      }
    }, { rootMargin: '200px' });
    io.observe(el);
    return () => io.disconnect();
  }, [parcel, flood]);
  return (
    <div 
      ref={ref}
      onClick={() => onSelect(parcel)}
      className="bg-theme-card p-4 rounded-lg shadow-sm border border-theme hover:shadow-md transition-shadow cursor-pointer"
    >
      <div className="flex justify-between items-start">
        <div>
          <h3 className="text-sm font-semibold text-theme-primary truncate max-w-[200px] flex items-center gap-2" title={parcel.owner_name}>
            {parcel.owner_name || 'Unknown Owner'}
            {parcel.has_note && <StickyNote className="w-3.5 h-3.5 text-amber-500 fill-amber-100" />}
          </h3>
          <p className="text-xs text-theme-secondary flex items-center gap-1 mt-1">
            <MapPin className="w-3 h-3" />
            {parcel.county} County{parcel.state === 'NC' ? ', NC' : ''}
          </p>
          {parcel.property_address && (
            <p className="text-xs text-theme-secondary flex items-center gap-1 mt-1 font-medium pb-1">
              <Home className="w-3 h-3" />
              {parcel.property_address}
            </p>
          )}
        </div>
        <div className="text-right">
          <span className="inline-block bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 text-xs px-2 py-0.5 rounded-full font-medium">
            {Number(parcel.acreage).toFixed(2)} ac
          </span>
        </div>
      </div>
      
      {(() => {
        const fl = floodLabel(flood);
        return fl ? (
          <span className={`mt-2 inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full font-medium ${FLOOD_TONE_CLASS[fl.tone]}`}>
            <Droplets className="w-3 h-3" />{fl.text}
          </span>
        ) : null;
      })()}
      {(parcel.is_absentee || parcel.out_of_state || parcel.likely_vacant || (parcel.state !== 'NC' && parcel.sale1_date === null)) && (
        <div className="mt-2 flex flex-wrap gap-1">
          {parcel.out_of_state && <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-200 font-medium">Out of state</span>}
          {parcel.is_absentee && !parcel.out_of_state && <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-200 font-medium">Absentee</span>}
          {parcel.likely_vacant && <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 font-medium">Likely vacant</span>}
          {parcel.state !== 'NC' && parcel.sale1_date === null && <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-medium">No sale on record</span>}
        </div>
      )}

      {parcel.has_outline === false && (
        <span className="mt-2 inline-flex items-center text-[10px] px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-medium" title="The county map file has no outline for this parcel yet. It is still in your results and exports.">
          No map outline
        </span>
      )}

      <div className="mt-3 flex items-center justify-between">
        <div className="text-xs text-theme-secondary">
          State: <span className="font-medium text-theme-primary">{parcel.owner_state || 'N/A'}</span>
        </div>
        
        <button
          onClick={(e) => {
            e.stopPropagation();
            onMarkLead(parcel.parcel_key);
          }}
          disabled={parcel.is_lead || isMarking}
          className={`text-xs px-3 py-1.5 rounded transition-colors ${
            parcel.is_lead 
              ? 'bg-green-100 text-green-700 cursor-default'
              : 'bg-theme-sidebar text-theme-primary hover:bg-theme-input border border-theme'
          }`}
        >
          {parcel.is_lead ? 'Saved Lead' : isMarking ? 'Saving...' : 'Mark as Lead'}
        </button>
      </div>
    </div>
  );
}
