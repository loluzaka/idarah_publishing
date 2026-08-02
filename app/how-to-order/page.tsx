"use client";

import React from 'react';
import { ClipboardList, MessageCircle, Percent, Truck, FileCheck, PackageCheck } from 'lucide-react';

const STEPS = [
  {
    Icon: ClipboardList,
    title: 'Compile Your Selection',
    body: 'Browse the catalog and add titles to your selection to generate a preliminary balance check.',
  },
  {
    Icon: MessageCircle,
    title: 'Submit Your Request',
    body: 'Send your tentative list directly to our desk via the integrated WhatsApp link or the checkout form.',
  },
  {
    Icon: Percent,
    title: 'Editorial Review',
    body: 'Our administrative office reviews the selection and applies any academic or bulk library discounts.',
  },
  {
    Icon: Truck,
    title: 'Freight Calculation',
    body: 'We calculate exact India Post — Gyan Post shipping based on total packaged weight and issue your invoice.',
  },
  {
    Icon: FileCheck,
    title: 'Settle Payment',
    body: 'A verified payment link is issued via email or WhatsApp. Payment is only requested after verification.',
  },
  {
    Icon: PackageCheck,
    title: 'Dispatch & Delivery',
    body: 'Your order is packed at Jayyad Press and dispatched with a tracking number for the postal journey.',
  },
];

export default function HowToOrderPage() {
  return (
    <div className="min-h-screen bg-[#FBFBFA] text-[#1A1A1A] font-serif py-16 px-6 selection:bg-[#7D5A34]/20">
      <div className="max-w-5xl mx-auto">

        {/* Header */}
        <div className="border-l-2 border-[#1A1A1A] pl-6 mb-14 max-w-3xl">
          <span className="font-sans text-xs font-bold tracking-widest uppercase text-[#7D5A34] block mb-2">
            Distribution Protocols
          </span>
          <h1 className="text-4xl md:text-5xl font-normal leading-tight tracking-tight mb-4">
            Ordering &amp; Shipping Terms
          </h1>
          <p className="font-sans text-sm text-[#1A1A1A]/70 leading-relaxed">
            Because we cater directly to research scholars, university libraries, and historic archives,
            our procurement workflow relies on manual verification to ensure precision at every stage.
          </p>
        </div>

        {/* Steps grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 mb-14">
          {STEPS.map(({ Icon, title, body }, i) => (
            <div
              key={title}
              className="group relative bg-white border border-[#1A1A1A]/10 rounded-sm p-6 shadow-sm hover:shadow-md hover:border-[#7D5A34]/40 transition-all duration-300 flex flex-col"
            >
              <div className="flex items-center gap-4 mb-4">
                <div className="w-11 h-11 rounded-full bg-[#7D5A34]/10 text-[#7D5A34] flex items-center justify-center group-hover:bg-[#7D5A34] group-hover:text-white transition-colors">
                  <Icon className="w-5 h-5" strokeWidth={1.75} />
                </div>
                <span className="font-sans text-[10px] font-bold tracking-[0.25em] uppercase text-[#1A1A1A]/40">
                  Step {String(i + 1).padStart(2, '0')}
                </span>
              </div>
              <h3 className="font-serif text-lg font-bold leading-snug mb-2">{title}</h3>
              <p className="font-sans text-xs text-[#1A1A1A]/70 leading-relaxed">{body}</p>
            </div>
          ))}
        </div>

        {/* Bottom CTA panel */}
        <div className="bg-[#1A1A1A] text-white rounded-sm p-8 md:p-10 flex flex-col md:flex-row md:items-center gap-6 justify-between">
          <div className="max-w-xl">
            <span className="font-sans text-[10px] font-bold tracking-[0.25em] uppercase text-[#7D5A34] block mb-2">
              Institutional &amp; Bulk Orders
            </span>
            <h2 className="font-serif text-2xl font-normal leading-snug">
              Need a custom quote for a library, university, or bulk shipment?
            </h2>
          </div>
          <a
            href="https://wa.me/919990426799"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2 bg-[#25D366] hover:bg-[#20ba5a] text-white text-xs font-bold uppercase tracking-widest px-6 py-3.5 rounded-sm transition-colors flex-shrink-0"
          >
            <MessageCircle className="w-4 h-4" />
            Contact WhatsApp Desk
          </a>
        </div>
      </div>
    </div>
  );
}
