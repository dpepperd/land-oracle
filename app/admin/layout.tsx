import { requireAdmin } from '@/lib/auth-guard';

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAdmin();
  
  return (
    <div className="min-h-screen bg-slate-950 text-white">
        <div className="border-b border-slate-800 bg-slate-900/50 backdrop-blur sticky top-0 z-10">
            <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
                <h1 className="text-xl font-bold text-blue-400">Land Oracle Admin</h1>
                <div className="text-sm text-slate-400">Dirk & Tatjana Control Center</div>
            </div>
        </div>
      {children}
    </div>
  );
}
