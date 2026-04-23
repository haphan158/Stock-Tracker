'use client';

import { useSession, signIn, signOut } from 'next-auth/react';
import { Button } from '@/src/components/ui/button';
import { TrendingUp, Briefcase, Eye, BarChart3, LogOut } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Image from 'next/image';
import { ThemeToggle } from '@/src/components/theme-toggle';

export function Navigation() {
  const { data: session } = useSession();
  const pathname = usePathname();

  const navItems = [
    { href: '/', label: 'Dashboard', icon: TrendingUp },
    { href: '/portfolio', label: 'Portfolio', icon: Briefcase },
    { href: '/watchlist', label: 'Watchlist', icon: Eye },
    { href: '/analytics', label: 'Analytics', icon: BarChart3 },
  ];

  return (
    <nav className="sticky top-0 z-40 bg-card/80 backdrop-blur border-b border-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center space-x-8">
            <Link href="/" className="flex items-center space-x-2">
              <TrendingUp className="h-7 w-7 text-primary" />
              <span className="text-lg font-semibold text-foreground">Stock Tracker</span>
            </Link>

            <div className="hidden md:flex space-x-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href;
                return (
                  <Link key={item.href} href={item.href}>
                    <Button
                      variant={isActive ? 'default' : 'ghost'}
                      size="sm"
                      className="flex items-center space-x-2"
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
                  <span className="hidden sm:inline">Sign Out</span>
                </Button>
              </div>
            ) : (
              <Button size="sm" onClick={() => signIn('google')}>
                Sign In
              </Button>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
