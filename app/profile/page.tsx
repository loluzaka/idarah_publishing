"use client";

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/app/context/AuthContext';
import { client, urlFor } from '@/app/sanityClient';
import { getWishlist, removeFromWishlist } from '@/app/lib/wishlist';
import { getRecentlyViewedBooks } from '@/app/lib/recommendations';
import { getAddresses, saveAddress, deleteAddress, Address } from '@/app/lib/addresses';
import { getUserOrders, STATUS_LABELS, Order } from '@/app/lib/orders';
import { isAdmin } from '@/app/lib/admin';
import { useUserProfile } from '@/app/hooks/useUserProfile';
import { ACCOUNT_TYPES } from '@/app/lib/userProfile';
import {
  User as UserIcon,
  Package,
  Heart,
  Clock,
  MapPin,
  Settings,
  LogOut,
  ShieldCheck,
  Trash2,
  Plus,
  BookOpen,
} from 'lucide-react';

type TabId = 'orders' | 'wishlist' | 'recent' | 'addresses' | 'account';

const TABS: { id: TabId; label: string; Icon: any }[] = [
  { id: 'orders',    label: 'Orders',           Icon: Package },
  { id: 'wishlist',  label: 'Wishlist',         Icon: Heart },
  { id: 'recent',    label: 'Recently Viewed',  Icon: Clock },
  { id: 'addresses', label: 'Addresses',        Icon: MapPin },
  { id: 'account',   label: 'Account',          Icon: Settings },
];

interface BookLite { _id: string; title: string; author?: string; price: number; coverImage?: any; }

