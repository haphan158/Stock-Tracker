'use client';

import { useEffect, useRef, useState } from 'react';
import { useSession, signIn, signOut } from 'next-auth/react';
import { Button } from '@/src/components/ui/button';
import {
  TrendingUp,
  Briefcase,
  Eye,
  BarChart3,
  LogOut,
  Menu,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Image from 'next/image';
import { ThemeToggle } from '@/src/components/theme-toggle';
import { cn } from '@/lib/utils';

const NAV_ITEMS = [
  { href: '/', label: 'Dashboard', icon: TrendingUp },
  { href: '/portfolio', label: 'Portfolio', icon: Briefcase },
  { href: '/watchlist', label: 'Watchlist', icon: Eye },
  { href: '/analytics', label: 'Analytics', icon: BarChart3 },
] as const;

export function Navigation() {
  const { data: session } = useSession();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const toggleButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMobileOpen(false);
        toggleButtonRef.current?.focus();
      }
    };
    const onClickOutside = (event: MouseEvent) => {
      if (
        panelRef.current &&
        !panelRef.current.contains(event.target as Node) &&
        !toggleButtonRef.current?.contains(event.target as Node)
      ) {
        setMobileOpen(false);
      }
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onClickOutside);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onClickOutside);
    };
  }, [mobileOpen]);

  return (
    <nav
      aria-label="Primary"
      className="sticky top-0 z-40 bg-card/80 backdrop-blur border-b border-border"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center space-x-8">
            <Link href="/" className="flex items-center space-x-2">
              <TrendingUp className="h-7 w-7 text-primary" />
              <span className="text-lg font-semibold text-foreground">Stock Tracker</span>
            </Link>

            <div className="hidden md:flex space-x-1">
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href;
                return (
                  <Link key={item.href} href={item.href}>
                    <Button
                      variant={isActive ? 'default' : 'ghost'}
                      size="sm"
                      className="flex items-center space-x-2"
                      aria-current={isActive ? 'page' : undefined}
                    >
                      <Icon className="h-4 w-4" />
                      <span>{item.label}</span>
                    </Button>
                  </Link>
                );
              })}
            </div>
          </div>

          <div className="flex items-center space-x-2 sm:space-x-3">
            <ThemeToggle />

            <div className="hidden md:flex items-center space-x-3">
              {session ? (
                <div className="flex items-center space-x-3">
                  <div className="hidden sm:flex items-center space-x-2">
                    {session.user?.image && (
                      <Image
                        src={session.user.image}
                        alt={session.user.name || 'User'}
                        width={32}
                        height={32}
                        className="h-8 w-8 rounded-full border border-border"
                      />
                    )}
                    <span className="text-sm font-medium text-foreground">
                      {session.user?.name}
                    </span>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => signOut()}
                    className="flex items-center space-x-2"
                  >
                    <LogOut className="h-4 w-4" />
                    <span>Sign Out</span>
                  </Button>
                </div>
              ) : (
                <Button size="sm" onClick={() => signIn('google')}>
                  Sign In
                </Button>
              )}
            </div>

            <Button
              ref={toggleButtonRef}
              type="button"
              variant="outline"
              size="icon"
              className="md:hidden"
              aria-controls="mobile-nav"
              aria-expanded={mobileOpen}
              aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
              onClick={() => setMobileOpen((prev) => !prev)}
            >
              {mobileOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </div>

      <div
        id="mobile-nav"
        ref={panelRef}
        hidden={!mobileOpen}
        className="md:hidden border-t border-border bg-card"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 space-y-1">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive ? 'page' : undefined}
                className={cn(
                  'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'text-foreground hover:bg-accent hover:text-accent-foreground',
                )}
              >
                <Icon className="h-4 w-4" />
                <span>{item.label}</span>
              </Link>
            );
          })}

          <div className="pt-3 mt-2 border-t border-border">
            {session ? (
              <div className="space-y-3">
                <div className="flex items-center gap-3 px-3">
                  {session.user?.image && (
                    <Image
                      src={session.user.image}
                      alt={session.user.name || 'User'}
                      width={32}
                      height={32}
                      className="h-8 w-8 rounded-full border border-border"
                    />
                  )}
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-foreground truncate">
                      {session.user?.name}
                    </div>
                    {session.user?.email ? (
                      <div className="text-xs text-muted-foreground truncate">
                        {session.user.email}
                      </div>
                    ) : null}
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => signOut()}
                  className="w-full flex items-center justify-center gap-2"
                >
                  <LogOut className="h-4 w-4" />
                  <span>Sign Out</span>
                </Button>
              </div>
            ) : (
              <Button
                size="sm"
                className="w-full"
                onClick={() => signIn('google')}
              >
                Sign In
              </Button>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
