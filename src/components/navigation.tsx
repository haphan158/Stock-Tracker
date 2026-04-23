'use client';

import { useEffect, useRef, useState } from 'react';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { TrendingUp, Briefcase, Eye, BarChart3, LogOut, Menu, X } from 'lucide-react';
import { useSession, signIn, signOut } from 'next-auth/react';

import { cn } from '@/lib/utils';
import { ThemeToggle } from '@/src/components/theme-toggle';
import { Button } from '@/src/components/ui/button';

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
      className="bg-card/80 border-border sticky top-0 z-40 border-b backdrop-blur"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          <div className="flex items-center space-x-8">
            <Link href="/" className="flex items-center space-x-2">
              <TrendingUp className="text-primary h-7 w-7" />
              <span className="text-foreground text-lg font-semibold">Stock Tracker</span>
            </Link>

            <div className="hidden space-x-1 md:flex">
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

            <div className="hidden items-center space-x-3 md:flex">
              {session ? (
                <div className="flex items-center space-x-3">
                  <div className="hidden items-center space-x-2 sm:flex">
                    {session.user?.image && (
                      <Image
                        src={session.user.image}
                        alt={session.user.name || 'User'}
                        width={32}
                        height={32}
                        className="border-border h-8 w-8 rounded-full border"
                      />
                    )}
                    <span className="text-foreground text-sm font-medium">
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
        className="border-border bg-card border-t md:hidden"
      >
        <div className="mx-auto max-w-7xl space-y-1 px-4 py-3 sm:px-6">
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

          <div className="border-border mt-2 border-t pt-3">
            {session ? (
              <div className="space-y-3">
                <div className="flex items-center gap-3 px-3">
                  {session.user?.image && (
                    <Image
                      src={session.user.image}
                      alt={session.user.name || 'User'}
                      width={32}
                      height={32}
                      className="border-border h-8 w-8 rounded-full border"
                    />
                  )}
                  <div className="min-w-0">
                    <div className="text-foreground truncate text-sm font-medium">
                      {session.user?.name}
                    </div>
                    {session.user?.email ? (
                      <div className="text-muted-foreground truncate text-xs">
                        {session.user.email}
                      </div>
                    ) : null}
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => signOut()}
                  className="flex w-full items-center justify-center gap-2"
                >
                  <LogOut className="h-4 w-4" />
                  <span>Sign Out</span>
                </Button>
              </div>
            ) : (
              <Button size="sm" className="w-full" onClick={() => signIn('google')}>
                Sign In
              </Button>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
