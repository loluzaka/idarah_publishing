import { normalizeAuthors } from './authors';

// Browser-cart persistence. Every consumer (checkout, homepage, books page,
// header, API) imports CartItem from here.
export interface CartItem {
  id: string;
  title: string;
  authors: string[];
  price: number;
  quantity: number;
}

const CART_KEY = 'iad_cart';

// Coerce arbitrary parsed values into a valid CartItem, including carts written
// before books supported multiple authors (`author: string`).
export function normalizeCartItem(input: unknown): CartItem | null {
  if (!input || typeof input !== 'object') return null;
  const raw = input as Record<string, unknown>;
  const id = typeof raw.id === 'string' ? raw.id : typeof raw.bookId === 'string' ? raw.bookId : '';
  if (!id) return null;
  const price = Number(raw.price);
  const quantity = Number(raw.quantity);
  return {
    id,
    title: typeof raw.title === 'string' ? raw.title : 'Untitled Publication',
    authors: normalizeAuthors(raw.authors, raw.author),
    price: Number.isFinite(price) ? price : 0,
    quantity: Number.isFinite(quantity) && quantity > 0 ? Math.floor(quantity) : 1,
  };
}

function parseCart(raw: string | null): CartItem[] {
  try {
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed)
      ? parsed.map(normalizeCartItem).filter((i): i is CartItem => i !== null)
      : [];
  } catch {
    return [];
  }
}

export function readCart(): CartItem[] {
  if (typeof window === 'undefined') return [];
  return parseCart(window.localStorage.getItem(CART_KEY));
}

// useSyncExternalStore plumbing: the snapshot is the raw stored string (a stable
// primitive), so React only re-renders when the cart actually changes.
export function subscribeCart(onChange: () => void): () => void {
  window.addEventListener('storage', onChange);
  window.addEventListener('cartUpdate', onChange);
  return () => {
    window.removeEventListener('storage', onChange);
    window.removeEventListener('cartUpdate', onChange);
  };
}

export function getCartSnapshot(): string {
  try {
    return window.localStorage.getItem(CART_KEY) ?? '';
  } catch {
    return '';
  }
}

export function parseCartSnapshot(snapshot: string): CartItem[] {
  return parseCart(snapshot || null);
}

export function writeCart(items: CartItem[]): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(CART_KEY, JSON.stringify(items));
  window.dispatchEvent(new Event('storage'));
  window.dispatchEvent(new Event('cartUpdate'));
}

export function clearCart(): void {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(CART_KEY);
  window.dispatchEvent(new Event('storage'));
  window.dispatchEvent(new Event('cartUpdate'));
}

export function cartSubtotal(items: CartItem[]): number {
  return items.reduce((total, item) => total + item.price * item.quantity, 0);
}

export function cartQuantity(items: CartItem[]): number {
  return items.reduce((total, item) => total + item.quantity, 0);
}
