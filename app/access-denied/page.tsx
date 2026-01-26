import Link from 'next/link';

export default function AccessDenied() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-950 text-white p-4 text-center">
      <div className="max-w-md space-y-6">
        <h1 className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400">
          Private Beta
        </h1>
        <p className="text-slate-300 text-lg">
          Land Oracle is currently in invite-only preview. 
          Your account has been created, but you do not have access to the dashboard yet.
        </p>
        <div className="p-4 bg-slate-900 rounded-lg border border-slate-800 text-sm text-slate-400">
          Viewing as: <span className="font-mono text-blue-300">Logged In User</span>
        </div>
        <div className="pt-4">
            <Link href="/" className="text-blue-400 hover:text-blue-300 underline underline-offset-4">
                Return to Home
            </Link>
        </div>
      </div>
    </div>
  );
}
