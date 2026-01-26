'use client';

import { X, ExternalLink, AlertTriangle } from 'lucide-react';

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  isExternal?: boolean;
}

export default function ConfirmModal({ 
  isOpen, 
  onClose, 
  onConfirm, 
  title, 
  message, 
  confirmLabel = "Confirm",
  isExternal = false
}: ConfirmModalProps) {
  
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-900 rounded-lg shadow-2xl w-full max-w-sm overflow-hidden border border-gray-200 dark:border-gray-700 transform transition-all scale-100 opacity-100">
        
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-slate-800/50">
          <div className="flex items-center gap-2 text-amber-600 dark:text-amber-500">
             {isExternal ? <ExternalLink size={20} /> : <AlertTriangle size={20} />}
             <h3 className="font-semibold text-gray-900 dark:text-white">{title}</h3>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-gray-200 dark:hover:bg-slate-700 rounded-full transition-colors">
            <X size={18} className="text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5">
           <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
             {message}
           </p>
        </div>

        {/* Footer */}
        <div className="px-4 py-3 bg-gray-50 dark:bg-slate-800/50 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-700 rounded-md transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => {
                onConfirm();
                onClose();
            }}
            className="flex items-center gap-2 px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-md shadow-sm transition-colors"
          >
            {isExternal && <ExternalLink size={14} />}
            {confirmLabel}
          </button>
        </div>

      </div>
    </div>
  );
}