export default function ProfilePage() {
  const { user, loading: authLoading, logout } = useAuth();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<TabId>('orders');
  const [orders, setOrders] = useState<any[]>([]);
  const [wishlistBooks, setWishlistBooks] = useState<BookLite[]>([]);
  const [recentBooks, setRecentBooks] = useState<BookLite[]>([]);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [wishlistLoading, setWishlistLoading] = useState(true);
  const [userIsAdmin, setUserIsAdmin] = useState(false);
  const { profile, discountRate } = useUserProfile();

  // Address form
  const [showAddressForm, setShowAddressForm] = useState(false);
  const [editingAddress, setEditingAddress] = useState<Address | null>(null);
  const [addressError, setAddressError] = useState<string | null>(null);

  // Session guard
  useEffect(() => {
    if (!authLoading && !user) router.push('/login');
  }, [user, authLoading, router]);

  // Fetch orders from Firestore (new workflow) — legacy Sanity orders are ignored.
  useEffect(() => {
    if (!user) return;
    (async () => {
      setOrdersLoading(true);
      try {
        const data = await getUserOrders(user.uid);
        setOrders(data);
      } catch (err) {
        console.error(err);
      } finally {
        setOrdersLoading(false);
      }
    })();
  }, [user]);

  // Fetch wishlist + hydrate with Sanity book data
  useEffect(() => {
    if (!user) return;
    (async () => {
      setWishlistLoading(true);
      try {
        const entries = await getWishlist(user.uid);
        if (entries.length === 0) {
          setWishlistBooks([]);
        } else {
          const ids = entries.map(e => e.bookId);
          const books: BookLite[] = await client.fetch(
            `*[_type == "book" && _id in $ids]{
              _id, title, "author": author->name, price, coverImage
            }`,
            { ids }
          );
          setWishlistBooks(books ?? []);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setWishlistLoading(false);
      }
    })();
  }, [user]);

  // Recently viewed — from localStorage, then hydrate with fresh Sanity data
  useEffect(() => {
    (async () => {
      const recent = getRecentlyViewedBooks();
      if (recent.length === 0) { setRecentBooks([]); return; }
      const ids = recent.map(r => r._id);
      try {
        const books: BookLite[] = await client.fetch(
          `*[_type == "book" && _id in $ids]{ _id, title, "author": author->name, price, coverImage }`,
          { ids }
        );
        // Preserve order from recent (most recent first)
        const map = new Map(books.map(b => [b._id, b]));
        setRecentBooks(ids.map(id => map.get(id)).filter((b): b is BookLite => !!b));
      } catch (err) {
        console.error(err);
      }
    })();
  }, [activeTab]);

  // Addresses
  useEffect(() => {
    if (!user) return;
    getAddresses(user.uid).then(setAddresses).catch(console.error);
  }, [user]);

  // Admin claim
  useEffect(() => {
    if (!user) return;
    isAdmin(user).then(setUserIsAdmin);
  }, [user]);

  const handleLogout = async () => {
    await logout();
    router.push('/login');
  };

  const handleRemoveWishlist = async (bookId: string) => {
    if (!user) return;
    await removeFromWishlist(user.uid, bookId);
    setWishlistBooks(prev => prev.filter(b => b._id !== bookId));
  };

  const handleSaveAddress = async (a: Address) => {
    if (!user) return;
    setAddressError(null);
    const res = await saveAddress(user.uid, a);
    if (!res.ok) { setAddressError(res.error); return; }
    const fresh = await getAddresses(user.uid);
    setAddresses(fresh);
    setShowAddressForm(false);
    setEditingAddress(null);
  };

  const handleDeleteAddress = async (id?: string) => {
    if (!user || !id) return;
    await deleteAddress(user.uid, id);
    setAddresses(prev => prev.filter(a => a.id !== id));
  };

  if (authLoading || !user) {
    return (
      <div className="min-h-screen bg-[#FBFBFA] flex items-center justify-center font-sans">
        <p className="text-xs uppercase tracking-widest text-[#1A1A1A]/40 animate-pulse">Syncing Scholar Dossier...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FBFBFA] text-[#1A1A1A] px-6 py-12 md:py-16 font-sans">
      <div className="max-w-6xl mx-auto">

        {/* Header */}
        <div className="border-b border-[#1A1A1A]/10 pb-6 mb-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-3">
            <UserIcon className="w-6 h-6 text-[#7D5A34]" strokeWidth={1.5} />
            <div>
              <span className="text-[10px] uppercase tracking-[0.25em] text-[#7D5A34] font-bold block mb-1">Idarah-i Adabiyat-i Dilli</span>
              <h2 className="font-serif text-3xl font-normal leading-tight">Scholar Profile</h2>
              <p className="text-xs text-[#1A1A1A]/50 mt-1">{user.email}</p>
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            {userIsAdmin && (
              <button onClick={() => router.push('/admin')} className="flex items-center gap-1.5 text-xs uppercase tracking-widest font-bold bg-[#7D5A34] text-white px-3 py-2 rounded-sm hover:bg-[#1A1A1A] transition-colors">
                <ShieldCheck className="w-3.5 h-3.5" strokeWidth={2} /> Admin
              </button>
            )}
            <button onClick={() => router.push('/books')} className="flex items-center gap-1.5 text-xs uppercase tracking-widest font-bold bg-white border border-[#1A1A1A]/25 px-3 py-2 rounded-sm hover:bg-[#1A1A1A]/5 transition-colors">
              <BookOpen className="w-3.5 h-3.5" strokeWidth={2} /> Catalog
            </button>
            <button onClick={handleLogout} className="flex items-center gap-1.5 text-xs uppercase tracking-widest font-bold bg-[#EA4335]/10 border border-[#EA4335]/20 text-[#EA4335] px-3 py-2 rounded-sm hover:bg-[#EA4335]/20 transition-colors">
              <LogOut className="w-3.5 h-3.5" strokeWidth={2} /> Sign Out
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-8">

          {/* Tabs sidebar */}
          <nav className="flex md:flex-col gap-1 md:sticky md:top-[120px] h-fit overflow-x-auto md:overflow-visible pb-2 md:pb-0 border-b md:border-b-0 border-[#1A1A1A]/10 -mx-4 px-4 md:mx-0 md:px-0">
            {TABS.map(({ id, label, Icon }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={`flex items-center gap-2 text-[10px] md:text-xs uppercase tracking-widest font-bold px-3 py-2.5 border-b-2 md:border-b-0 md:border-l-2 text-left transition-colors flex-shrink-0 ${activeTab === id ? 'border-[#7D5A34] bg-[#7D5A34]/5 text-[#7D5A34]' : 'border-transparent text-[#1A1A1A]/50 hover:text-[#1A1A1A]'}`}
              >
                <Icon className="w-4 h-4 flex-shrink-0" strokeWidth={2} />
                <span className="hidden sm:block">{label}</span>
              </button>
            ))}
          </nav>

          {/* Content */}
          <div>

            {/* ── Orders tab ── */}
            {activeTab === 'orders' && (
              <div>
                <h3 className="font-serif text-2xl font-normal mb-6 flex items-center gap-2"><Package className="w-5 h-5 text-[#7D5A34]" strokeWidth={1.5} /> Order History</h3>
                {ordersLoading ? (
                  <p className="text-xs italic text-[#1A1A1A]/40 animate-pulse">Loading orders…</p>
                ) : orders.length === 0 ? (
                  <div className="border border-dashed border-[#1A1A1A]/10 bg-white p-12 text-center rounded-sm">
                    <p className="text-xs italic text-[#1A1A1A]/50">No orders yet.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {orders.map((order: Order) => {
                      const date = order.createdAt ? new Date(order.createdAt).toLocaleDateString('en-IN', { dateStyle: 'medium' }) : '—';
                      const status = STATUS_LABELS[order.status] ?? order.status;
                      const total = order.total ?? 0;

                      return (
                        <div key={order.orderId} className="bg-white border border-[#1A1A1A]/10 p-5 rounded-sm shadow-sm">
                          <div className="flex justify-between items-start gap-3 mb-3 pb-3 border-b border-[#1A1A1A]/5">
                            <div>
                              <span className="text-xs font-mono font-bold">{order.orderId ?? 'IAD-TEMP'}</span>
                              <span className="text-[10px] uppercase tracking-wider text-[#1A1A1A]/40 block mt-0.5">Placed: {date}</span>
                            </div>
                            <span className="text-[9px] uppercase tracking-wider font-bold px-2.5 py-1 rounded-sm bg-[#7D5A34]/5 text-[#7D5A34] border border-[#7D5A34]/10">{status}</span>
                          </div>
                          {order.items?.map((it, i: number) => (
                            <div key={i} className="flex justify-between text-xs py-1">
                              <span className="font-serif font-bold">{it.title}</span>
                              <span>₹{it.price * it.quantity}</span>
                            </div>
                          ))}
                           <div className="flex justify-between items-center mt-3 pt-3 border-t border-[#1A1A1A]/10">
                            <span className="text-[10px] uppercase tracking-widest text-[#1A1A1A]/40 font-bold">Total</span>
                            <span className="font-serif font-bold text-base">₹{total}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* ── Wishlist tab ── */}
            {activeTab === 'wishlist' && (
              <div>
                <h3 className="font-serif text-2xl font-normal mb-6 flex items-center gap-2"><Heart className="w-5 h-5 text-[#7D5A34]" strokeWidth={1.5} /> Wishlist</h3>
                {wishlistLoading ? (
                  <p className="text-xs italic text-[#1A1A1A]/40 animate-pulse">Loading…</p>
                ) : wishlistBooks.length === 0 ? (
                  <div className="border border-dashed border-[#1A1A1A]/10 bg-white p-12 text-center rounded-sm">
                    <p className="text-xs italic text-[#1A1A1A]/50 mb-3">Your wishlist is empty.</p>
                    <a href="/books" className="text-[10px] font-bold uppercase tracking-widest text-[#7D5A34] hover:underline">Discover books →</a>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                    {wishlistBooks.map(book => (
                      <div key={book._id} className="border border-[#1A1A1A]/5 bg-white p-3 rounded-sm relative group">
                        <button onClick={() => handleRemoveWishlist(book._id)} className="absolute top-2 right-2 text-[#1A1A1A]/40 hover:text-red-500 z-10 opacity-0 group-hover:opacity-100 transition-opacity" title="Remove">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                        <div className="aspect-[3/4] bg-[#1A1A1A]/5 mb-2 overflow-hidden">
                          {book.coverImage ? <img src={urlFor(book.coverImage).width(200).url()} alt={book.title} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-xl opacity-20 font-bold">IAD</div>}
                        </div>
                        <p className="font-serif text-xs font-bold line-clamp-2">{book.title}</p>
                        <p className="text-[10px] text-[#1A1A1A]/50 mt-0.5">By {book.author}</p>
                        <p className="text-xs font-bold mt-1">₹{book.price}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── Recently Viewed tab ── */}
            {activeTab === 'recent' && (
              <div>
                <h3 className="font-serif text-2xl font-normal mb-6 flex items-center gap-2"><Clock className="w-5 h-5 text-[#7D5A34]" strokeWidth={1.5} /> Recently Viewed</h3>
                {recentBooks.length === 0 ? (
                  <div className="border border-dashed border-[#1A1A1A]/10 bg-white p-12 text-center rounded-sm">
                    <p className="text-xs italic text-[#1A1A1A]/50">No recently viewed books.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                    {recentBooks.map(book => (
                      <div key={book._id} className="border border-[#1A1A1A]/5 bg-white p-3 rounded-sm">
                        <div className="aspect-[3/4] bg-[#1A1A1A]/5 mb-2 overflow-hidden">
                          {book.coverImage ? <img src={urlFor(book.coverImage).width(200).url()} alt={book.title} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-xl opacity-20 font-bold">IAD</div>}
                        </div>
                        <p className="font-serif text-xs font-bold line-clamp-2">{book.title}</p>
                        <p className="text-[10px] text-[#1A1A1A]/50 mt-0.5">By {book.author}</p>
                        <p className="text-xs font-bold mt-1">₹{book.price}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── Addresses tab ── */}
            {activeTab === 'addresses' && (
              <div>
                <div className="flex items-center justify-between mb-6">
                  <h3 className="font-serif text-2xl font-normal flex items-center gap-2"><MapPin className="w-5 h-5 text-[#7D5A34]" strokeWidth={1.5} /> Addresses</h3>
                  <button onClick={() => { setEditingAddress(null); setShowAddressForm(true); setAddressError(null); }} className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest bg-[#1A1A1A] text-white px-3 py-2 hover:bg-[#7D5A34] transition-colors">
                    <Plus className="w-3.5 h-3.5" /> Add Address
                  </button>
                </div>

                {showAddressForm && (
                  <AddressForm
                    initial={editingAddress}
                    error={addressError}
                    onCancel={() => { setShowAddressForm(false); setEditingAddress(null); setAddressError(null); }}
                    onSave={handleSaveAddress}
                  />
                )}

                {addresses.length === 0 && !showAddressForm ? (
                  <div className="border border-dashed border-[#1A1A1A]/10 bg-white p-12 text-center rounded-sm">
                    <p className="text-xs italic text-[#1A1A1A]/50">No addresses saved yet.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                    {addresses.map(a => (
                      <div key={a.id} className="border border-[#1A1A1A]/10 bg-white p-4 rounded-sm">
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <span className="text-[10px] uppercase tracking-widest font-bold text-[#7D5A34]">{a.label}</span>
                            {a.isDefault && <span className="ml-2 text-[9px] uppercase tracking-widest text-white bg-[#7D5A34] px-1.5 py-0.5">Default</span>}
                          </div>
                          <div className="flex gap-2">
                            <button onClick={() => { setEditingAddress(a); setShowAddressForm(true); setAddressError(null); }} className="text-[10px] uppercase tracking-widest font-bold text-[#1A1A1A]/50 hover:text-[#7D5A34]">Edit</button>
                            <button onClick={() => handleDeleteAddress(a.id)} className="text-[#1A1A1A]/40 hover:text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
                          </div>
                        </div>
                        <p className="text-xs font-bold">{a.fullName}</p>
                        <p className="text-[11px] text-[#1A1A1A]/70 mt-1 leading-relaxed">
                          {a.addressLine1}{a.addressLine2 ? `, ${a.addressLine2}` : ''}<br />
                          {a.city}{a.state ? `, ${a.state}` : ''} {a.postalCode}<br />
                          {a.country}
                        </p>
                        {a.phone && <p className="text-[10px] text-[#1A1A1A]/50 mt-2">📞 {a.phone}</p>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── Account tab ── */}
            {activeTab === 'account' && (
              <div>
                <h3 className="font-serif text-2xl font-normal mb-6 flex items-center gap-2"><Settings className="w-5 h-5 text-[#7D5A34]" strokeWidth={1.5} /> Account Information</h3>
                <div className="bg-white border border-[#1A1A1A]/10 p-6 rounded-sm space-y-4">
                  <div>
                    <span className="text-[10px] uppercase tracking-widest font-bold text-[#1A1A1A]/40 block mb-1">Display Name</span>
                    <p className="text-sm">{user.displayName || <span className="italic text-[#1A1A1A]/40">Not set</span>}</p>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase tracking-widest font-bold text-[#1A1A1A]/40 block mb-1">Email</span>
                    <p className="text-sm">{user.email}</p>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase tracking-widest font-bold text-[#1A1A1A]/40 block mb-1">Account Created</span>
                    <p className="text-sm">{user.metadata?.creationTime ? new Date(user.metadata.creationTime).toLocaleDateString('en-IN', { dateStyle: 'medium' }) : '—'}</p>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase tracking-widest font-bold text-[#1A1A1A]/40 block mb-1">Last Sign-In</span>
                    <p className="text-sm">{user.metadata?.lastSignInTime ? new Date(user.metadata.lastSignInTime).toLocaleDateString('en-IN', { dateStyle: 'medium' }) : '—'}</p>
                  </div>
                  {profile && (
                    <div className="pt-3 border-t border-[#1A1A1A]/5 space-y-3">
                      <div>
                        <span className="text-[10px] uppercase tracking-widest font-bold text-[#1A1A1A]/40 block mb-1">Account Type</span>
                        <p className="text-sm">{ACCOUNT_TYPES.find(t => t.value === profile.accountType)?.label ?? profile.accountType}</p>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase tracking-widest font-bold text-[#1A1A1A]/40 block mb-1">Verification Status</span>
                        <span className={`inline-block text-[10px] uppercase tracking-widest font-bold px-2 py-1 rounded-sm border ${
                          profile.verificationStatus === 'approved' ? 'bg-green-50 text-green-700 border-green-200' :
                          profile.verificationStatus === 'pending' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                          profile.verificationStatus === 'rejected' ? 'bg-red-50 text-red-700 border-red-200' :
                          'bg-[#1A1A1A]/5 text-[#1A1A1A]/60 border-[#1A1A1A]/10'
                        }`}>
                          {profile.verificationStatus.replace(/_/g, ' ')}
                        </span>
                        {profile.verificationStatus === 'pending' && (
                          <p className="text-[10px] italic text-[#1A1A1A]/50 mt-2 leading-relaxed">
                            Your account is under review. You can still shop at regular pricing until approved.
                          </p>
                        )}
                      </div>
                      {discountRate > 0 && (
                        <div>
                          <span className="text-[10px] uppercase tracking-widest font-bold text-[#1A1A1A]/40 block mb-1">Your Discount</span>
                          <p className="text-sm font-bold text-[#7D5A34]">{discountRate}% off all publications</p>
                        </div>
                      )}
                    </div>
                  )}
                  {userIsAdmin && (
                    <div className="pt-3 border-t border-[#1A1A1A]/5">
                      <span className="text-[10px] uppercase tracking-widest font-bold text-[#7D5A34]">Admin Privileges Enabled</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Address Form ─────────────────────────────────────────────────────────────

function AddressForm({ initial, error, onSave, onCancel }: { initial: Address | null; error: string | null; onSave: (a: Address) => void; onCancel: () => void }) {
  const [form, setForm] = useState<Address>(initial ?? { country: 'India' });

  return (
    <form
      onSubmit={e => { e.preventDefault(); onSave(form); }}
      className="bg-white border border-[#1A1A1A]/10 p-5 rounded-sm space-y-3 mb-4"
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <input placeholder="Label (Home, Office, …)" value={form.label ?? ''} onChange={e => setForm(f => ({ ...f, label: e.target.value }))} className="border border-[#1A1A1A]/10 p-2 text-xs outline-none" />
        <input placeholder="Full Name" value={form.fullName ?? ''} onChange={e => setForm(f => ({ ...f, fullName: e.target.value }))} className="border border-[#1A1A1A]/10 p-2 text-xs outline-none" />
        <input placeholder="Phone" value={form.phone ?? ''} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} className="border border-[#1A1A1A]/10 p-2 text-xs outline-none" />
        <input placeholder="Postal Code *" required value={form.postalCode ?? ''} onChange={e => setForm(f => ({ ...f, postalCode: e.target.value }))} className="border border-[#1A1A1A]/10 p-2 text-xs outline-none" />
      </div>
      <input placeholder="Address Line 1 *" required value={form.addressLine1 ?? ''} onChange={e => setForm(f => ({ ...f, addressLine1: e.target.value }))} className="w-full border border-[#1A1A1A]/10 p-2 text-xs outline-none" />
      <input placeholder="Address Line 2 (optional)" value={form.addressLine2 ?? ''} onChange={e => setForm(f => ({ ...f, addressLine2: e.target.value }))} className="w-full border border-[#1A1A1A]/10 p-2 text-xs outline-none" />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <input placeholder="City *" required value={form.city ?? ''} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} className="border border-[#1A1A1A]/10 p-2 text-xs outline-none" />
        <input placeholder="State" value={form.state ?? ''} onChange={e => setForm(f => ({ ...f, state: e.target.value }))} className="border border-[#1A1A1A]/10 p-2 text-xs outline-none" />
        <input placeholder="Country" value={form.country ?? 'India'} onChange={e => setForm(f => ({ ...f, country: e.target.value }))} className="border border-[#1A1A1A]/10 p-2 text-xs outline-none" />
      </div>
      <label className="flex items-center gap-2 text-xs">
        <input type="checkbox" checked={!!form.isDefault} onChange={e => setForm(f => ({ ...f, isDefault: e.target.checked }))} className="accent-[#7D5A34]" />
        Set as default address
      </label>
      {error && <p className="text-[11px] text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button type="submit" className="text-[10px] font-bold uppercase tracking-widest bg-[#1A1A1A] text-white px-4 py-2 hover:bg-[#7D5A34] transition-colors">Save</button>
        <button type="button" onClick={onCancel} className="text-[10px] font-bold uppercase tracking-widest border border-[#1A1A1A]/20 px-4 py-2 hover:bg-[#1A1A1A]/5 transition-colors">Cancel</button>
      </div>
    </form>
  );
}
