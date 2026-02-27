// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowRight, Sun, Moon, Laptop } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface PublicNavProps {
  /** Active link to highlight. Options: 'home', 'docs' */
  activeLink?: 'home' | 'docs';
}

export function PublicNav({ activeLink = 'home' }: PublicNavProps) {
  const { session } = useAuth();
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleGetStarted = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    if (session) {
      void Promise.resolve(navigate('/dashboard'));
    } else {
      void Promise.resolve(navigate('/auth/login'));
    }
  };

  const handleLogoClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    if (activeLink === 'home') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      void Promise.resolve(navigate('/'));
    }
  };

  return (
    <nav
      className={`fixed top-8 left-1/2 -translate-x-1/2 z-50 transition-all duration-500 w-[98%] rounded-2xl border ${
        isScrolled
          ? 'bg-white/70 dark:bg-slate-900/60 backdrop-blur-xl border-gray-200 dark:border-white/10 shadow-lg shadow-black/5'
          : 'bg-white/50 dark:bg-white/5 backdrop-blur-md border-black/5 dark:border-white/10 hover:border-black/10 dark:hover:border-white/20'
      }`}
    >
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <a
          href="#"
          onClick={handleLogoClick}
          className="flex items-center gap-3 hover:opacity-80 transition-opacity"
        >
          <img
            src="/logo.png"
            alt="Stackweaver"
            className={`h-8 w-8 md:h-10 md:w-10 transition-opacity duration-500 ${
              isScrolled ? 'opacity-100' : 'opacity-80'
            }`}
          />
          <span
            className={`text-xl font-bold bg-gradient-to-r from-blue-500 via-blue-600 to-purple-500 dark:from-blue-500 dark:via-blue-600 dark:to-purple-500 bg-clip-text text-transparent transition-opacity duration-500 ${
              isScrolled ? 'opacity-100' : 'opacity-70'
            }`}
          >
            Stackweaver
          </span>
        </a>
        <div className="flex items-center gap-4">
          {activeLink === 'home' ? (
            <>
              <a
                href="#overview"
                className={`text-sm transition-all duration-300 hover:text-blue-500 dark:hover:text-blue-300 ${
                  isScrolled ? 'text-slate-800 dark:text-white' : 'text-slate-800/70 dark:text-white/70'
                }`}
              >
                Overview
              </a>
              <a
                href="#install"
                className={`text-sm transition-all duration-300 hover:text-blue-500 dark:hover:text-blue-300 ${
                  isScrolled ? 'text-slate-800 dark:text-white' : 'text-slate-800/70 dark:text-white/70'
                }`}
              >
                Install
              </a>
              <a
                href="#features"
                className={`text-sm transition-all duration-300 hover:text-blue-500 dark:hover:text-blue-300 ${
                  isScrolled ? 'text-slate-800 dark:text-white' : 'text-slate-800/70 dark:text-white/70'
                }`}
              >
                Features
              </a>
              <Link
                to="/docs"
                className={`text-sm transition-all duration-300 hover:text-blue-500 dark:hover:text-blue-300 ${
                  isScrolled ? 'text-slate-800 dark:text-white' : 'text-slate-800/70 dark:text-white/70'
                }`}
              >
                Docs
              </Link>
            </>
          ) : (
            <>
              <Link
                to="/"
                className={`text-sm transition-all duration-300 hover:text-blue-500 dark:hover:text-blue-300 ${
                  isScrolled ? 'text-slate-800 dark:text-white' : 'text-slate-800/70 dark:text-white/70'
                }`}
              >
                Home
              </Link>
              <a
                href="/#overview"
                className={`text-sm transition-all duration-300 hover:text-blue-500 dark:hover:text-blue-300 ${
                  isScrolled ? 'text-slate-800 dark:text-white' : 'text-slate-800/70 dark:text-white/70'
                }`}
              >
                Overview
              </a>
              <a
                href="/#install"
                className={`text-sm transition-all duration-300 hover:text-blue-500 dark:hover:text-blue-300 ${
                  isScrolled ? 'text-slate-800 dark:text-white' : 'text-slate-800/70 dark:text-white/70'
                }`}
              >
                Install
              </a>
              <a
                href="/#features"
                className={`text-sm transition-all duration-300 hover:text-blue-500 dark:hover:text-blue-300 ${
                  isScrolled ? 'text-slate-800 dark:text-white' : 'text-slate-800/70 dark:text-white/70'
                }`}
              >
                Features
              </a>
              <Link
                to="/docs"
                className={`text-sm transition-all duration-300 font-medium ${
                  isScrolled
                    ? 'text-blue-600 dark:text-blue-400'
                    : 'text-blue-600/80 dark:text-blue-400/80'
                }`}
              >
                Docs
              </Link>
            </>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="w-9 h-9 text-slate-700 dark:text-white hover:bg-black/5 dark:hover:bg-white/10 border-none outline-none focus-visible:ring-0 focus-visible:ring-offset-0"
              >
                <Sun className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
                <Moon className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
                <span className="sr-only">Toggle theme</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={() => setTheme('light')}
                className={theme === 'light' ? 'bg-slate-100 dark:bg-slate-800' : ''}
              >
                <Sun className="mr-2 h-4 w-4" />
                <span>Light</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setTheme('dark')}
                className={theme === 'dark' ? 'bg-slate-100 dark:bg-slate-800' : ''}
              >
                <Moon className="mr-2 h-4 w-4" />
                <span>Dark</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setTheme('system')}
                className={theme === 'system' ? 'bg-slate-100 dark:bg-slate-800' : ''}
              >
                <Laptop className="mr-2 h-4 w-4" />
                <span>System</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <div className="relative inline-flex rounded-md bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 p-[3px] dark:p-[2.5px]">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleGetStarted}
              className="bg-white dark:bg-slate-900/80 dark:backdrop-blur-sm text-slate-900 dark:text-white hover:bg-slate-50 dark:hover:bg-slate-900/90 border-0 whitespace-nowrap rounded-[calc(0.375rem-3px)] dark:rounded-[calc(0.375rem-2.5px)]"
            >
              <span className="flex items-center gap-2">
                <span>{session ? 'Dashboard' : 'Get Started'}</span>
                <ArrowRight className="h-4 w-4 flex-shrink-0" />
              </span>
            </Button>
          </div>
        </div>
      </div>
    </nav>
  );
}
