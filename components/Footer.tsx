import Link from 'next/link';
import { Twitter, Linkedin, Facebook, MapPin, Mail, Phone } from 'lucide-react';

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="w-full bg-zinc-100 dark:bg-zinc-900 border-t border-zinc-200 dark:border-zinc-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand Column */}
          <div className="space-y-4">
            <h3 className="text-xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
              LandOracle.ai
            </h3>
            <p className="text-base font-bold text-zinc-800 dark:text-white mt-1">
              Land intelligence that helps you understand parcels faster and avoid costly surprises.
            </p>
            <div className="flex space-x-4 pt-2">
              <Link href="#" className="text-zinc-500 hover:text-blue-600 transition-colors">
                <Twitter size={20} />
              </Link>
              <Link href="#" className="text-zinc-500 hover:text-blue-600 transition-colors">
                <Linkedin size={20} />
              </Link>
              <Link href="#" className="text-zinc-500 hover:text-blue-600 transition-colors">
                <Facebook size={20} />
              </Link>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="font-semibold text-zinc-900 dark:text-zinc-100 mb-4">Platform</h4>
            <ul className="space-y-2 text-sm text-zinc-600 dark:text-zinc-400">
              <li><Link href="/dashboard" className="hover:text-blue-600 transition-colors">Dashboard</Link></li>
              <li><Link href="/pricing" className="hover:text-blue-600 transition-colors">Pricing</Link></li>
            </ul>
          </div>

          {/* Company */}
          <div>
            <h4 className="font-semibold text-zinc-900 dark:text-zinc-100 mb-4">Company</h4>
            <ul className="space-y-2 text-sm text-zinc-600 dark:text-zinc-400">
              <li><Link href="/about" className="hover:text-blue-600 transition-colors">About Us</Link></li>
              <li><Link href="/contact" className="hover:text-blue-600 transition-colors">Contact</Link></li>
            </ul>
          </div>

          {/* Contact Info */}
          <div>
            <h4 className="font-semibold text-zinc-900 dark:text-zinc-100 mb-4">Contact</h4>
            <ul className="space-y-3 text-sm text-zinc-600 dark:text-zinc-400">
              <li className="flex items-center gap-2">
                <Mail size={16} className="text-blue-600" />
                <span>support@landoracle.ai</span>
              </li>
              <li className="flex items-center gap-2">
                <Phone size={16} className="text-blue-600" />
                <span>+1 (800) 555-LAND</span>
              </li>
              <li className="flex items-start gap-2">
                <MapPin size={16} className="text-blue-600 mt-0.5" />
                <span>
                  100 Tech Blvd, Suite 200<br />
                  Miami, FL 33132
                </span>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-zinc-200 dark:border-zinc-800 mt-12 pt-8 flex flex-col md:flex-row justify-between items-center gap-4 text-xs text-zinc-500">
          <p>© {currentYear} LandOracle AI. All rights reserved.</p>
          <div className="flex gap-6">
            <Link href="/privacy" className="hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors">Privacy Policy</Link>
            <Link href="/terms" className="hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors">Terms of Service</Link>
            <Link href="/acceptable-use" className="hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors">Acceptable Use</Link>
            <Link href="/data-disclaimer" className="hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors">Data Disclaimer</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
