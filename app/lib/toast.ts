// Thin wrapper around react-hot-toast with project-consistent styling.
// Usage: import { toast } from '@/app/lib/toast';  then  toast.success('Added to cart')

import { toast as _toast, type ToastOptions } from 'react-hot-toast';

const BASE: ToastOptions = {
  duration: 3000,
  style: {
    fontFamily: 'var(--font-inter, sans-serif)',
    fontSize: '11px',
    fontWeight: '600',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.08em',
    borderRadius: '2px',
    border: '1px solid rgba(26,26,26,0.08)',
    background: '#FBFBFA',
    color: '#1A1A1A',
    boxShadow: '0 4px 16px rgba(26,26,26,0.08)',
    padding: '10px 16px',
  },
};

export const toast = {
  success: (msg: string) =>
    _toast.success(msg, {
      ...BASE,
      iconTheme: { primary: '#7D5A34', secondary: '#FBFBFA' },
    }),

  error: (msg: string) =>
    _toast.error(msg, {
      ...BASE,
      iconTheme: { primary: '#ef4444', secondary: '#FBFBFA' },
    }),

  info: (msg: string) =>
    _toast(msg, {
      ...BASE,
      icon: '📖',
    }),

  loading: (msg: string) =>
    _toast.loading(msg, { ...BASE }),

  dismiss: _toast.dismiss,
};
