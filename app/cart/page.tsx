"use client";

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CartItem, readCart, writeCart, clearCart as clearCartStorage } from '@/app/lib/cart';
import { ClipboardList, ArrowRight, ArrowLeft, Trash2 } from 'lucide-react';

export default function CartViewPage() {
  const router = useRouter();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setCart(readCart());
    setLoading(false);
  }, []);

  const setAndPersist = (next: CartItem[]) => {
    setCart(next);
    writeCart(next);
    setTimeout(() => window.dispatchEvent(new Event('storage')), 0);
  };

  const increaseQuantity = (id: string) => {
    setAndPersist(cart.map(i => i.id === id ? { ...i, quantity: i.quantity + 1 } : i));
  };

  const decreaseQuantity = (id: string) => {
    const item = cart.find(i => i.id === id);
    if (!item) return;
    if (item.quantity <= 1) {
      setAndPersist(cart.filter(i => i.id !== id));
    } else {
      setAndPersist(cart.map(i => i.id === id ? { ...i, quantity: i.quantity - 1 } : i));
    }
  };

  const removeItem = (id: string) => {
    setAndPersist(cart.filter(i => i.id !== id));
  };

  const handleClear = () => {
    setCart([]);
    clearCartStorage();
    setTimeout(() => window.dispatchEvent(new Event('storage')), 0);
  };

  const subtotal = cart.reduce((t, i) => t + i.price * i.quantity, 0);
  const itemCount = cart.reduce((t, i) => t + i.quantity, 0);

  return (
    <div className="min-h-screen bg-[#FBFBFA] text-[#1A1A1A] font-serif py-12 px-6 selection:bg-[#7D5A34]/20">
      <div className="max-w-4xl mx-auto">

        {/* Header */}
        <div className="border-l-2 border-[#1A1A1A] pl-6 mb-10">
          <span className="font-sans text-xs font-bold tracking-widest uppercase text-[#7D5A34] block mb-2">
            Your Order
          </span>
          <h1 className="text-4xl md:text-5xl font-normal leading-tight tracking-tight">
            Your Books
          </h1>
          {!loading && (
            <p className="font-sans text-xs uppercase tracking-widest text-[#1A1A1A]/50 mt-3">
              {itemCount} book{itemCount === 1 ? '' : 's'} 
            </p>
          )}
        </div>

        {loading ? (
          <p className="font-sans text-xs tracking-widest uppercase text-[#1A1A1A]/40 animate-pulse py-12 text-center">
            Loading your selection…
          </p>
        ) : cart.length === 0 ? (
          <div className="bg-white border border-dashed border-[#1A1A1A]/15 rounded-sm py-20 text-center">
            <div className="w-14 h-14 rounded-full bg-[#7D5A34]/10 text-[#7D5A34] flex items-center justify-center mx-auto mb-4">
              <ClipboardList className="w-6 h-6" strokeWidth={1.75} />
            </div>
            <h2 className="font-serif text-2xl font-normal mb-2">Your selection is empty</h2>
            <p className="font-sans text-xs text-[#1A1A1A]/60 mb-6">
              Browse the catalogue to add books to your cart.
            </p>
            <button
              onClick={() => router.push('/books')}
              className="inline-flex items-center gap-2 bg-[#1A1A1A] text-white hover:bg-[#7D5A34] font-sans text-xs font-bold uppercase tracking-widest px-6 py-3 rounded-sm transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Browse Catalogue
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 font-sans">

            {/* Left — item list */}
            <div className="lg:col-span-12 bg-white border border-[#1A1A1A]/10 rounded-sm shadow-sm overflow-hidden">
              <div className="hidden md:grid grid-cols-12 gap-4 text-[10px] font-bold uppercase tracking-widest text-[#1A1A1A]/50 px-6 py-3 border-b border-[#1A1A1A]/10 bg-[#1A1A1A]/[0.02]">
                <div className="col-span-6">Book Title</div>
                <div className="col-span-3 text-center">Quantity</div>
                <div className="col-span-3 text-right">Total</div>
              </div>

              <ul className="divide-y divide-[#1A1A1A]/5">
                {cart.map(item => (
                  <li key={item.id} className="grid grid-cols-1 md:grid-cols-12 gap-4 px-6 py-5 items-center">
                    <div className="md:col-span-6">
                      <p className="font-serif text-lg text-[#1A1A1A] leading-snug">{item.title}</p>
                      {item.author && (
                        <p className="text-[11px] text-[#1A1A1A]/60 italic mt-1">{item.author}</p>
                      )}
                      
                      <button
                        onClick={() => removeItem(item.id)}
                        className="inline-flex items-center gap-1 mt-2 text-[10px] font-bold uppercase tracking-wider text-[#1A1A1A]/40 hover:text-red-500 transition-colors"
                      >
                        <Trash2 className="w-3 h-3" strokeWidth={2} />
                        Remove
                      </button>
                    </div>

                    <div className="md:col-span-3 flex items-center justify-start md:justify-center gap-3">
                      <button
                        onClick={() => decreaseQuantity(item.id)}
                        aria-label="Decrease"
                        className="w-8 h-8 rounded-full border border-[#1A1A1A]/20 flex items-center justify-center hover:bg-[#1A1A1A] hover:text-white hover:border-[#1A1A1A] transition-all select-none"
                      >—</button>
                      <span className="font-serif text-lg min-w-[20px] text-center">{item.quantity}</span>
                      <button
                        onClick={() => increaseQuantity(item.id)}
                        aria-label="Increase"
                        className="w-8 h-8 rounded-full border border-[#1A1A1A]/20 flex items-center justify-center hover:bg-[#1A1A1A] hover:text-white hover:border-[#1A1A1A] transition-all select-none"
                      >+</button>
                    </div>

                    <div className="md:col-span-3 text-left md:text-right">
                      <span className="font-serif text-xl text-[#1A1A1A] tabular-nums">
                        ₹{item.price * item.quantity}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>

              <div className="flex items-center justify-between px-6 py-4 border-t border-[#1A1A1A]/10 bg-[#1A1A1A]/[0.02]">
                <button
                  onClick={() => router.push('/books')}
                  className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-[#1A1A1A] hover:text-[#7D5A34] transition-colors"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  Continue Browsing
                </button>
                <button
                  onClick={handleClear}
                  className="text-xs font-bold uppercase tracking-widest text-[#1A1A1A]/40 hover:text-red-500 transition-colors"
                >
                  Clear Order
                </button>
              </div>
              <div className="border-t border-[#1A1A1A]/10 px-6 py-5">
  <div className="flex justify-end">
    <div className="w-full md:w-80 space-y-3 font-sans text-sm">
      <div className="flex justify-between">
        <span className="text-[#1A1A1A]/60">Subtotal</span>
        <span className="font-serif text-lg tabular-nums">₹{subtotal}</span>
      </div>

      <div className="flex justify-between text-[#1A1A1A]/60">
        <span>Shipping</span>
        <span className="italic text-xs">Calculated at checkout</span>
      </div>

      <div className="pt-3">
        <a
          href="/checkout"
          className="w-full flex items-center justify-center gap-2 bg-[#1A1A1A] text-white hover:bg-[#7D5A34] font-sans text-xs font-bold uppercase tracking-widest py-3.5 rounded-sm transition-colors"
        >
          Proceed to Checkout
          <ArrowRight className="w-3.5 h-3.5" />
        </a>
      </div>

      
    </div>
  </div>
</div>
            </div>


          </div>
        )}
      </div>
    </div>
  );
}
