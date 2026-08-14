"use client";

import React, { useState } from 'react';
import { Mail, Phone, MapPin, Clock, MessageCircle, Send, ExternalLink } from 'lucide-react';

const ADDRESS_QUERY = 'Idarah-i Adabiyat-i Dilli, A-639, Plot No. 23, Zakir Nagar West, Okhla, New Delhi 110025';
const MAP_LINK = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(ADDRESS_QUERY)}`;

const InstagramIcon = () => (
  <svg className="w-4 h-4 text-[#E4405F]" fill="currentColor" viewBox="0 0 24 24">
    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
  </svg>
);

export default function ContactPage() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: 'General Inquiry',
    message: ''
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const mailtoUri = `mailto:idarahiadabiyatidelhi@gmail.com?subject=${encodeURIComponent(formData.subject + ' - ' + formData.name)}&body=${encodeURIComponent(formData.message + '\n\nFrom: ' + formData.email)}`;
    window.location.href = mailtoUri;
  };

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  const embedSrc = apiKey
    ? `https://www.google.com/maps/embed/v1/place?key=${apiKey}&q=${encodeURIComponent(ADDRESS_QUERY)}&zoom=16`
    : `https://maps.google.com/maps?q=${encodeURIComponent(ADDRESS_QUERY)}&z=16&output=embed`;

  return (
    <div className="min-h-screen bg-[#FBFBFA] text-[#1A1A1A] font-serif py-12 px-6 selection:bg-[#7D5A34]/20">
      <div className="max-w-4xl mx-auto my-8">

        {/* Header */}
        <div className="border-l-2 border-[#1A1A1A] pl-6 mb-12">
          <span className="font-sans text-xs font-bold tracking-widest uppercase text-[#7D5A34] block mb-2">
            GET IN TOUCH
          </span>
          <h1 className="text-4xl md:text-5xl font-normal leading-tight tracking-tight mb-4">
            Connect With Us
          </h1>
          <p className="font-sans text-sm text-[#1A1A1A]/70 max-w-xl">
            Reach out to us for book inquiries, orders or any questions
            <br />
            Always happy to help!
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 font-sans">

          {/* Left — Address, Map & Hours */}
          <div className="lg:col-span-5 space-y-8">

            <div className="flex items-start gap-3">
              <MapPin className="w-5 h-5 text-[#7D5A34] shrink-0 mt-1" />
              <div className="flex-grow">
                <h3 className="font-bold uppercase text-[11px] tracking-wider text-[#1A1A1A]/50 mb-1">
                  Office Address
                </h3>
                <p className="font-serif text-base text-[#1A1A1A] leading-relaxed">
                  Idarah-i Adabiyat-i Dilli
                </p>
                <p className="text-sm text-[#1A1A1A]/70 leading-relaxed mb-3">
                  A-639, Plot No. 23, Zakir Nagar West,<br />
                  Gaddha Colony, Okhla, South East,<br />
                  New Delhi, Delhi 110025
                </p>
                <div className="rounded-md overflow-hidden border border-[#1A1A1A]/10 shadow-sm bg-[#1A1A1A]/5">
                  <iframe
                    title="Idarah-i Adabiyat-i Dilli — Google Maps"
                    src={embedSrc}
                    width="100%"
                    height="240"
                    style={{ border: 0, display: 'block' }}
                    loading="lazy"
                    allowFullScreen
                    referrerPolicy="no-referrer-when-downgrade"
                  />
                </div>
                <a
                  href={MAP_LINK}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 mt-2 text-[11px] font-bold uppercase tracking-wider text-[#7D5A34] hover:text-[#1A1A1A] transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Open in Google Maps
                </a>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Clock className="w-5 h-5 text-[#7D5A34] shrink-0 mt-1" />
              <div>
                <h3 className="font-bold uppercase text-[11px] tracking-wider text-[#1A1A1A]/50 mb-1">
                  VISITS & INQUIRIES
                </h3>
                <p className="text-sm text-[#1A1A1A]/80 leading-relaxed">
                  By Appointment Only<br />
                  Mon – Sat: 10:00 AM – 6:00 PM <br />
                  <span className="text-xs text-[#1A1A1A]/60 bold">
                  
                    We operate our publishing house from our family home. To ensure someone is available to assist you, please inform us in advance via call or WhatsApp before dropping by
                  </span>
                </p>
              </div>
            </div>
          </div>

          {/* Right — Phone / Email / Instagram → then Send a Message */}
          <div className="lg:col-span-7 space-y-6">

            {/* Phone */}
            <div className="flex items-start gap-3">
              <Phone className="w-5 h-5 text-[#7D5A34] shrink-0 mt-1" />
              <div className="space-y-3">
                <div>
                  <h3 className="font-bold uppercase text-[11px] tracking-wider text-[#1A1A1A]/50 mb-1">
                    Direct Phone / WhatsApp Desk
                  </h3>
                  <a
                    href="tel:+919990426799"
                    className="font-serif text-lg font-bold text-[#7D5A34] hover:underline"
                  >
                    +91 99904 26799
                  </a>
                </div>
                <a
                  href="https://wa.me/919990426799"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 bg-[#25D366] hover:bg-[#20ba5a] text-white text-xs font-bold uppercase tracking-wider px-4 py-2.5 rounded shadow-sm transition-all"
                >
                  <MessageCircle className="w-4 h-4 fill-white" />
                  Chat on WhatsApp
                </a>
              </div>
            </div>

            {/* Email */}
            <div className="flex items-start gap-3">
              <Mail className="w-5 h-5 text-[#7D5A34] shrink-0 mt-1" />
              <div>
                <h3 className="font-bold uppercase text-[11px] tracking-wider text-[#1A1A1A]/50 mb-1">
                  Email Desk
                </h3>
                <a
                  href="mailto:idarahiadabiyatidelhi@gmail.com"
                  className="text-sm text-[#1A1A1A] underline decoration-[#7D5A34]/50 hover:text-[#7D5A34]"
                >
                  idarahiadabiyatidelhi@gmail.com
                </a>
              </div>
            </div>

            {/* Instagram */}
            <div className="flex items-start gap-3 pb-6 border-b border-[#1A1A1A]/10">
              <div className="w-5 h-5 shrink-0 mt-1 flex items-center justify-center">
                <InstagramIcon />
              </div>
              <div>
                <h3 className="font-bold uppercase text-[11px] tracking-wider text-[#1A1A1A]/50 mb-1">
                  Follow Us Online
                </h3>
                <a
                  href="https://www.instagram.com/idarahiadabiyatidelhi"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-xs font-semibold text-[#1A1A1A] hover:text-[#7D5A34] transition-colors border border-[#1A1A1A]/20 rounded-md px-3 py-2 bg-white"
                >
                  <InstagramIcon />
                  @idarahiadabiyatidelhi
                </a>
              </div>
            </div>

            {/* Send a Message form — below the contact details */}
            <div className="bg-white p-6 md:p-8 rounded-lg border border-[#1A1A1A]/10 shadow-sm">
              <h2 className="font-serif text-2xl text-[#1A1A1A] mb-2">Send a Message</h2>
              <p className="text-xs text-[#1A1A1A]/60 mb-6">
                Fill out the form below and we will get back to your query as soon as possible.
              </p>

              <form onSubmit={handleSubmit} className="space-y-4 text-sm">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#1A1A1A]/70 mb-1">
                    Your Full Name
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Jawn Don"
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    className="w-full px-3 py-2 bg-[#FBFBFA] border border-[#1A1A1A]/20 rounded focus:outline-none focus:border-[#7D5A34]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#1A1A1A]/70 mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="you@example.com"
                    value={formData.email}
                    onChange={(e) => setFormData({...formData, email: e.target.value})}
                    className="w-full px-3 py-2 bg-[#FBFBFA] border border-[#1A1A1A]/20 rounded focus:outline-none focus:border-[#7D5A34]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#1A1A1A]/70 mb-1">
                    Purpose of Query
                  </label>
                  <select
                    value={formData.subject}
                    onChange={(e) => setFormData({...formData, subject: e.target.value})}
                    className="w-full px-3 py-2 bg-[#FBFBFA] border border-[#1A1A1A]/20 rounded focus:outline-none focus:border-[#7D5A34]"
                  >
                    <option>General Inquiry</option>
                    <option>Book Availability &amp; Purchase</option>
                    <option>Bulk / Academic Library Orders</option>
                    <option>Manuscript &amp; Editorial Proposal</option>
                    <option>International Shipping Query</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#1A1A1A]/70 mb-1">
                    Message
                  </label>
                  <textarea
                    rows={4}
                    required
                    placeholder="State the books, authors, or subjects you are inquiring about..."
                    value={formData.message}
                    onChange={(e) => setFormData({...formData, message: e.target.value})}
                    className="w-full px-3 py-2 bg-[#FBFBFA] border border-[#1A1A1A]/20 rounded focus:outline-none focus:border-[#7D5A34]"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full flex items-center justify-center gap-2 bg-[#1A1A1A] hover:bg-[#7D5A34] text-white text-xs font-bold uppercase tracking-widest py-3 px-4 rounded transition-colors"
                >
                  <Send className="w-3.5 h-3.5" />
                  Submit Message
                </button>
              </form>
            </div>
          </div>

        </div>

        <div className="border-t border-[#1A1A1A]/10 mt-12 pt-6 text-xs text-[#1A1A1A]/50 font-sans leading-relaxed text-center">
          For specialized collection catalogs, custom library packaging quotes, or international billing arrangements, please reach out directly via our WhatsApp line or email.
        </div>
      </div>
    </div>
  );
}
