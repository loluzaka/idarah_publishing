"use client";

// The browser cart as a React value. localStorage is an external store, so it is
// read with useSyncExternalStore: no hydration mismatch, and every component
// using it updates when any other component (or tab) changes the cart.

import { useCallback, useMemo, useSyncExternalStore } from 'react';
import { CartItem, subscribeCart, getCartSnapshot, parseCartSnapshot, writeCart } from '@/app/lib/cart';

export function useCart() {
  // `null` on the server / during hydration, the raw stored string afterwards.
  const snapshot = useSyncExternalStore<string | null>(subscribeCart, getCartSnapshot, () => null);
  const cart = useMemo<CartItem[]>(() => parseCartSnapshot(snapshot ?? ''), [snapshot]);

  const setCart = useCallback((next: CartItem[] | ((prev: CartItem[]) => CartItem[])) => {
    const prev = parseCartSnapshot(getCartSnapshot());
    writeCart(typeof next === 'function' ? next(prev) : next);
  }, []);

  return { cart, setCart, hydrated: snapshot !== null };
}
