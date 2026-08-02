"use client";

import React, { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Image from 'next/image';
import { useAuth } from '@/app/context/AuthContext';
import { Home, BookOpen, Users, Info, Phone, Search, Menu, X, ShoppingCart, User } from 'lucide-react';

function getInitials(name?: string | null): string {
  if (!name) return 'U';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'U';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function HeaderWrapper() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [totalItems, setTotalItems] = useState(0);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const syncCartBadge = () => {
      const savedCart = localStorage.getItem('iad_cart') || localStorage.getItem('cart');
      if (savedCart) {
        const parsed = JSON.parse(savedCart);
        const count = parsed.reduce((total: number, item: any) => total + (item.quantity || 0), 0);
        setTotalItems(count);
      } else {
        setTotalItems(0);
      }
    };
    syncCartBadge();
    window.addEventListener('storage', syncCartBadge);
    window.addEventListener('cartUpdate', syncCartBadge);
    return () => {
      window.removeEventListener('storage', syncCartBadge);
      window.removeEventListener('cartUpdate', syncCartBadge);
    };
  }, [pathname, user]);

  useEffect(() => { setMobileMenuOpen(false); }, [pathname]);

  if (pathname === '/checkout' || pathname === '/login') return null;

  const isBooksPage = pathname === '/books';

  const initials = getInitials(user?.displayName);
  const userAriaLabel = user ? (user.displayName || 'Profile') : 'Sign in';

  const handleSearchIconClick = () => {
    setMobileMenuOpen(false);
    if (isBooksPage) {
      const searchInput = document.querySelector<HTMLInputElement>('input[placeholder*="Search"]');
      if (searchInput) {
        searchInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
        searchInput.focus();
      }
    } else {
      router.push('/books?focus=search');
    }
  };

  const NAV_LINKS = [
    { href: '/',        label: 'Home',       Icon: Home },
    { href: '/books',   label: 'Catalogue',  Icon: BookOpen },
    { href: '/authors', label: 'Authors',    Icon: Users },
    { href: '/about',   label: 'About Us',   Icon: Info },
    { href: '/contact', label: 'Contact Us', Icon: Phone },
  ];

  return (
    <div className="sticky top-0 z-50 bg-[#FBFBFA]/80 backdrop-blur-md border-b border-[#1A1A1A]/10 transition-all duration-200">

      {/* ─────────── DESKTOP header (lg+) ─────────── */}
      <header className="hidden lg:block px-6 py-5 md:py-6">
        <div className="max-w-7xl mx-auto flex flex-col lg:flex-row items-center justify-between gap-6">

          {/* Identity Block */}
          <div className="flex items-center gap-6">
            <div className="relative w-24 h-24 md:w-28 md:h-28 flex-shrink-0 select-none bg-transparent">
              <Image src="/logo.svg?v=4" alt="Idarah-i Adabiyat-i Dilli Emblem" fill className="object-contain mix-blend-multiply" priority />
            </div>
            <div className="flex flex-col justify-center">
              <h1 style={{ fontFamily: "var(--font-playfair), 'Playfair Display', Georgia, serif" }} className="text-3xl md:text-4xl font-bold tracking-wider uppercase text-[#1A1A1A] leading-none select-none">Idarah-i Adabiyat-i Delli</h1>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="flex flex-wrap items-center justify-center gap-x-5 md:gap-x-7 gap-y-2 font-sans text-xs md:text-sm tracking-wide font-semibold max-w-2xl text-center">
            {NAV_LINKS.map(({ href, label, Icon }) => (
              <a key={href} href={href}
                className={`flex items-center gap-1.5 transition-colors ${pathname === href ? 'text-[#7D5A34] font-bold' : 'text-[#1A1A1A] hover:text-[#7D5A34]'}`}>
                <Icon className="w-3.5 h-3.5 flex-shrink-0" strokeWidth={2} />
                <span>{label}</span>
              </a>
            ))}
            {!isBooksPage && (
              <button onClick={handleSearchIconClick} aria-label="Search publications"
                className="flex items-center gap-2 border border-[#1A1A1A]/15 bg-[#1A1A1A]/[0.02] hover:bg-white hover:border-[#1A1A1A]/30 hover:shadow-sm transition-all px-3 py-1.5 rounded-sm text-left">
                <Search className="w-3.5 h-3.5 text-[#1A1A1A]/35 flex-shrink-0" strokeWidth={2} />
                <span className="font-sans text-xs text-[#1A1A1A]/35 w-32 truncate">Search publications…</span>
              </button>
            )}
          </nav>

          {/* Right Action Utilities — circular icon buttons */}
          <div className="flex items-center gap-3 self-center lg:self-auto">

            {/* Cart — circular icon with notification badge */}
            <a
              href="/cart"
              aria-label={`Cart, ${totalItems} item${totalItems === 1 ? '' : 's'}`}
              className="relative w-11 h-11 rounded-full border border-[#1A1A1A]/15 bg-white text-[#1A1A1A] flex items-center justify-center hover:bg-[#1A1A1A] hover:text-[#FBFBFA] hover:border-[#1A1A1A] transition-all shadow-sm"
            >
              <ShoppingCart className="w-5 h-5" strokeWidth={1.75} />
              {totalItems > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-red-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center leading-none ring-2 ring-[#FBFBFA]">
                  {totalItems > 99 ? '99+' : totalItems}
                </span>
              )}
            </a>

            {/* User — circular avatar with initials */}
            {!authLoading && (
              <a
                href={user ? '/profile' : '/login'}
                aria-label={userAriaLabel}
                title={userAriaLabel}
                className="w-11 h-11 rounded-full bg-[#7D5A34] text-white flex items-center justify-center font-sans text-xs font-bold tracking-wider hover:bg-[#1A1A1A] transition-all shadow-sm border border-[#7D5A34] hover:border-[#1A1A1A]"
              >
                {user ? initials : <User className="w-5 h-5" strokeWidth={1.75} />}
              </a>
            )}
          </div>
        </div>
      </header>

      {/* ─────────── MOBILE header (< lg) ─────────── */}
      <header className="lg:hidden px-4 py-3">
        <div className="flex items-center justify-between gap-3">

          <a href="/" className="flex items-center gap-3 flex-shrink-0">
            <div className="relative w-12 h-12 flex-shrink-0 select-none bg-transparent">
              <Image src="/logo.svg?v=4" alt="Idarah-i Adabiyat-i Dilli Emblem" fill className="object-contain mix-blend-multiply" priority />
            </div>
            <div className="flex flex-col justify-center">
              <h1 style={{ fontFamily: "var(--font-playfair), 'Playfair Display', Georgia, serif" }}
                className="text-lg font-bold tracking-wider uppercase text-[#1A1A1A] leading-none">
                Idarah-i Adabiyat-i Delli
              </h1>
            </div>
          </a>

          <div className="flex items-center gap-2">
            {!isBooksPage && (
              <button onClick={handleSearchIconClick} aria-label="Search" className="p-2 text-[#1A1A1A] hover:text-[#7D5A34] transition-colors">
                <Search className="w-5 h-5" strokeWidth={2} />
              </button>
            )}
            <a
              href="/cart"
              aria-label={`Cart, ${totalItems} item${totalItems === 1 ? '' : 's'}`}
              className="relative w-10 h-10 rounded-full border border-[#1A1A1A]/15 bg-white text-[#1A1A1A] flex items-center justify-center hover:bg-[#1A1A1A] hover:text-[#FBFBFA] transition-all"
            >
              <ShoppingCart className="w-5 h-5" strokeWidth={1.75} />
              {totalItems > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-red-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center leading-none ring-2 ring-[#FBFBFA]">
                  {totalItems > 99 ? '99+' : totalItems}
                </span>
              )}
            </a>
            {!authLoading && (
              <a
                href={user ? '/profile' : '/login'}
                aria-label={userAriaLabel}
                className="w-10 h-10 rounded-full bg-[#7D5A34] text-white flex items-center justify-center font-sans text-[11px] font-bold tracking-wider hover:bg-[#1A1A1A] transition-all"
              >
                {user ? initials : <User className="w-5 h-5" strokeWidth={1.75} />}
              </a>
            )}
            <button onClick={() => setMobileMenuOpen(o => !o)} aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
              className="p-2 text-[#1A1A1A] hover:text-[#7D5A34] transition-colors">
              {mobileMenuOpen ? <X className="w-5 h-5" strokeWidth={2} /> : <Menu className="w-5 h-5" strokeWidth={2} />}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile dropdown menu */}
      {mobileMenuOpen && (
        <div className="lg:hidden border-t border-[#1A1A1A]/10 bg-[#FBFBFA] px-4 py-3 space-y-0.5">
          {NAV_LINKS.map(({ href, label, Icon }) => (
            <a key={href} href={href}
              className={`flex items-center gap-3 px-3 py-3 font-sans text-sm font-semibold tracking-wide transition-colors rounded-sm ${pathname === href ? 'bg-[#7D5A34]/10 text-[#7D5A34]' : 'text-[#1A1A1A] hover:bg-[#1A1A1A]/5'}`}
              onClick={() => setMobileMenuOpen(false)}>
              <Icon className="w-4 h-4 flex-shrink-0" strokeWidth={2} />
              {label}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
