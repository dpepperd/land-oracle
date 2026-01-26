'use client';

import { useState } from 'react';
import { X, Save, Loader2 } from 'lucide-react';

interface EditParcelModalProps {
  isOpen: boolean;
  onClose: () => void;
  parcel: any;
  onSave: (updatedData: any) => Promise<void>;
}

export default function EditParcelModal({ isOpen, onClose, parcel, onSave }: EditParcelModalProps) {
  const [formData, setFormData] = useState({
    phone_number: parcel?.properties?.phone_number || '',
    phone_verified: parcel?.properties?.phone_verified || false,
    email: parcel?.properties?.email || '',
    email_verified: parcel?.properties?.email_verified || false,
    notes: parcel?.properties?.notes || '',
    owner_name: parcel?.properties?.owner_name || ''
  });
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen || !parcel) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setError('');

    try {
      await onSave({
        ...formData,
        id: parcel.properties.parcel_id
      });
      onClose();
    } catch (err) {
      setError('Failed to save changes. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-900 rounded-lg shadow-2xl w-full max-w-md overflow-hidden border border-gray-200 dark:border-gray-700">
        
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-slate-800/50">
          <h3 className="font-semibold text-gray-900 dark:text-white">Edit Parcel Data</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-200 dark:hover:bg-slate-700 rounded-full transition-colors">
            <X size={20} className="text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
           {error && (
             <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-3 rounded-md text-sm">
               {error}
             </div>
           )}

           {/* Owner Name */}
           <div>
             <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
               Owner Name
             </label>
             <input
               type="text"
               value={formData.owner_name}
               onChange={(e) => setFormData(prev => ({ ...prev, owner_name: e.target.value }))}
               className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
             />
           </div>

           {/* Phone Number */}
           <div>
             <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
               Phone Number <span className="text-xs text-gray-500 font-normal">(Admin Only)</span>
             </label>
             <div className="flex gap-2">
                 <input
                   type="text"
                   value={formData.phone_number}
                   onChange={(e) => setFormData(prev => ({ ...prev, phone_number: e.target.value }))}
                   placeholder="(555) 123-4567"
                   className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                 />
                 <label className="flex items-center gap-2 px-3 border border-gray-200 dark:border-gray-700 rounded-md cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors">
                    <input 
                      type="checkbox" 
                      checked={formData.phone_verified}
                      onChange={(e) => setFormData(prev => ({ ...prev, phone_verified: e.target.checked }))}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-600 dark:text-gray-400">Verified</span>
                 </label>
             </div>
           </div>

           {/* Email */}
           <div>
             <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
               Email Address
             </label>
             <div className="flex gap-2">
                 <input
                   type="email"
                   value={formData.email}
                   onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                   placeholder="owner@example.com"
                   className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                 />
                 <label className="flex items-center gap-2 px-3 border border-gray-200 dark:border-gray-700 rounded-md cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors">
                    <input 
                      type="checkbox" 
                      checked={formData.email_verified}
                      onChange={(e) => setFormData(prev => ({ ...prev, email_verified: e.target.checked }))}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-600 dark:text-gray-400">Verified</span>
                 </label>
             </div>
           </div>

           {/* Notes */}
           <div>
             <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
               Internal Notes
             </label>
             <textarea
               value={formData.notes}
               onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
               rows={4}
               placeholder="Add internal notes here..."
               className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all resize-none"
             />
           </div>

           {/* Footer */}
           <div className="pt-2 flex justify-end gap-3">
             <button
               type="button"
               onClick={onClose}
               className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-md transition-colors"
             >
               Cancel
             </button>
             <button
               type="submit"
               disabled={isSaving}
               className="flex items-center gap-2 px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-md shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
             >
               {isSaving ? (
                 <>
                   <Loader2 size={16} className="animate-spin" />
                   Saving...
                 </>
               ) : (
                 <>
                   <Save size={16} />
                   Save Changes
                 </>
               )}
             </button>
           </div>
        </form>
      </div>
    </div>
  );
}
