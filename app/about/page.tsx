"use client";

import React from 'react';
import Image from 'next/image';

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-[#FBFBFA] text-[#1A1A1A] font-serif py-12 px-6 selection:bg-[#7D5A34]/20">
      <div className="max-w-4xl mx-auto my-8">
        
        {/* Top Center Logo Header */}
        <div className="flex flex-col items-center text-center mb-12">
          <div className="relative w-28 h-28 mb-6 rounded-full overflow-hidden shadow-md border border-[#1A1A1A]/10">
            <Image 
              src="/og-default.jpg" 
              alt="Idarah-i Adabiyat-i Dilli Logo" 
              fill 
              className="object-cover"
              priority
            />
          </div>
          <span className="font-sans text-xs font-bold tracking-widest uppercase text-[#7D5A34] block mb-2">
            Preserving Heritage, Advancing Scholarship
          </span>
          <h1 className="text-4xl md:text-5xl font-normal leading-tight tracking-tight text-[#1A1A1A]">
            About the Idarah
          </h1>
          <p className="font-sans text-sm text-[#1A1A1A]/60 italic mt-2">
            Established in 1970 • Delhi, India
          </p>
        </div>

        {/* Main Content Area */}
        <div className="space-y-12">
          
          {/* Main Intro Block */}
          <div className="border-l-2 border-[#1A1A1A] pl-6 md:pl-8 py-1">
            <div className="font-sans text-base text-[#1A1A1A]/80 tracking-wide leading-relaxed space-y-4 max-w-3xl">
              <p>
                Established in 1970, <strong className="font-semibold text-[#1A1A1A]">Idarah-i Adabiyat-i Dilli</strong> has long served as a crucial pillar for the preservation of historical literature, rare oriental monographs, and classical translations in Delhi.
              </p>
              <p>
                In close, historic association with the legendary <strong className="font-semibold text-[#1A1A1A]">Jayyad Press</strong>, we continue to bridge the gap between vital primary source materials—including critical editions of Persian text records—and the modern global research community.
              </p>
            </div>
          </div>

          {/* Detailed Sections */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 font-sans pt-4">
            
            {/* Our Legacy & Purpose */}
            <div className="bg-white p-6 rounded-lg border border-[#1A1A1A]/10 shadow-sm space-y-3">
              <h2 className="font-serif text-xl text-[#1A1A1A] border-b border-[#7D5A34]/20 pb-2">
                Our Legacy & Purpose
              </h2>
              <p className="text-sm text-[#1A1A1A]/70 leading-relaxed">
                For over five decades, the Idarah has stood as a guardian of intellectual heritage. Established to safeguard rare manuscripts, historical records, and literary masterworks, our house continuously publishes seminal works that re-examine South Asian history, philosophy, and literature.
              </p>
            </div>

            {/* What We Do */}
            <div className="bg-white p-6 rounded-lg border border-[#1A1A1A]/10 shadow-sm space-y-3">
              <h2 className="font-serif text-xl text-[#1A1A1A] border-b border-[#7D5A34]/20 pb-2">
                What We Do
              </h2>
              <ul className="text-sm text-[#1A1A1A]/70 space-y-2 list-disc list-inside leading-relaxed">
                <li><strong className="text-[#1A1A1A]">Academic Publishing:</strong> Curating critical analyses of medieval and modern South Asian history.</li>
                <li><strong className="text-[#1A1A1A]">Literary Preservation:</strong> Preserving rare Urdu, Persian, and Arabic texts for contemporary audiences.</li>
                <li><strong className="text-[#1A1A1A]">Research Support:</strong> Providing scholars access to authentic primary sources and annotated volumes.</li>
              </ul>
            </div>

          </div>

          {/* Highlight Quote Block */}
          <div className="bg-[#7D5A34]/5 border-y border-[#7D5A34]/20 py-8 px-6 text-center rounded-sm my-8">
            <blockquote className="font-serif italic text-lg md:text-xl text-[#1A1A1A]/90 max-w-2xl mx-auto">
              &ldquo;Literature and history are the living memory of a civilization. At Idarah-i Adabiyat-i Dilli, our endeavor is to keep that memory vibrant, critical, and accessible for generations to come.&rdquo;
            </blockquote>
          </div>

        </div>

      </div>
    </div>
  );
}