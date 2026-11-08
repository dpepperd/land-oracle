import { MapPin, StickyNote, Home } from 'lucide-react';

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
}

interface ParcelCardProps {
  parcel: Parcel;
  onMarkLead: (parcelId: string) => void;
  onSelect: (parcel: Parcel) => void;
  isMarking: boolean;
}

export default function ParcelCard({ parcel, onMarkLead, onSelect, isMarking }: ParcelCardProps) {
  return (
    <div 
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
            {parcel.county} County
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
