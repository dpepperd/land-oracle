"use client";

import Link from "next/link";
import { useTheme } from "next-themes";
import { Globe, Menu, X, Sun, Moon } from "lucide-react";
import { useState, useEffect } from "react";
import { UserButton, useUser } from "@clerk/nextjs";

export default function LandingHeader() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const { isSignedIn } = useUser();

  useEffect(() => setMounted(true), []);

  const toggleTheme = () => {
    setTheme(theme === "dark" ? "light" : "dark");
  };

  return (
    <nav className="fixed w-full z-50 top-0 start-0 border-b border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-md transition-colors duration-300">
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between px-4 sm:px-6 lg:px-8 h-16">
        
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 group">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shadow-lg shadow-blue-500/20 group-hover:scale-105 transition-transform">
            <Globe className="w-5 h-5 text-white" />
          </div>
          <span className="self-center text-xl font-bold whitespace-nowrap text-foreground">
            Land<span className="text-blue-600">Oracle.ai</span>
          </span>
        </Link>
        
        <div className="flex md:order-2 space-x-3 md:space-x-4 items-center">
          {/* Theme Toggle */}
          {mounted && (
            <button
              onClick={toggleTheme}
              className="p-2 text-zinc-500 rounded-full hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-200 dark:focus:ring-zinc-700"
            >
              {theme === "dark" ? <Sun size={20} /> : <Moon size={20} />}
            </button>
          )}

          {/* Auth Buttons */}
          {isSignedIn ? (
            <div className="flex items-center gap-4">
                <Link href="/dashboard" className="hidden sm:block text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
                    Go to Dashboard
                </Link>
                <UserButton afterSignOutUrl="/" />
            </div>
          ) : (
            <>
                <Link 
                    href="/sign-in"
                    className="hidden sm:inline-flex items-center justify-center text-sm font-medium text-foreground hover:bg-slate-100 dark:hover:bg-slate-800 px-4 py-2 rounded-lg transition-colors"
                >
                    Log In
                </Link>
                <Link 
                    href="/sign-up"
                    className="text-white bg-blue-600 hover:bg-blue-700 focus:ring-4 focus:outline-none focus:ring-blue-300 font-medium rounded-lg text-sm px-4 py-2 text-center dark:bg-blue-600 dark:hover:bg-blue-700 dark:focus:ring-blue-800 shadow-md hover:shadow-lg transition-all"
                >
                    Get Started
                </Link>
            </>
          )}

          {/* Mobile Menu Toggle */}
          <button
            onClick={() => setIsOpen(!isOpen)}
            type="button"
            className="inline-flex items-center p-2 w-10 h-10 justify-center text-sm text-zinc-500 rounded-lg md:hidden hover:bg-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-200 dark:text-zinc-400 dark:hover:bg-zinc-700 dark:focus:ring-zinc-600"
          >
            <span className="sr-only">Open main menu</span>
            {isOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>

        {/* Desktop Links */}
        <div className="hidden w-full md:block md:w-auto md:order-1">
          <ul className="flex flex-col p-4 md:p-0 mt-4 font-medium border border-zinc-100 rounded-lg bg-zinc-50 md:space-x-8 md:flex-row md:mt-0 md:border-0 md:bg-transparent dark:bg-zinc-800 md:dark:bg-transparent dark:border-zinc-700">
            {['Features', 'Territories', 'Pricing', 'Data', 'About', 'Contact'].map((item) => (
               <li key={item}>
                <Link 
                    href={`/${item.toLowerCase()}`}
                    className="block py-2 px-3 md:p-0 text-foreground rounded hover:bg-zinc-100 md:hover:bg-transparent md:hover:text-blue-700 md:dark:hover:text-blue-500 transition-colors"
                >
                    {item}
                </Link>
               </li>
            ))}
          </ul>
        </div>
      </div>

        {/* Mobile Menu */}
        {isOpen && (
            <div className="md:hidden border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950">
                 <ul className="flex flex-col p-4 font-medium space-y-2">
                    {['Features', 'Territories', 'Pricing', 'Data', 'About', 'Contact'].map((item) => (
                        <li key={item}>
                            <Link 
                                href={`/${item.toLowerCase()}`}
                                className="block py-2 px-3 text-zinc-900 rounded hover:bg-zinc-100 dark:text-white dark:hover:bg-zinc-800"
                                onClick={() => setIsOpen(false)}
                            >
                                {item}
                            </Link>
                        </li>
                    ))}
                    {!isSignedIn && (
                        <li>
                             <Link 
                                href="/sign-in"
                                className="block py-2 px-3 text-zinc-900 rounded hover:bg-zinc-100 dark:text-white dark:hover:bg-zinc-800"
                                onClick={() => setIsOpen(false)}
                            >
                                Log In
                            </Link>
                        </li>
                    )}
                 </ul>
            </div>
        )}
    </nav>
  );
}
