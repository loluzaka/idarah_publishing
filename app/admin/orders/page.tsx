"use client";

import React, { useEffect, useState } from 'react';
import { Package, MessageCircle } from 'lucide-react';
import { getAllOrders, updateOrder, Order, OrderStatus, STATUS_LABELS, ORDER_STATUSES } from '@/app/lib/orders';

const PIPELINE_ORDER: OrderStatus[] = [
  'pending_verification',
  'verified',
  'awaiting_payment',
  'paid',
  'packing',
  'shipped',
  'delivered',
];

const NEXT_STATUS: Partial<Record<OrderStatus, OrderStatus>> = {
  pending_verification: 'verified',
  verified: 'awaiting_payment',
  awaiting_payment: 'paid',
  paid: 'packing',
  packing: 'shipped',
  shipped: 'delivered',
};

const PILL: Record<OrderStatus, string> = {
  pending_verification: 'bg-amber-50 text-amber-700 border-amber-200',
  verified:             'bg-blue-50 text-blue-700 border-blue-200',
  awaiting_payment:     'bg-purple-50 text-purple-700 border-purple-200',
  paid:                 'bg-green-50 text-green-700 border-green-200',
  packing:              'bg-indigo-50 text-indigo-700 border-indigo-200',
  shipped:              'bg-teal-50 text-teal-700 border-teal-200',
  delivered:            'bg-[#7D5A34]/10 text-[#7D5A34] border-[#7D5A34]/20',
  cancelled:            'bg-[#1A1A1A]/5 text-[#1A1A1A]/60 border-[#1A1A1A]/10',
  rejected:             'bg-red-50 text-red-700 border-red-200',
};

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | OrderStatus>('pending_verification');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [shippingEdits, setShippingEdits] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [paymentLinks, setPaymentLinks] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setOrders(await getAllOrders());
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = filter === 'all' ? orders : orders.filter(o => o.status === filter);

  const advance = async (o: Order, override?: OrderStatus) => {
    if (!o.id) return;
    const next = override ?? NEXT_STATUS[o.status];
    if (!next) return;
    setBusy(o.id);

    const updates: Partial<Order> = { status: next };

    // Optionally pick up admin overrides
    const editedShipping = shippingEdits[o.id];
    if (editedShipping !== undefined && editedShipping !== '') {
      const n = Number(editedShipping);
      if (Number.isFinite(n)) {
        updates.shippingCost = n;
        updates.finalTotal = o.subtotal + n;
      }
    }
    const note = notes[o.id];
    if (note !== undefined) updates.adminNotes = note;
    const link = paymentLinks[o.id];
    if (link !== undefined && link.trim() !== '') updates.paymentLink = link.trim();

    await updateOrder(o.id, updates);
    await load();
    setBusy(null);
  };

  const setStatus = async (o: Order, status: OrderStatus) => {
    if (!o.id) return;
    setBusy(o.id);
    await updateOrder(o.id, { status });
    await load();
    setBusy(null);
  };

  return (
    <div>
      <div className="flex items-center gap-3 mb-8 pb-6 border-b border-[#1A1A1A]/10">
        <Package className="w-6 h-6 text-[#7D5A34]" strokeWidth={1.5} />
        <div>
          <span className="text-[10px] uppercase tracking-[0.25em] text-[#7D5A34] font-bold block">Fulfilment</span>
          <h1 className="font-serif text-3xl font-normal">Orders</h1>
        </div>
      </div>

      {/* Pipeline filter */}
      <div className="flex gap-2 mb-6 flex-wrap">
        <button
          onClick={() => setFilter('all')}
          className={`text-[10px] uppercase tracking-widest font-bold px-3 py-2 rounded-sm transition-colors ${filter === 'all' ? 'bg-[#1A1A1A] text-white' : 'bg-white border border-[#1A1A1A]/10 text-[#1A1A1A]/60 hover:bg-[#1A1A1A]/5'}`}
        >
          All ({orders.length})
        </button>
        {PIPELINE_ORDER.map(s => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`text-[10px] uppercase tracking-widest font-bold px-3 py-2 rounded-sm transition-colors ${filter === s ? 'bg-[#1A1A1A] text-white' : 'bg-white border border-[#1A1A1A]/10 text-[#1A1A1A]/60 hover:bg-[#1A1A1A]/5'}`}
          >
            {STATUS_LABELS[s]} ({orders.filter(o => o.status === s).length})
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-xs italic text-[#1A1A1A]/40 animate-pulse">Loading orders…</p>
      ) : filtered.length === 0 ? (
        <div className="border border-dashed border-[#1A1A1A]/10 bg-white p-12 text-center rounded-sm">
          <p className="text-xs italic text-[#1A1A1A]/50">No orders in this state.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map(o => {
            const isOpen = expanded === o.id;
            const isBusy = busy === o.id;
            const nextStatus = NEXT_STATUS[o.status];
            const date = o.createdAt ? new Date(o.createdAt).toLocaleDateString('en-IN') : '—';

            return (
              <div key={o.id} className="bg-white border border-[#1A1A1A]/10 rounded-sm">
                {/* Row header */}
                <div className="p-4 flex flex-col lg:flex-row lg:items-center gap-3 lg:gap-4">
                  <div className="flex-grow min-w-0">
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="font-mono text-sm font-bold">{o.orderId}</span>
                      <span className={`text-[9px] uppercase tracking-widest font-bold px-2 py-1 rounded-sm border ${PILL[o.status]}`}>
                        {STATUS_LABELS[o.status]}
                      </span>
                    </div>
                    <p className="text-[11px] text-[#1A1A1A]/60 mt-1">
                      <span className="font-bold">{o.customerName}</span> · {o.customerPhone} · {date}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className="font-serif font-bold">₹{o.finalTotal ?? o.estimatedTotal}</p>
                      <p className="text-[9px] text-[#1A1A1A]/40 uppercase tracking-widest">{o.items.reduce((n, i) => n + i.quantity, 0)} items · {o.totalWeight}g</p>
                    </div>
                    <button
                      onClick={() => setExpanded(isOpen ? null : (o.id ?? null))}
                      className="text-[10px] font-bold uppercase tracking-widest border border-[#1A1A1A]/20 px-3 py-2 hover:bg-[#1A1A1A]/5 transition-colors"
                    >
                      {isOpen ? 'Close' : 'Manage'}
                    </button>
                  </div>
                </div>

                {/* Expanded body */}
                {isOpen && (
                  <div className="p-5 border-t border-[#1A1A1A]/5 bg-[#1A1A1A]/[0.01] space-y-5">
                    {/* Address + items */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-xs">
                      <div>
                        <span className="text-[9px] uppercase tracking-widest font-bold text-[#1A1A1A]/40 block mb-1">Shipping Address</span>
                        <p className="leading-relaxed">
                          {o.address.fullName}<br />
                          {o.address.addressLine1}{o.address.addressLine2 ? `, ${o.address.addressLine2}` : ''}<br />
                          {o.address.city}{o.address.state ? `, ${o.address.state}` : ''} {o.address.postalCode}
                        </p>
                        {o.customerEmail && <p className="text-[10px] text-[#1A1A1A]/50 mt-2">{o.customerEmail}</p>}
                      </div>
                      <div>
                        <span className="text-[9px] uppercase tracking-widest font-bold text-[#1A1A1A]/40 block mb-1">Items</span>
                        <ul className="space-y-1">
                          {o.items.map((i, idx) => (
                            <li key={idx} className="flex justify-between">
                              <span className="truncate">{i.title} × {i.quantity}</span>
                              <span className="flex-shrink-0 ml-2">₹{i.price * i.quantity}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    {/* Admin overrides */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div>
                        <label className="text-[9px] uppercase tracking-widest font-bold text-[#1A1A1A]/40 block mb-1">Adjust Shipping (₹)</label>
                        <input
                          type="number"
                          placeholder={String(o.shippingCost ?? '')}
                          value={shippingEdits[o.id!] ?? ''}
                          onChange={e => setShippingEdits(s => ({ ...s, [o.id!]: e.target.value }))}
                          className="w-full border border-[#1A1A1A]/15 px-2 py-1.5 text-xs outline-none focus:border-[#7D5A34]"
                        />
                      </div>
                      <div>
                        <label className="text-[9px] uppercase tracking-widest font-bold text-[#1A1A1A]/40 block mb-1">Payment Link</label>
                        <input
                          placeholder={o.paymentLink ?? 'https://…'}
                          value={paymentLinks[o.id!] ?? ''}
                          onChange={e => setPaymentLinks(s => ({ ...s, [o.id!]: e.target.value }))}
                          className="w-full border border-[#1A1A1A]/15 px-2 py-1.5 text-xs outline-none focus:border-[#7D5A34]"
                        />
                      </div>
                      <div>
                        <label className="text-[9px] uppercase tracking-widest font-bold text-[#1A1A1A]/40 block mb-1">Notes</label>
                        <input
                          placeholder={o.adminNotes ?? '—'}
                          value={notes[o.id!] ?? ''}
                          onChange={e => setNotes(s => ({ ...s, [o.id!]: e.target.value }))}
                          className="w-full border border-[#1A1A1A]/15 px-2 py-1.5 text-xs outline-none focus:border-[#7D5A34]"
                        />
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-[#1A1A1A]/5">
                      {nextStatus && (
                        <button
                          onClick={() => advance(o)}
                          disabled={isBusy}
                          className="text-[10px] font-bold uppercase tracking-widest bg-[#1A1A1A] text-white px-3 py-2 hover:bg-[#7D5A34] transition-colors disabled:opacity-40"
                        >
                          → Advance to {STATUS_LABELS[nextStatus]}
                        </button>
                      )}
                      <a
                        href={`https://api.whatsapp.com/send?phone=${o.customerPhone.replace(/[^\d]/g, '')}&text=${encodeURIComponent(`Regarding order ${o.orderId}: `)}`}
                        target="_blank" rel="noreferrer"
                        className="text-[10px] font-bold uppercase tracking-widest border border-[#7D5A34]/30 text-[#7D5A34] px-3 py-2 hover:bg-[#7D5A34]/5 transition-colors flex items-center gap-1"
                      >
                        <MessageCircle className="w-3 h-3" /> WhatsApp Customer
                      </a>
                      <select
                        value={o.status}
                        onChange={e => setStatus(o, e.target.value as OrderStatus)}
                        disabled={isBusy}
                        className="text-[10px] font-bold uppercase tracking-widest border border-[#1A1A1A]/20 px-2 py-2 outline-none bg-white"
                      >
                        {ORDER_STATUSES.map(s => (
                          <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                        ))}
                      </select>
                      {o.status !== 'cancelled' && o.status !== 'rejected' && (
                        <button
                          onClick={() => {
                            if (confirm('Reject this order?')) setStatus(o, 'rejected');
                          }}
                          disabled={isBusy}
                          className="text-[10px] font-bold uppercase tracking-widest border border-red-200 text-red-600 px-3 py-2 hover:bg-red-50 transition-colors ml-auto"
                        >
                          Reject
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
