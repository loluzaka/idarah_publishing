"use client";

import React from 'react';
import { useAuth } from '@/app/context/AuthContext';

interface AddToCartButtonProps {
  bookId: string;
}

export default function AddToCartButton({ bookId }: AddToCartButtonProps) {
  const { user, loading } = useAuth();

  if (loading || !user) {
    return null;
  }

  const handleAddToCart = () => {
    const activeKey = `iad_cart_${user.uid}`;
    const currentCartRaw = localStorage.getItem(activeKey);
    let currentCart = currentCartRaw ? JSON.parse(currentCartRaw) : [];
    
    // Explicitly targeting item.id to sync with Sanity lookup parameters
    const existingItem = currentCart.find((item: any) => item.id === bookId);
    if (existingItem) {
      existingItem.quantity += 1;
    } else {
      currentCart.push({ id: bookId, quantity: 1 });
    }
    
    localStorage.setItem(activeKey, JSON.stringify(currentCart));
    
    // Fire storage events so both Header and Checkout read updates instantly
    window.dispatchEvent(new Event('storage'));
  };

  return (
    <button
      onClick={handleAddToCart}
      className="w-full bg-[#1A1A1A] hover:bg-[#7D5A34] text-white text-[10px] font-sans font-bold uppercase tracking-widest py-2.5 px-4 transition-colors rounded-sm"
    >
      Add to Ledger
    </button>
  );
}