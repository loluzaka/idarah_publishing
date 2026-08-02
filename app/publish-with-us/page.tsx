"use client";

import React, { useState } from 'react';

export default function Submissions() {
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
  };

  return (
    <div className="min-h-screen bg-[#FBFBFA] text-[#1A1A1A] font-serif selection:bg-[#7D5A34]/20">
      
      {/* HEADER / NAVIGATION */}
      <header className="border-b border-[#1A1A1A]/10 bg-[#FBFBFA]/80 backdrop-blur-md px-6 py-4">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <h1 className="text-base font-bold tracking-widest text-[#1A1A1A] uppercase">
              Idarah-i Adabiyat-i Dilli
            </h1>
          </div>
          <nav className="flex items-center gap-8 font-sans text-xs tracking-widest uppercase font-medium">
            <a href="/" className="hover:text-[#7D5A34] transition-colors">Home/Store</a>
            <a href="/submissions" className="hover:text-[#7D5A34] transition-colors border-b border-[#1A1A1A]">Submissions</a>
          </nav>
        </div>
      </header>

      {/* FORM CONTAINER */}
      <main className="max-w-xl mx-auto px-6 py-16">
        <div className="border-b border-[#1A1A1A]/20 pb-6 mb-8">
          <h2 className="text-3xl font-normal tracking-tight mb-2">Manuscript Submissions</h2>
          <p className="font-sans text-xs uppercase tracking-wider text-[#1A1A1A]/60">
            Guideline-Compliant Proposals for Academic Review
          </p>
        </div>

        {submitted ? (
          <div className="border border-[#1A1A1A]/10 bg-[#1A1A1A]/[0.02] p-8 text-center my-12">
            <h3 className="text-lg font-bold mb-2">Proposal Received</h3>
            <p className="font-sans text-xs text-[#1A1A1A]/70 leading-relaxed">
              Thank you for submitting your academic work. Our editorial board will review your structural proposal and contact you regarding historical alignment.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6 font-sans text-xs tracking-wider uppercase font-medium">
            
            <div>
              <label className="block text-[#1A1A1A]/70 mb-2">Scholar Name</label>
              <input required type="text" className="w-full bg-transparent border-b border-[#1A1A1A]/30 focus:border-[#1A1A1A] outline-none py-2 normal-case font-serif text-sm text-[#1A1A1A]" />
            </div>

            <div>
              <label className="block text-[#1A1A1A]/70 mb-2">Institutional Email</label>
              <input required type="email" className="w-full bg-transparent border-b border-[#1A1A1A]/30 focus:border-[#1A1A1A] outline-none py-2 normal-case text-sm text-[#1A1A1A]" />
            </div>

            <div>
              <label className="block text-[#1A1A1A]/70 mb-2">Primary Academic Focus</label>
              <select className="w-full bg-[#FBFBFA] border-b border-[#1A1A1A]/30 focus:border-[#1A1A1A] outline-none py-2 text-xs font-bold text-[#1A1A1A]">
                <option>Mughal Historical Texts</option>
                <option>Sufi Literature Studies</option>
                <option>Persian/Urdu Translations</option>
                <option>Other South Asian Histories</option>
              </select>
            </div>

            <div>
              <label className="block text-[#1A1A1A]/70 mb-2">Abstract / Project Summary</label>
              <textarea required rows={5} placeholder="Briefly state your primary sources, thesis arguments, or translation framework..." className="w-full bg-transparent border border-[#1A1A1A]/20 focus:border-[#1A1A1A] outline-none p-3 normal-case font-serif text-sm text-[#1A1A1A] placeholder:text-[#1A1A1A]/30" />
            </div>

            <button type="submit" className="w-full bg-[#1A1A1A] text-[#FBFBFA] py-4 tracking-widest font-bold border border-[#1A1A1A] hover:bg-transparent hover:text-[#1A1A1A] transition-all duration-300">
              Submit Proposal
            </button>
            
          </form>
        )}
      </main>

    </div>
  );
}