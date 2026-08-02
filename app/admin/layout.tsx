"use client";

import React, { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/app/context/AuthContext';
import { isAdmin } from '@/app/lib/admin';
import {
  LayoutDashboard,
  Package,
  MessageSquare,
  BarChart3,
  Users,
  Settings,
  ExternalLink,
  ShieldCheck,
  BookOpen,
  UserSquare,
  Layers,
  Boxes,
  Images,
} from 'lucide-react';

const SANITY_STUDIO_URL = process.env.NEXT_PUBLIC_SANITY_STUDIO_URL || '/studio';

const NAV = [
  { href: '/admin',                 label: 'Dashboard',     Icon: LayoutDashboard },
  { href: '/admin/orders',          label: 'Orders',        Icon: Package },
  { href: '/admin/verification',    label: 'Verification',  Icon: ShieldCheck },
  { href: '/admin/reviews',         label: 'Reviews',       Icon: MessageSquare },
  { href: '/admin/customers',       label: 'Customers',     Icon: Users },
  { href: '/admin/analytics',       label: 'Analytics',     Icon: BarChart3 },
  { href: '/admin/settings',        label: 'Settings',      Icon: Settings },
];

const CONTENT_LINKS = [
  { path: 'book',        label: 'Books',           Icon: BookOpen },
  { path: 'author',      label: 'Authors',         Icon: UserSquare },
  { path: 'collection',  label: 'Collections',     Icon: Layers },
  { path: 'bundle',      label: 'Bundles',         Icon: Boxes },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [checking, setChecking] = useState(true);
  const [allowed, setAllowed] = useState(false);

  // Auth + admin claim check
  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push('/login');
      return;
    }
    isAdmin(user, true).then(is => {
      setAllowed(is);
      setChecking(false);
      if (!is) {
        // Non-admins are redirected to their profile page.
        router.push('/profile');
      }
    });
  }, [user, authLoading, router]);

  if (authLoading || checking) {
    return (
      <div className="min-h-screen bg-[#FBFBFA] flex items-center justify-center font-sans">
        <p className="text-xs uppercase tracking-widest text-[#1A1A1A]/40 animate-pulse">Verifying admin credentials…</p>
      </div>
    );
  }

  if (!allowed) return null;

  return (
    <div className="min-h-screen bg-[#FBFBFA] text-[#1A1A1A] font-sans flex">

      {/* Sidebar */}
      <aside className="hidden md:flex md:w-64 border-r border-[#1A1A1A]/10 bg-white flex-col">
        <div className="p-6 border-b border-[#1A1A1A]/10">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-[#7D5A34]" strokeWidth={1.5} />
            <div>
              <span className="text-[9px] uppercase tracking-[0.25em] font-bold text-[#7D5A34] block">Admin</span>
              <h1 className="font-serif text-lg font-normal">Operations</h1>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-3 overflow-y-auto">
          <div className="space-y-0.5 mb-6">
            {NAV.map(({ href, label, Icon }) => {
              const active = pathname === href;
              return (
                <Link
                  key={href}
                  href={href}
                  className={`flex items-center gap-2.5 text-xs uppercase tracking-widest font-bold px-3 py-2.5 rounded-sm transition-colors ${active ? 'bg-[#7D5A34]/10 text-[#7D5A34]' : 'text-[#1A1A1A]/60 hover:bg-[#1A1A1A]/5 hover:text-[#1A1A1A]'}`}
                >
                  <Icon className="w-3.5 h-3.5 flex-shrink-0" strokeWidth={2} />
                  {label}
                </Link>
              );
            })}
          </div>

          <div className="px-3 mb-2">
            <span className="text-[9px] uppercase tracking-[0.25em] font-bold text-[#1A1A1A]/30">Content</span>
          </div>
          <div className="space-y-0.5">
            {CONTENT_LINKS.map(({ path, label, Icon }) => (
              <a
                key={path}
                href={`${SANITY_STUDIO_URL}/structure/${path}`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-between gap-2 text-xs uppercase tracking-widest font-bold px-3 py-2 rounded-sm text-[#1A1A1A]/60 hover:bg-[#1A1A1A]/5 hover:text-[#1A1A1A] transition-colors"
              >
                <span className="flex items-center gap-2.5">
                  <Icon className="w-3.5 h-3.5 flex-shrink-0" strokeWidth={2} /> {label}
                </span>
                <ExternalLink className="w-3 h-3 flex-shrink-0 opacity-40" />
              </a>
            ))}
            <a
              href={`${SANITY_STUDIO_URL}`}
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-between gap-2 text-xs uppercase tracking-widest font-bold px-3 py-2 rounded-sm text-[#1A1A1A]/60 hover:bg-[#1A1A1A]/5 hover:text-[#1A1A1A] transition-colors"
            >
              <span className="flex items-center gap-2.5">
                <Images className="w-3.5 h-3.5 flex-shrink-0" strokeWidth={2} /> Homepage Slides
              </span>
              <ExternalLink className="w-3 h-3 flex-shrink-0 opacity-40" />
            </a>
          </div>
        </nav>

        <div className="p-4 border-t border-[#1A1A1A]/10 text-[10px] text-[#1A1A1A]/40">
          <p>Signed in as</p>
          <p className="text-[#1A1A1A] font-semibold truncate">{user?.email}</p>
        </div>
      </aside>

      {/* Mobile top nav */}
      <div className="md:hidden fixed top-0 left-0 right-0 bg-white border-b border-[#1A1A1A]/10 z-40 flex items-center gap-1 overflow-x-auto p-2">
        {NAV.map(({ href, label, Icon }) => {
          const active = pathname === href;
          return (
            <Link key={href} href={href} className={`flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-bold px-2.5 py-1.5 rounded-sm whitespace-nowrap ${active ? 'bg-[#7D5A34]/10 text-[#7D5A34]' : 'text-[#1A1A1A]/60'}`}>
              <Icon className="w-3 h-3" /> {label}
            </Link>
          );
        })}
      </div>

      {/* Main */}
      <main className="flex-1 min-w-0 p-6 md:p-10 pt-16 md:pt-10">{children}</main>
    </div>
  );
}
