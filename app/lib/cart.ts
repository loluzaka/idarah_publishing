// Canonical cart types + safe localStorage helpers.
// Every consumer (checkout, homepage, books page, header, API) imports CartItem from here.

export interface CartItem {
  id: string;
  title: string;
  author: string;
  price: number;
  quantity: number;
}

const CART_KEY = 'iad_cart';

// Coerce arbitrary parsed values into a valid CartItem, or null if unrecoverable.
export function normalizeCartItem(raw: any): CartItem | null {
  if (!raw || typeof raw !== 'object') return null;
  const id = typeof raw.id === 'string' && raw.id.length > 0 ? raw.id : null;
  if (!id) return null;
  const price = Number(raw.price);
  const quantity = Number(raw.quantity);
  return {
    id,
    title: typeof raw.title === 'string' ? raw.title : 'Untitled Publication',
    author: typeof raw.author === 'string' ? raw.author : 'Unknown Author',
    price: Number.isFinite(price) ? price : 0,
    quantity: Number.isFinite(quantity) && quantity > 0 ? Math.floor(quantity) : 1,
  };
}

export function readCart(): CartItem[] {
  try {
    const raw = localStorage.getItem(CART_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map(normalizeCartItem).filter((i): i is CartItem => i !== null);
  } catch {
    return [];
  }
}

export function writeCart(items: CartItem[]): void {
  try {
    localStorage.setItem(CART_KEY, JSON.stringify(items));
    setTimeout(() => window.dispatchEvent(new Event('storage')), 0);
  } catch {
    /* quota / private-mode failures are non-fatal */
  }
}

export function clearCart(): void {
  try {
    localStorage.removeItem(CART_KEY);
    localStorage.removeItem('cart'); // legacy key
    window.dispatchEvent(new Event('storage'));
  } catch {
    /* ignore */
  }
}

export function cartSubtotal(items: CartItem[]): number {
  return items.reduce((sum, item) => sum + item.price * item.quantity, 0);
}

export function cartQuantity(items: CartItem[]): number {
  return items.reduce((sum, item) => sum + item.quantity, 0);
}
