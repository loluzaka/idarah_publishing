"use client";

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { client } from '@/app/sanityClient';
import { LayoutDashboard, Package, MessageSquare, IndianRupee, BookOpen, AlertCircle, Clock } from 'lucide-react';
import { db } from '@/app/lib/firebase';
import { collectionGroup, getDocs, query, where } from 'firebase/firestore';

interface Stat { label: string; value: string | number; Icon: any; hint?: string; }

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<{ orders: number; pendingOrders: number; pendingReviews: number; revenue: number; totalBooks: number; outOfStock: number } | null>(null);
  const [recentOrders, setRecentOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        // Sanity stats
        const [orderStats, recent, bookStats] = await Promise.all([
          client.fetch(`{
            "total": count(*[_type == "order"]),
            "pending": count(*[_type == "order" && status == "pending_sync"]),
            "revenue": math::sum(*[_type == "order"].totalAmount)
          }`),
          client.fetch(`*[_type == "order"] | order(_createdAt desc) [0...5]{
            orderId, status, totalAmount, customerName, _createdAt
          }`),
          client.fetch(`{
            "total": count(*[_type == "book"]),
            "outOfStock": count(*[_type == "book" && defined(stock) && stock == 0])
          }`),
        ]);

        // Firestore: count pending reviews across all books
        let pendingReviews = 0;
        try {
          const q = query(collectionGroup(db, 'entries'), where('status', '==', 'pending'));
          const snap = await getDocs(q);
          pendingReviews = snap.size;
        } catch (err) {
          console.warn('Failed to count pending reviews (Firestore index may be required):', err);
        }

        setStats({
          orders: orderStats?.total ?? 0,
          pendingOrders: orderStats?.pending ?? 0,
          pendingReviews,
          revenue: orderStats?.revenue ?? 0,
          totalBooks: bookStats?.total ?? 0,
          outOfStock: bookStats?.outOfStock ?? 0,
        });
        setRecentOrders(recent ?? []);
      } catch (err) {
        console.error('Dashboard fetch failed:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const cards: Stat[] = stats ? [
    { label: 'Total Orders',    value: stats.orders,        Icon: Package },
    { label: 'Pending Orders',  value: stats.pendingOrders, Icon: Clock,        hint: 'Need processing' },
    { label: 'Revenue',         value: `₹${stats.revenue.toLocaleString('en-IN')}`, Icon: IndianRupee },
    { label: 'Pending Reviews', value: stats.pendingReviews, Icon: MessageSquare, hint: 'Awaiting approval' },
    { label: 'Total Books',     value: stats.totalBooks,    Icon: BookOpen },
    { label: 'Out of Stock',    value: stats.outOfStock,    Icon: AlertCircle,  hint: 'Restock needed' },
  ] : [];

  return (
    <div>
      <div className="flex items-center gap-3 mb-8 pb-6 border-b border-[#1A1A1A]/10">
        <LayoutDashboard className="w-6 h-6 text-[#7D5A34]" strokeWidth={1.5} />
        <div>
          <span className="text-[10px] uppercase tracking-[0.25em] text-[#7D5A34] font-bold block">Overview</span>
          <h1 className="font-serif text-3xl font-normal">Admin Dashboard</h1>
        </div>
      </div>

      {loading ? (
        <p className="text-xs uppercase tracking-widest text-[#1A1A1A]/40 animate-pulse">Loading stats…</p>
      ) : (
        <>
          {/* Stat grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-10">
            {cards.map(({ label, value, Icon, hint }) => (
              <div key={label} className="bg-white border border-[#1A1A1A]/10 p-5 rounded-sm">
                <div className="flex items-start justify-between mb-3">
                  <span className="text-[9px] uppercase tracking-widest font-bold text-[#1A1A1A]/50">{label}</span>
                  <Icon className="w-4 h-4 text-[#7D5A34]" strokeWidth={1.5} />
                </div>
                <p className="font-serif text-2xl font-bold">{value}</p>
                {hint && <p className="text-[10px] text-[#1A1A1A]/40 mt-1">{hint}</p>}
              </div>
            ))}
          </div>

          {/* Quick action panels */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-10">
            <Link href="/admin/orders" className="block bg-white border border-[#1A1A1A]/10 p-5 rounded-sm hover:shadow-sm transition-shadow group">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[9px] uppercase tracking-widest font-bold text-[#7D5A34]">Action Needed</span>
                  <h3 className="font-serif text-lg mt-1 group-hover:text-[#7D5A34] transition-colors">Review Pending Orders</h3>
                  <p className="text-[11px] text-[#1A1A1A]/50 mt-1">{stats?.pendingOrders ?? 0} orders awaiting processing.</p>
                </div>
                <Package className="w-6 h-6 text-[#1A1A1A]/20" strokeWidth={1.5} />
              </div>
            </Link>
            <Link href="/admin/reviews" className="block bg-white border border-[#1A1A1A]/10 p-5 rounded-sm hover:shadow-sm transition-shadow group">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[9px] uppercase tracking-widest font-bold text-[#7D5A34]">Action Needed</span>
                  <h3 className="font-serif text-lg mt-1 group-hover:text-[#7D5A34] transition-colors">Approve Reviews</h3>
                  <p className="text-[11px] text-[#1A1A1A]/50 mt-1">{stats?.pendingReviews ?? 0} reviews awaiting approval.</p>
                </div>
                <MessageSquare className="w-6 h-6 text-[#1A1A1A]/20" strokeWidth={1.5} />
              </div>
            </Link>
          </div>

          {/* Recent activity */}
          <div className="bg-white border border-[#1A1A1A]/10 rounded-sm">
            <div className="p-5 border-b border-[#1A1A1A]/10">
              <h3 className="font-serif text-lg">Recent Orders</h3>
            </div>
            {recentOrders.length === 0 ? (
              <p className="p-5 text-xs italic text-[#1A1A1A]/40">No orders yet.</p>
            ) : (
              <table className="w-full text-xs">
                <thead className="bg-[#1A1A1A]/[0.02]">
                  <tr className="text-left text-[9px] uppercase tracking-widest text-[#1A1A1A]/40 font-bold">
                    <th className="p-4">Order</th>
                    <th className="p-4">Customer</th>
                    <th className="p-4">Status</th>
                    <th className="p-4 text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {recentOrders.map(o => (
                    <tr key={o.orderId} className="border-t border-[#1A1A1A]/5">
                      <td className="p-4 font-mono">{o.orderId}</td>
                      <td className="p-4">{o.customerName}</td>
                      <td className="p-4"><span className="text-[9px] uppercase tracking-widest font-bold px-2 py-1 rounded-sm bg-[#7D5A34]/5 text-[#7D5A34]">{(o.status ?? '').replace(/_/g, ' ')}</span></td>
                      <td className="p-4 text-right font-bold">₹{o.totalAmount ?? 0}</td>
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
