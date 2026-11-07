'use client';

import { useEffect, useState } from 'react';
import { getAdminUsers, toggleBetaAccess, setUserTier, type AdminTier } from './actions';
import { Loader2, CheckCircle, XCircle, Search, Shield, User } from 'lucide-react';
import { format } from 'date-fns';

type UserData = {
    id: number;
    email: string;
    created_at: string;
    subscription_tier: string;
    role: string;
    beta_access: boolean;
    searches_today: string; // Counts return as string in pg
    counties_count: string;
};

export default function AdminPage() {
    const [users, setUsers] = useState<UserData[]>([]);
    const [loading, setLoading] = useState(true);
    const [toggling, setToggling] = useState<number | null>(null);

    async function load() {
        const data = await getAdminUsers();
        setUsers(data as any);
        setLoading(false);
    }

    useEffect(() => {
        load();
    }, []);

    const handleToggle = async (id: number, current: boolean) => {
        setToggling(id);
        await toggleBetaAccess(id, !current);
        await load();
        setToggling(null);
    };

    const handleTierChange = async (id: number, tier: AdminTier) => {
        setToggling(id);
        await setUserTier(id, tier);
        await load();
        setToggling(null);
    };

    const TIERS: AdminTier[] = ['demo', 'scout', 'local', 'regional', 'statewide', 'enterprise'];

    if (loading) return <div className="p-12 flex justify-center"><Loader2 className="animate-spin text-blue-500 w-8 h-8" /></div>;

    return (
        <div className="max-w-7xl mx-auto p-6">
            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-2xl">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-950/50 text-slate-400 text-sm uppercase tracking-wider">
                                <th className="p-4 font-medium">User</th>
                                <th className="p-4 font-medium">Joined</th>
                                <th className="p-4 font-medium">Tier & Role</th>
                                <th className="p-4 font-medium text-center">Activity</th>
                                <th className="p-4 font-medium text-right">Beta Access</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800">
                            {users.map((user) => (
                                <tr key={user.id} className="hover:bg-slate-800/30 transition-colors">
                                    <td className="p-4">
                                        <div className="font-semibold text-white">{user.email}</div>
                                        <div className="text-xs text-slate-500">ID: {user.id}</div>
                                    </td>
                                    <td className="p-4 text-slate-400 text-sm">
                                        {format(new Date(user.created_at), 'MMM d, yyyy')}
                                    </td>
                                    <td className="p-4">
                                        <div className="flex items-center gap-2">
                                            <select
                                                value={TIERS.includes(user.subscription_tier as AdminTier) ? user.subscription_tier : 'demo'}
                                                onChange={(e) => handleTierChange(user.id, e.target.value as AdminTier)}
                                                disabled={toggling === user.id}
                                                className="bg-slate-800 border border-slate-700 text-slate-200 text-xs font-semibold uppercase rounded px-2 py-1 focus:outline-none focus:border-blue-500"
                                            >
                                                {TIERS.map((t) => (
                                                    <option key={t} value={t}>{t}</option>
                                                ))}
                                            </select>
                                            {user.role === 'admin' && (
                                                <span className="flex items-center gap-1 text-xs text-yellow-500 font-bold border border-yellow-500/30 px-2 py-0.5 rounded-full bg-yellow-500/10">
                                                    <Shield className="w-3 h-3" /> Admin
                                                </span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="p-4 text-center">
                                         <div className="text-sm text-slate-300">
                                            {user.searches_today} <span className="text-slate-500">searches</span>
                                         </div>
                                         <div className="text-xs text-slate-500">
                                            {user.counties_count} counties
                                         </div>
                                    </td>
                                    <td className="p-4 text-right">
                                        <button 
                                            onClick={() => handleToggle(user.id, user.beta_access)}
                                            disabled={toggling === user.id}
                                            className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                                                user.beta_access 
                                                    ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30 border border-green-500/30' 
                                                    : 'bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-slate-700'
                                            }`}
                                        >
                                            {toggling === user.id ? (
                                                <Loader2 className="w-4 h-4 animate-spin" />
                                            ) : user.beta_access ? (
                                                <><CheckCircle className="w-4 h-4" /> Approved</>
                                            ) : (
                                                <><XCircle className="w-4 h-4" /> Blocked</>
                                            )}
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
            
            <div className="mt-8 text-center text-slate-500 text-sm">
                Only users with "Approved" status or "Admin" role can access the dashboard.
            </div>
        </div>
    );
}
