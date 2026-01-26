"use client";

import { UserButton } from "@clerk/nextjs";
import Link from "next/link";
import { useTheme } from "next-themes";
import { Moon, Sun, Menu, X, Globe, Phone, Info, LifeBuoy, CreditCard, Map } from "lucide-react";
import { useState, useEffect } from "react";

export default function Header() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => setMounted(true), []);

  const toggleTheme = () => {
    setTheme(theme === "dark" ? "light" : "dark");
  };

  return (
    <header className="bg-slate-900 border-b border-slate-800 text-white shadow-md z-50 sticky top-0">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        
        {/* Logo */}
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shadow-lg shadow-blue-900/50">
            <Globe className="w-5 h-5 text-white" />
          </div>
          <Link href="/dashboard" className="text-xl font-bold tracking-tight">
            <span className="text-blue-400">Land</span>Oracle.ai
          </Link>
        </div>

        {/* Desktop Nav */}
        <nav className="hidden md:flex items-center gap-8">
          <Link href="/" className="text-sm font-medium text-slate-300 hover:text-white hover:underline decoration-blue-500 underline-offset-4 transition-colors">
            Home
          </Link>
          <Link href="/pricing" className="text-sm font-medium text-slate-300 hover:text-white hover:underline decoration-blue-500 underline-offset-4 transition-colors">
            Pricing
          </Link>
          <Link href="/dashboard/settings" className="text-sm font-medium text-slate-300 hover:text-white hover:underline decoration-blue-500 underline-offset-4 transition-colors">
            Territories
          </Link>
          <Link href="/about" className="text-sm font-medium text-slate-300 hover:text-white hover:underline decoration-blue-500 underline-offset-4 transition-colors">
            About
          </Link>
          <Link href="/contact" className="text-sm font-medium text-slate-300 hover:text-white hover:underline decoration-blue-500 underline-offset-4 transition-colors">
            Contact
          </Link>
          <Link href="/support" className="text-sm font-medium text-slate-300 hover:text-white hover:underline decoration-blue-500 underline-offset-4 transition-colors">
            Support
          </Link>
        </nav>

        {/* Right Actions */}
        <div className="flex items-center gap-4">
          {mounted && (
            <button
              onClick={toggleTheme}
              className="p-2 rounded-full hover:bg-slate-800 text-slate-400 hover:text-white transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
              aria-label="Toggle Dark Mode"
            >
              {theme === "dark" ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
          )}

          <div className="bg-slate-800/50 p-1 rounded-full border border-slate-700">
             <UserButton afterSignOutUrl="/sign-in" appearance={{
                elements: {
                    avatarBox: "w-8 h-8"
                }
             }} />
          </div>

          {/* Mobile Menu Button */}
          <button 
            className="md:hidden p-2 text-slate-300 hover:text-white"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Nav */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-slate-900 border-t border-slate-800 p-4 space-y-4 shadow-xl absolute w-full left-0 top-16">
          <Link href="/" className="flex items-center gap-3 text-slate-300 hover:text-white hover:bg-slate-800 p-2 rounded-md">
             <Globe className="w-4 h-4" /> Home
          </Link>
          <Link href="/pricing" className="flex items-center gap-3 text-slate-300 hover:text-white hover:bg-slate-800 p-2 rounded-md">
            <CreditCard className="w-4 h-4" /> Pricing
          </Link>
          <Link href="/dashboard/settings" className="flex items-center gap-3 text-slate-300 hover:text-white hover:bg-slate-800 p-2 rounded-md">
            <Map className="w-4 h-4" /> Territories
          </Link>
          <Link href="/about" className="flex items-center gap-3 text-slate-300 hover:text-white hover:bg-slate-800 p-2 rounded-md">
            <Info className="w-4 h-4" /> About
          </Link>
          <Link href="/contact" className="flex items-center gap-3 text-slate-300 hover:text-white hover:bg-slate-800 p-2 rounded-md">
            <Phone className="w-4 h-4" /> Contact
          </Link>
          <Link href="/support" className="flex items-center gap-3 text-slate-300 hover:text-white hover:bg-slate-800 p-2 rounded-md">
            <LifeBuoy className="w-4 h-4" /> Support
          </Link>
        </div>
      )}
    </header>
  );
}
