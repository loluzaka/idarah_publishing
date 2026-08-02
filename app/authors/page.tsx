"use client";

import React, { useState, useEffect } from "react";
import { createClient } from "next-sanity";

// Configure your Sanity client
const client = createClient({
  projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID || "your_project_id",
  dataset: process.env.NEXT_PUBLIC_SANITY_DATASET || "production",
  apiVersion: "2024-01-01",
  useCdn: true,
});

interface BookRef {
  _id: string;
  title: string;
}

interface Author {
  _id: string;
  name: string;
  slug?: { current: string };
  qualifications?: string;
  biography?: string;
  topics?: string[];
  books?: BookRef[];
}

export default function AuthorsPage() {
  const [authors, setAuthors] = useState<Author[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedLetter, setSelectedLetter] = useState<string | null>(null);
  
  // State to manage the open modal profile view
  const [activeAuthor, setActiveAuthor] = useState<Author | null>(null);

  useEffect(() => {
    const fetchAuthors = async () => {
      // GROQ query updated to pull all 6 exact fields explicitly
      const data = await client.fetch(`
        *[_type == "author"] | order(name asc) {
          _id,
          name,
          slug,
          qualifications,
          biography,
          topics,
          "books": *[_type == "book" && author._ref == ^._id] {
            _id,
            title
          }
        }
      `);
      setAuthors(data);
    };
    fetchAuthors();
  }, []);

  // Filter logic for Search and A-Z Filter Strip
  const filteredAuthors = authors.filter((author) => {
    const matchesSearch = author.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesLetter = selectedLetter 
      ? author.name.trim().toUpperCase().startsWith(selectedLetter) 
      : true;
    return matchesSearch && matchesLetter;
  });

  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

  return (
    <div className="max-w-7xl mx-auto px-6 py-12 bg-gray-50 min-h-screen relative">
      <h1 className="text-4xl font-bold text-center mb-8 text-gray-800">All Authors</h1>

      {/* Search Input Bar */}
      <div className="max-w-md mx-auto mb-6 relative">
        <input
          type="text"
          placeholder="Search Authors"
          className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-amber-800 text-gray-700 bg-white"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {/* A-Z Alphabet Filter Strip */}
      <div className="flex flex-wrap justify-center gap-2 mb-12 border-b border-gray-200 pb-4">
        <button
          onClick={() => setSelectedLetter(null)}
          className={`px-2 py-1 text-sm font-semibold rounded ${!selectedLetter ? "bg-amber-800 text-white" : "text-gray-600 hover:text-amber-800"}`}
        >
          ALL
        </button>
        {alphabet.map((letter) => (
          <button
            key={letter}
            onClick={() => setSelectedLetter(letter)}
            className={`px-2 py-1 text-sm font-semibold rounded ${selectedLetter === letter ? "bg-amber-800 text-white" : "text-gray-600 hover:text-amber-800"}`}
          >
            {letter}
          </button>
        ))}
      </div>

      {/* Grid Layout Container */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {filteredAuthors.map((author) => (
          <div 
            key={author._id} 
            className="bg-white p-6 rounded-lg shadow-sm border border-gray-100 flex flex-col justify-between transition-all hover:shadow-md cursor-pointer hover:-translate-y-0.5 transform duration-200"
            onClick={() => setActiveAuthor(author)} // Opens the modal layout overlay
          >
            <div>
              {/* 1. Name */}
              <h2 className="text-2xl font-serif font-bold text-gray-900 mb-2">{author.name}</h2>
              
              {/* 3. Qualifications / Role */}
              {author.qualifications && (
                <p className="text-sm font-medium text-amber-900 mb-3 italic">{author.qualifications}</p>
              )}
              
              {/* 4. Brief Biography */}
              <p className="text-gray-600 text-sm leading-relaxed mb-4 line-clamp-3">
                {author.biography || "Biography pending configuration."}
              </p>
            </div>

            {/* 5. Topic of books tags preview */}
            {author.topics && author.topics.length > 0 && (
              <div className="mt-2 text-xs text-gray-500 line-clamp-1">
                <span className="font-semibold text-gray-700">Topics:</span> {author.topics.join(", ")}
              </div>
            )}

            <div className="mt-4 pt-4 border-t border-gray-100 text-xs text-amber-800 font-semibold uppercase tracking-wider text-center">
              View Full Profile & Bibliography
            </div>
          </div>
        ))}
      </div>
      
      {filteredAuthors.length === 0 && (
        <p className="text-center text-gray-500 mt-12">No authors match your current filter parameters.</p>
      )}

      {/* ==========================================================================
         AUTHOR DETAILED OVERLAY MODAL COMPONENT
         ========================================================================== */}
      {activeAuthor && (
        <div 
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 transition-opacity duration-200"
          onClick={() => setActiveAuthor(null)} 
        >
          <div 
            className="bg-white w-full max-w-2xl rounded-xl shadow-2xl border border-gray-100 overflow-hidden relative flex flex-col max-h-[85vh] animate-in fade-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()} 
          >
            {/* Header Area (Name & Qualifications) */}
            <div className="p-6 border-b border-gray-100 sticky top-0 bg-white z-10">
              <button 
                className="absolute top-4 right-4 text-gray-400 hover:text-gray-700 text-2xl font-semibold w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors"
                onClick={() => setActiveAuthor(null)}
              >
                &times;
              </button>
              {/* 1. Name */}
              <h2 className="text-3xl font-serif font-bold text-gray-900 pr-8">{activeAuthor.name}</h2>
              
              {/* 3. Qualifications / Role */}
              {activeAuthor.qualifications && (
                <p className="text-md font-medium text-amber-900 mt-1 italic">{activeAuthor.qualifications}</p>
              )}
            </div>

            {/* Scrollable Content Body Area */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1">
              
              {/* 4. Brief Biography */}
              <div>
                <h3 className="text-xs font-semibold uppercase text-gray-400 tracking-wider mb-2">Brief Biography</h3>
                <p className="text-gray-700 text-base leading-relaxed whitespace-pre-line">
                  {activeAuthor.biography || "Detailed biography records pending update configuration."}
                </p>
              </div>

              {/* 5. Topic of Books */}
              {activeAuthor.topics && activeAuthor.topics.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold uppercase text-gray-400 tracking-wider mb-2">Topic of Books</h3>
                  <div className="flex flex-wrap gap-2">
                    {activeAuthor.topics.map((topic, index) => (
                      <span 
                        key={index} 
                        className="px-2.5 py-1 text-xs font-medium bg-amber-50 text-amber-900 rounded-md border border-amber-100"
                      >
                        {topic}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* 6. Link to Books (Dynamic Reverse Lookup List) */}
              <div>
                <h3 className="text-xs font-semibold uppercase text-gray-400 tracking-wider mb-3 border-b border-gray-100 pb-1">Link to Books</h3>
                {activeAuthor.books && activeAuthor.books.length > 0 ? (
                  <ul className="space-y-2.5">
                    {activeAuthor.books.map((book) => (
                      <li key={book._id} className="flex items-center gap-2 group">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-700 shrink-0"></span>
                        <a 
                          href={`/books/${book._id}`} 
                          className="text-gray-800 font-medium text-base hover:text-amber-800 hover:underline transition-colors"
                        >
                          {book.title}
                        </a>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-gray-400 italic">No publications currently linked to this profile.</p>
                )}
              </div>
            </div>
            
            {/* Footer Control Area */}
            <div className="p-4 bg-gray-50 border-t border-gray-100 flex justify-end sticky bottom-0">
              <button 
                className="px-5 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors shadow-sm"
                onClick={() => setActiveAuthor(null)}
              >
                Close Profile
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}