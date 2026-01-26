import { useState, useEffect } from 'react';
import { X, Phone, Mail, User, MapPin, Calendar, Save, Clock } from 'lucide-react';
import { useAuth } from "@clerk/nextjs";

interface CRMPanelProps {
  parcel: any;
  onClose: () => void;
  userRole?: string;
  userTier?: string;
  onUpsell?: () => void;
}

export default function CRMPanel({ parcel, onClose, userRole, userTier, onUpsell }: CRMPanelProps) {
  const [notes, setNotes] = useState<any[]>([]);
  const [newNote, setNewNote] = useState('');
  const [isNoteLoading, setIsNoteLoading] = useState(false);
  const [isNoteSaving, setIsNoteSaving] = useState(false);

  // Fetch Notes on Mount or Parcel Change
  useEffect(() => {
    if (parcel?.parcel_id) {
        // Analytics: Track View
        import('@/lib/analytics').then(({ trackPropertyView }) => {
            trackPropertyView({
                parcelId: parcel.parcel_id,
                county: parcel.county,
                acreage: parcel.acreage,
                ownerState: parcel.owner_state
            });
        });

        setIsNoteLoading(true);
        setNotes([]);
        setNewNote('');
        
        console.log("[CRM] Fetching notes for:", parcel.parcel_id);
        
        fetch(`/api/notes/${parcel.parcel_id}`)
            .then(res => res.json())
            .then(data => {
                setNotes(data.notes || []);
            })
            .catch(err => console.error("Failed to load notes", err))
            .finally(() => setIsNoteLoading(false));
    }
  }, [parcel?.parcel_id]);

  const handleSaveNote = async () => {
    if (!parcel?.parcel_id || !newNote.trim()) return;
    
    setIsNoteSaving(true);
    try {
        const res = await fetch('/api/notes/save', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                parcelId: parcel.parcel_id,
                note: newNote
            })
        });
        
        if (res.ok) {
            // Optimistic Append
            const freshNote = {
                id: Math.random(),
                note: newNote,
                created_at: new Date().toISOString(),
                author: 'me'
            };
            setNotes([freshNote, ...notes]);
            setNewNote('');
            
            // Analytics
            import('@/lib/analytics').then(({ trackCRMAction }) => {
                trackCRMAction({ action: 'note_added', parcelId: parcel.parcel_id });
            });
        }
    } catch (e) {
        console.error("Save note failed", e);
    } finally {
        setIsNoteSaving(false);
    }
  };

  if (!parcel) return null;

  return (
    <div className="h-full flex flex-col bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700 shadow-xl overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-gray-100 dark:border-gray-700 flex justify-between items-start bg-gray-50 dark:bg-gray-900/50">
        <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                Parcel Details
                <span className="text-xs font-normal text-gray-500 bg-gray-200 dark:bg-gray-700 px-2 py-0.5 rounded-full">
                    {parcel.county}
                </span>
            </h2>
            <div className="text-sm text-blue-600 font-mono mt-0.5">{parcel.parcel_id}</div>
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 p-1 hover:bg-gray-200 rounded-full transition-colors">
            <X size={20} />
        </button>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        
        {/* Quick Stats */}
        <div className="grid grid-cols-2 gap-4">
            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-100 dark:border-blue-900/50">
                <div className="text-xs text-blue-600 dark:text-blue-400 uppercase font-semibold mb-1">Market Value</div>
                <div className="text-lg font-bold text-gray-900 dark:text-white">${Number(parcel.market_value).toLocaleString()}</div>
            </div>
            <div className="p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg border border-emerald-100 dark:border-emerald-900/50">
                <div className="text-xs text-emerald-600 dark:text-emerald-400 uppercase font-semibold mb-1">Size</div>
                <div className="text-lg font-bold text-gray-900 dark:text-white">{Number(parcel.acreage).toFixed(2)} ac</div>
            </div>
        </div>

        {/* Property Info */}
        <div>
            <h3 className="text-sm font-extrabold text-blue-900 dark:text-gray-100 uppercase tracking-wider mb-3 flex items-center gap-2">
                <MapPin size={14} /> Property Location
            </h3>
            <div className="bg-white dark:bg-gray-700/50 rounded-lg p-3 text-base text-black dark:text-white border border-gray-200 dark:border-gray-600 shadow-sm">
                <div className="font-bold text-lg">{parcel.property_address || 'No Site Address'}</div>
                <div className="text-sm font-semibold text-gray-700 dark:text-gray-300 mt-1">{parcel.land_use}</div>
            </div>
        </div>

        {/* Ownership */}
        <div>
            <h3 className="text-sm font-extrabold text-blue-900 dark:text-gray-100 uppercase tracking-wider mb-3 flex items-center gap-2">
                <User size={14} /> Owner Information
            </h3>
            <div className="bg-white dark:bg-gray-700/50 rounded-lg p-3 text-sm border border-gray-200 dark:border-gray-600 shadow-sm space-y-2">
                <div className="font-bold text-lg text-black dark:text-white">{parcel.owner_name}</div>
                <div className="text-base font-medium text-gray-800 dark:text-gray-200 whitespace-pre-line">
                    {parcel.owner_address}<br/>
                    {parcel.owner_city}, {parcel.owner_state} {parcel.owner_zip}
                </div>
                
                {/* Contacts */}
                <div className="pt-2 mt-2 border-t border-gray-200 dark:border-gray-600 space-y-2">
                     <div className="flex items-center justify-between text-xs">
                         <span className="text-gray-500 flex items-center gap-1"><Phone size={10}/> Phone</span>
                         {userRole === 'admin' || userTier === 'paid' ? (
                            <span className="font-mono">{parcel.owner_phone || 'N/A'}</span>
                         ) : (
                            <span onClick={onUpsell} className="font-mono blur-[2px] cursor-pointer hover:bg-gray-200 px-1 rounded transition-all select-none">(555) 555-5555</span>
                         )}
                     </div>
                     <div className="flex items-center justify-between text-xs">
                         <span className="text-gray-500 flex items-center gap-1"><Mail size={10}/> Email</span>
                         {userRole === 'admin' || userTier === 'paid' ? (
                            <span className="font-mono">{parcel.owner_email || 'N/A'}</span>
                         ) : (
                            <span onClick={onUpsell} className="font-mono blur-[2px] cursor-pointer hover:bg-gray-200 px-1 rounded transition-all select-none">user@example.com</span>
                         )}
                     </div>
                </div>
            </div>
        </div>

        {/* CRM Notes */}
        <div className="pt-2">
            <h3 className="text-sm font-extrabold text-blue-900 dark:text-gray-100 uppercase tracking-wider mb-3 flex items-center gap-2">
                <Clock size={14} /> Notes History
            </h3>
            
            <div className="max-h-[300px] overflow-y-auto mb-3 space-y-3 pr-1">
                {notes.length === 0 && !isNoteLoading && (
                    <div className="text-center py-6 text-gray-500 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-dashed border-gray-300 dark:border-gray-600">
                        <p className="text-sm font-bold text-gray-700 dark:text-gray-300">No notes yet.</p>
                        <p className="text-xs font-medium mt-1">Start tracking this lead below.</p>
                    </div>
                )}
                
                {notes.map((n) => (
                    <div key={n.id || Math.random()} className="bg-amber-50 dark:bg-amber-900/10 p-3 rounded-lg border border-amber-100 dark:border-amber-900/30 relative group">
                        <p className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap leading-tight">{n.note}</p>
                        <div className="flex justify-between items-end mt-2">
                            <span className="text-[10px] text-gray-400 flex items-center gap-1">
                                {new Date(n.created_at).toLocaleDateString()}
                                <span className="opacity-50">|</span>
                                {new Date(n.created_at).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}
                            </span>
                            {n.author && n.author !== 'me' && (
                                <span className="text-[10px] font-bold text-amber-600 bg-amber-100 px-1.5 py-0.5 rounded-full">
                                    {n.author}
                                </span>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            <div className="relative">
                <textarea
                    value={newNote}
                    onChange={(e) => setNewNote(e.target.value)}
                    placeholder="Add a new note..."
                    className="w-full text-sm font-medium p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent min-h-[80px] resize-none bg-white text-black dark:bg-gray-700 dark:text-white shadow-sm placeholder:text-gray-500"
                    disabled={isNoteSaving}
                />
                <div className="absolute bottom-2 right-2">
                    <button 
                        onClick={handleSaveNote}
                        disabled={isNoteSaving || !newNote.trim()}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-md text-xs font-semibold shadow-sm transition-all flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isNoteSaving ? 'Saving...' : <><Save size={12}/> Save Note</>}
                    </button>
                </div>
            </div>
        </div>

      </div>
    </div>
  );
}
