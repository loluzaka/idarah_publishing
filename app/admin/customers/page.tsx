"use client";

import React, { useEffect, useState } from 'react';
import { client } from '@/app/sanityClient';
import { Users } from 'lucide-react';

interface CustomerSummary {
  userId: string;
  name: string;
  email?: string;
  phone?: string;
  orderCount: number;
  totalSpent: number;
  lastOrderAt?: string;
}

export default function AdminCustomersPage() {
  const [customers, setCustomers] = useState<CustomerSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const orders = await client.fetch(`*[_type == "order"]{
          userId, customerName, customerEmail, customerPhone, totalAmount, _createdAt
        }`);

        const map = new Map<string, CustomerSummary>();
        for (const o of orders ?? []) {
          const key = o.userId || o.customerEmail || o.customerPhone || 'unknown';
          const cur = map.get(key) ?? {
            userId: key,
            name: o.customerName ?? '—',
            email: o.customerEmail,
            phone: o.customerPhone,
            orderCount: 0,
            totalSpent: 0,
          };
          cur.orderCount++;
          cur.totalSpent += Number(o.totalAmount) || 0;
          if (!cur.lastOrderAt || (o._createdAt && o._createdAt > cur.lastOrderAt)) cur.lastOrderAt = o._createdAt;
          map.set(key, cur);
        }

        setCustomers([...map.values()].sort((a, b) => b.totalSpent - a.totalSpent));
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filtered = search.trim()
    ? customers.filter(c => (c.name + ' ' + (c.email ?? '') + ' ' + (c.phone ?? '')).toLowerCase().includes(search.toLowerCase()))
    : customers;

  return (
    <div>
      <div className="flex items-center gap-3 mb-8 pb-6 border-b border-[#1A1A1A]/10">
        <Users className="w-6 h-6 text-[#7D5A34]" strokeWidth={1.5} />
        <div>
          <span className="text-[10px] uppercase tracking-[0.25em] text-[#7D5A34] font-bold block">Patrons</span>
          <h1 className="font-serif text-3xl font-normal">Customers</h1>
        </div>
      </div>

      <input
        type="text"
        placeholder="Search by name, email, phone…"
        value={search}
        onChange={e => setSearch(e.target.value)}
        className="w-full max-w-md mb-6 bg-white border border-[#1A1A1A]/10 px-3 py-2 text-xs outline-none focus:border-[#7D5A34]"
      />

      {loading ? (
        <p className="text-xs italic text-[#1A1A1A]/40 animate-pulse">Loading customers…</p>
      ) : filtered.length === 0 ? (
        <div className="border border-dashed border-[#1A1A1A]/10 bg-white p-12 text-center rounded-sm">
          <p className="text-xs italic text-[#1A1A1A]/50">No customers yet.</p>
        </div>
      ) : (
        <div className="bg-white border border-[#1A1A1A]/10 rounded-sm overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-[#1A1A1A]/[0.02]">
              <tr className="text-left text-[9px] uppercase tracking-widest text-[#1A1A1A]/40 font-bold">
                <th className="p-4">Customer</th>
                <th className="p-4">Contact</th>
                <th className="p-4 text-right">Orders</th>
                <th className="p-4 text-right">Total Spent</th>
                <th className="p-4">Last Order</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(c => (
                <tr key={c.userId} className="border-t border-[#1A1A1A]/5">
                  <td className="p-4 font-bold">{c.name}</td>
                  <td className="p-4 text-[#1A1A1A]/70">
                    {c.email && <p>{c.email}</p>}
                    {c.phone && <p className="text-[10px] text-[#1A1A1A]/50">{c.phone}</p>}
                  </td>
                  <td className="p-4 text-right">{c.orderCount}</td>
                  <td className="p-4 text-right font-bold">₹{c.totalSpent.toLocaleString('en-IN')}</td>
                  <td className="p-4 text-[10px] text-[#1A1A1A]/50">{c.lastOrderAt ? new Date(c.lastOrderAt).toLocaleDateString('en-IN') : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
