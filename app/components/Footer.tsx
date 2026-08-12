import React from "react";
import { BookOpen, Mail, Phone, MessageCircle } from "lucide-react";

const WHATSAPP_NUMBER = "919810173618";

const FOOTER_LINKS = [
  {
    heading: "Explore",
    links: [
      { label: "Catalogue", href: "/books" },
      { label: "Authors", href: "/authors" },
      { label: "Collections", href: "/collections" },
    ],
  },
  {
    heading: "About",
    links: [
      { label: "About Us", href: "/about" },
      { label: "Contact Us", href: "/contact" },
      { label: "How to Order", href: "/how-to-order" },
      { label: "Publish With Us", href: "/publish-with-us" },
    ],
  },
  {
    heading: "Account",
    links: [
      { label: "My Profile", href: "/profile" },
      { label: "Cart", href: "/cart" },
      { label: "Sign In", href: "/login" },
    ],
  },
];

export default function Footer() {
  return (
    <footer className="bg-[#1A1A1A] text-[#FBFBFA] mt-auto">
      <div className="max-w-7xl mx-auto px-6 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10">
          {/* Brand block */}
          <div className="md:col-span-1">
            <h2
              style={{
                fontFamily:
                  "var(--font-playfair), 'Playfair Display', Georgia, serif",
              }}
              className="text-xl font-bold tracking-wider uppercase mb-3"
            >
              Idarah-i Adabiyat-i Dilli
            </h2>
            <p className="text-[10px] uppercase tracking-[0.2em] text-[#7D5A34] font-bold mb-4">
              Associated with Jayyad Press
            </p>
            <p className="text-xs text-[#FBFBFA]/60 leading-relaxed font-sans">
              A premium publishing house specialising in Islamic Studies, Urdu
              Literature, Arabic Literature, History, Biography, and
              Children&apos;s Books.
            </p>
            <div className="flex items-center gap-3 mt-5">
              <a
                href="mailto:contact@idarah.com"
                aria-label="Email us"
                className="w-9 h-9 rounded-full border border-[#FBFBFA]/20 flex items-center justify-center hover:bg-[#7D5A34] hover:border-[#7D5A34] transition-colors"
              >
                <Mail className="w-4 h-4" strokeWidth={1.5} />
              </a>
              <a
                href="tel:+919810173618"
                aria-label="Call us"
                className="w-9 h-9 rounded-full border border-[#FBFBFA]/20 flex items-center justify-center hover:bg-[#7D5A34] hover:border-[#7D5A34] transition-colors"
              >
                <Phone className="w-4 h-4" strokeWidth={1.5} />
              </a>
              <a
                href={`https://api.whatsapp.com/send?phone=${WHATSAPP_NUMBER}`}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="WhatsApp us"
                className="w-9 h-9 rounded-full border border-[#FBFBFA]/20 flex items-center justify-center hover:bg-[#7D5A34] hover:border-[#7D5A34] transition-colors"
              >
                <MessageCircle className="w-4 h-4" strokeWidth={1.5} />
              </a>
            </div>
          </div>

          {/* Link columns */}
          {FOOTER_LINKS.map((col) => (
            <div key={col.heading}>
              <h3 className="font-sans text-[10px] uppercase tracking-[0.2em] font-bold text-[#7D5A34] mb-4 flex items-center gap-1.5">
                <BookOpen className="w-3 h-3" strokeWidth={2} />
                {col.heading}
              </h3>
              <ul className="space-y-2.5">
                {col.links.map((link) => (
                  <li key={link.href}>
                    <a
                      href={link.href}
                      className="text-xs font-sans text-[#FBFBFA]/70 hover:text-[#FBFBFA] transition-colors"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom bar — credits + copyright */}
        <div className="mt-12 pt-6 border-t border-[#FBFBFA]/10 flex flex-col md:flex-row items-center justify-between gap-3">
          <p className="text-[10px] font-sans text-[#FBFBFA]/50 tracking-wide">
            &copy; {new Date().getFullYear()} Idarah-i Adabiyat-i Dilli. All
            rights reserved.
          </p>
          <p className="text-[10px] font-sans text-[#FBFBFA]/40 tracking-wide italic">
            vibecodih with luv on{" "}
            <span className="text-[#7D5A34] font-bold not-italic">
              RUNNER AI
            </span>{" "}  by{" "}
            <span className="text-[#7D5A34] font-semibold not-italic">
              Omar Nixton
            </span>{" "}
            🖤
          </p>
        </div>
      </div>
    </footer>
  );
}
