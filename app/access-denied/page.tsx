import Link from 'next/link';

export default function AccessDenied() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-950 text-white p-4 text-center">
      <div className="max-w-md space-y-6">
        <h1 className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400">
          One more step
        </h1>
        <p className="text-slate-300 text-lg">
          Your account is ready. Choose a plan to unlock the dashboard and start searching parcels.
        </p>
        <p className="text-slate-400 text-sm">
          Already paid? Your plan turns on within a minute or two. Refresh this page, or contact support if it does not.
        </p>
        <div className="pt-4 flex flex-col items-center gap-4">
            <Link href="/pricing" className="inline-block px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold transition-colors">
                See plans
            </Link>
            <Link href="/contact" className="text-blue-400 hover:text-blue-300 underline underline-offset-4">
                Contact support
            </Link>
            <Link href="/" className="text-slate-500 hover:text-slate-300 text-sm">
                Return to Home
            </Link>
        </div>
      </div>
    </div>
  );
}
