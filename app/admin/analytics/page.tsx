"use client";

import React, { useEffect, useState } from 'react';
import { client } from '@/app/sanityClient';
import { BarChart3, TrendingUp, Package, IndianRupee, BookOpen } from 'lucide-react';

interface Analytics {
  monthlyRevenue: { month: string; total: number; count: number }[];
  topBooks: { title: string; unitsSold: number; revenue: number }[];
  totalRevenue: number;
  totalOrders: number;
  averageOrderValue: number;
}

export default function AdminAnalyticsPage() {
  const [data, setData] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const orders = await client.fetch(`*[_type == "order"]{
          _createdAt, totalAmount,
          items[]{ quantity, pricePaid, book->{title} }
        }`);

        // Aggregate per-month
        const monthMap = new Map<string, { total: number; count: number }>();
        // Aggregate per-book
        const bookMap = new Map<string, { title: string; unitsSold: number; revenue: number }>();
        let totalRevenue = 0;

        for (const o of orders ?? []) {
          const date = o._createdAt ? new Date(o._createdAt) : null;
          if (date) {
            const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            const cur = monthMap.get(key) ?? { total: 0, count: 0 };
            cur.total += Number(o.totalAmount) || 0;
            cur.count += 1;
            monthMap.set(key, cur);
          }
          totalRevenue += Number(o.totalAmount) || 0;

          for (const item of o.items ?? []) {
            const title = item.book?.title ?? 'Unknown';
            const cur = bookMap.get(title) ?? { title, unitsSold: 0, revenue: 0 };
            cur.unitsSold += Number(item.quantity) || 0;
            cur.revenue += (Number(item.pricePaid) || 0) * (Number(item.quantity) || 0);
            bookMap.set(title, cur);
          }
        }

        const monthlyRevenue = [...monthMap.entries()]
          .sort((a, b) => a[0].localeCompare(b[0]))
          .slice(-6)
          .map(([month, v]) => ({ month, ...v }));

        const topBooks = [...bookMap.values()]
          .sort((a, b) => b.unitsSold - a.unitsSold)
          .slice(0, 8);

        setData({
          monthlyRevenue,
          topBooks,
          totalRevenue,
          totalOrders: orders?.length ?? 0,
          averageOrderValue: orders?.length > 0 ? Math.round(totalRevenue / orders.length) : 0,
        });
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const maxMonthly = data?.monthlyRevenue.reduce((m, x) => Math.max(m, x.total), 0) ?? 1;

  return (
    <div>
      <div className="flex items-center gap-3 mb-8 pb-6 border-b border-[#1A1A1A]/10">
        <BarChart3 className="w-6 h-6 text-[#7D5A34]" strokeWidth={1.5} />
        <div>
          <span className="text-[10px] uppercase tracking-[0.25em] text-[#7D5A34] font-bold block">Insights</span>
          <h1 className="font-serif text-3xl font-normal">Analytics</h1>
        </div>
      </div>

      {loading ? (
        <p className="text-xs italic text-[#1A1A1A]/40 animate-pulse">Crunching numbers…</p>
      ) : !data ? (
        <p className="text-xs italic text-[#1A1A1A]/40">Could not load analytics.</p>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10">
            <div className="bg-white border border-[#1A1A1A]/10 p-5 rounded-sm">
              <div className="flex items-start justify-between mb-3">
                <span className="text-[9px] uppercase tracking-widest font-bold text-[#1A1A1A]/50">Total Revenue</span>
                <IndianRupee className="w-4 h-4 text-[#7D5A34]" strokeWidth={1.5} />
              </div>
              <p className="font-serif text-2xl font-bold">₹{data.totalRevenue.toLocaleString('en-IN')}</p>
            </div>
            <div className="bg-white border border-[#1A1A1A]/10 p-5 rounded-sm">
              <div className="flex items-start justify-between mb-3">
                <span className="text-[9px] uppercase tracking-widest font-bold text-[#1A1A1A]/50">Total Orders</span>
                <Package className="w-4 h-4 text-[#7D5A34]" strokeWidth={1.5} />
              </div>
              <p className="font-serif text-2xl font-bold">{data.totalOrders}</p>
            </div>
            <div className="bg-white border border-[#1A1A1A]/10 p-5 rounded-sm">
              <div className="flex items-start justify-between mb-3">
                <span className="text-[9px] uppercase tracking-widest font-bold text-[#1A1A1A]/50">Avg Order Value</span>
                <TrendingUp className="w-4 h-4 text-[#7D5A34]" strokeWidth={1.5} />
              </div>
              <p className="font-serif text-2xl font-bold">₹{data.averageOrderValue}</p>
            </div>
          </div>

          {/* Monthly revenue bars */}
          <div className="bg-white border border-[#1A1A1A]/10 p-5 rounded-sm mb-8">
            <h3 className="font-serif text-lg mb-4">Revenue — Last 6 Months</h3>
            {data.monthlyRevenue.length === 0 ? (
              <p className="text-xs italic text-[#1A1A1A]/40">No orders yet.</p>
            ) : (
              <div className="space-y-2">
                {data.monthlyRevenue.map(m => (
                  <div key={m.month}>
                    <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest mb-1">
                      <span>{m.month}</span>
                      <span className="text-[#1A1A1A]/60">₹{m.total.toLocaleString('en-IN')} · {m.count} orders</span>
                    </div>
                    <div className="w-full bg-[#1A1A1A]/5 h-3 rounded-sm overflow-hidden">
                      <div className="h-full bg-[#7D5A34] rounded-sm transition-all" style={{ width: `${(m.total / maxMonthly) * 100}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Top books */}
          <div className="bg-white border border-[#1A1A1A]/10 rounded-sm overflow-hidden">
            <div className="p-5 border-b border-[#1A1A1A]/10 flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-[#7D5A34]" strokeWidth={1.5} />
              <h3 className="font-serif text-lg">Best-Selling Books</h3>
            </div>
            {data.topBooks.length === 0 ? (
              <p className="p-5 text-xs italic text-[#1A1A1A]/40">No sales yet.</p>
            ) : (
              <table className="w-full text-xs">
                <thead className="bg-[#1A1A1A]/[0.02]">
                  <tr className="text-left text-[9px] uppercase tracking-widest text-[#1A1A1A]/40 font-bold">
                    <th className="p-4">Title</th>
                    <th className="p-4 text-right">Units Sold</th>
                    <th className="p-4 text-right">Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {data.topBooks.map(b => (
                    <tr key={b.title} className="border-t border-[#1A1A1A]/5">
                      <td className="p-4 font-serif font-bold">{b.title}</td>
                      <td className="p-4 text-right">{b.unitsSold}</td>
                      <td className="p-4 text-right font-bold">₹{b.revenue.toLocaleString('en-IN')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  );
}
