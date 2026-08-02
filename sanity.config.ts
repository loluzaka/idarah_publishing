import { defineConfig } from 'sanity'
import { structureTool } from 'sanity/structure'
import { UserIcon, BookIcon, TagIcon, ClipboardIcon } from '@sanity/icons'
import { structure } from './sanity/structure'

// ==========================================================================
// 1. Author Schema Definition
// ==========================================================================
const authorType = {
  name: 'author',
  title: 'Authors & Contributors',
  type: 'document',
  icon: UserIcon,
  fields: [
    {
      name: 'name',
      title: 'Author Name',
      type: 'string',
      validation: (Rule: any) => Rule.required().error('An author name is required.'),
    },
    {
      name: 'slug',
      title: 'Slug',
      type: 'slug',
      options: {
        source: 'name',
        maxLength: 96,
      },
      validation: (Rule: any) => Rule.required(),
    },
    {
      name: 'qualifications',
      title: 'Qualifications / Role',
      type: 'string',
      description: 'e.g., Professor of History, Advocate General',
    },
    {
      name: 'biography',
      title: 'Brief Biography',
      type: 'text',
      description: 'A short overview of the author displayed on the primary card grid.',
    },
    {
      name: 'topics',
      title: 'Topics of Books (Genres/Expertise)',
      type: 'array',
      description: 'Tags representing what they write about (e.g., Urdu Literature, History)',
      of: [{ type: 'string' }],
      options: {
        layout: 'tags',
      },
    },
    {
      name: 'books',
      title: 'Linked Publications Reference Archive',
      type: 'array',
      description: 'Select the books this author has written.',
      of: [
        {
          type: 'reference',
          to: [{ type: 'book' }],
        },
      ],
    },
  ],
  preview: {
    select: {
      title: 'name',
      subtitle: 'qualifications',
    },
  },
}

// ==========================================================================
// 2. Book Schema Definition (Updated to Reference Type)
// ==========================================================================
const bookType = {
  name: 'book',
  title: 'Publications Archive',
  type: 'document',
  icon: BookIcon,
  fields: [
    {
      name: 'title',
      title: 'Book Title',
      type: 'string',
    },
    {
      name: 'author',
      title: 'Author / Translator',
      type: 'reference',
      to: [{ type: 'author' }],
      validation: (Rule: any) => Rule.required(),
      description: 'Link this book to an official Author Profile document card.',
    },
    {
      name: 'price',
      title: 'Price (₹)',
      type: 'number',
    },
    {
      name: 'originalPrice',
      title: 'Original Retail Price (INR)',
      type: 'number',
      description: 'Optional. If set and greater than the selling Price, the book is shown as on sale with a computed discount.',
      validation: (Rule: any) =>
        Rule.min(0)
          .error('Original price cannot be negative.')
          .custom((originalPrice: number | undefined, context: any) => {
            if (originalPrice === undefined || originalPrice === null) return true
            const price = context?.document?.price
            if (typeof price === 'number' && originalPrice < price) {
              return 'Original price must be greater than or equal to the current price.'
            }
            return true
          }),
    },
    {
      name: 'series',
      title: 'Series / Volume Note',
      type: 'string',
    },
    {
      name: 'description',
      title: 'Editorial Synopsis',
      type: 'text',
    },
    {
      name: 'publisher',
      title: 'Publisher',
      type: 'string',
    },
    {
      name: 'year',
      title: 'Release Year',
      type: 'string',
    },
    {
      name: 'binding',
      title: 'Format Binding',
      type: 'string',
    },
    {
      name: 'pages',
      title: 'Page Count',
      type: 'number',
    },
    {
      name: 'isbn',
      title: 'ISBN',
      type: 'string',
      description: 'International Standard Book Number (10 or 13 digits, hyphens optional). Leave empty for historical publications without an ISBN.',
      validation: (Rule: any) =>
        Rule.custom((val: string | undefined) => {
          if (!val) return true; // optional
          const digits = val.replace(/[-\s]/g, '');
          if (!/^\d{10}(\d{3})?$/.test(digits)) return 'Enter a valid 10-digit or 13-digit ISBN.';
          return true;
        }),
    },
    {
      name: 'weightGrams',
      title: 'Weight (grams)',
      type: 'number',
      description: 'Physical weight of one copy. Used to compute India Post Gyan Post shipping. Estimate for hardcovers: pages × 2g; paperbacks: pages × 1.5g.',
      validation: (Rule: any) => Rule.min(0).integer(),
    },
    {
      name: 'language',
      title: 'Language',
      type: 'string',
      description: 'Primary language of the publication.',
      options: {
        list: [
          { title: 'Urdu', value: 'Urdu' },
          { title: 'English', value: 'English' },
          { title: 'Hindi', value: 'Hindi' },
          { title: 'Arabic', value: 'Arabic' },
          { title: 'Persian (Farsi)', value: 'Persian' },
          { title: 'Bilingual — Urdu / English', value: 'Bilingual (Urdu/English)' },
          { title: 'Bilingual — Arabic / Urdu', value: 'Bilingual (Arabic/Urdu)' },
        ],
        layout: 'dropdown',
      },
    },
    {
      name: 'stock',
      title: 'Stock (Copies Available)',
      type: 'number',
      description: 'Number of copies currently in inventory. 0 = Out of Stock. 1-5 = shows "Only X Left". Leave blank to display "In Stock" by default. Managed manually.',
      initialValue: 10,
      validation: (Rule: any) => Rule.min(0).integer().error('Stock must be zero or a positive whole number.'),
    },
    {
      name: 'category',
      title: 'Category Link',
      type: 'reference',
      to: [{ type: 'category' }],
    },
    {
      name: 'categories',
      title: 'Categories',
      type: 'array',
      of: [{ type: 'reference', to: [{ type: 'category' }] }],
    },
    {
      name: 'coverPlaceholder',
      title: 'Cover Placeholder Text',
      type: 'string',
      description: 'Short text shown when no cover image is available (e.g. initials).',
    },
    {
      name: 'galleryImages',
      title: '⚠️ Gallery Images (Deprecated — move to "Contents & Preface Pages")',
      type: 'array',
      description: 'DEPRECATED. Copy these images into "Contents & Preface Pages" below, then delete them here.',
      of: [{ type: 'image', options: { hotspot: true } }],
    },
    {
      name: 'lookInsidePages',
      title: '⚠️ Look Inside Pages (Deprecated — move to "Look Inside — Sample Pages")',
      type: 'array',
      description: 'DEPRECATED. Copy these images into "Look Inside — Sample Pages" below, then delete them here.',
      of: [{ type: 'image', options: { hotspot: true } }],
    },
    {
      name: 'contentsImages',
      title: 'Contents & Preface Pages',
      type: 'array',
      description: 'Photos of the table of contents, preface, index, or any introductory pages. Shown in the "Showcase & Contents" tab of the Book Modal alongside the cover.',
      of: [{ type: 'image', options: { hotspot: true } }],
    },
    {
      name: 'previewImages',
      title: 'Look Inside — Sample Pages',
      type: 'array',
      description: 'Interior page scans for the "View Inside" reader. Customers can flip through these before purchasing. Upload in reading order.',
      of: [{ type: 'image', options: { hotspot: true } }],
    },
    {
      name: 'coverImage',
      title: 'Primary Cover Image',
      type: 'image',
      options: { hotspot: true },
      description: 'Main book cover. Recommended: 400 × 533 px (3:4 portrait). Used on all book cards, the modal, and the catalog.',
    },
    {
      name: 'homepageSlides',
      title: 'Homepage Promotional Slides',
      type: 'array',
      description: 'Optional. Each slide promotes this book on the personalized homepage carousel when the book is recommended to a user. Leave empty if this book has no promo slides.',
      of: [
        {
          type: 'object',
          name: 'homepageSlide',
          title: 'Homepage Slide',
          fields: [
            {
              name: 'image',
              title: 'Slide Image',
              type: 'image',
              options: { hotspot: true },
              description: 'Recommended dimensions: 1920 × 700 px (aspect ratio 2.74:1). Upload wide banner artwork.',
              validation: (Rule: any) => Rule.required().error('A slide image is required.'),
            },
            {
              name: 'heading',
              title: 'Heading',
              type: 'string',
              validation: (Rule: any) => Rule.required(),
            },
            {
              name: 'subheading',
              title: 'Subheading',
              type: 'text',
              rows: 2,
            },
            {
              name: 'buttonText',
              title: 'Button Text',
              type: 'string',
            },
            {
              name: 'buttonLink',
              title: 'Button Link',
              type: 'url',
              description: 'Optional. Full URL or internal path (e.g. /books).',
              validation: (Rule: any) =>
                Rule.uri({ allowRelative: true, scheme: ['http', 'https', 'mailto', 'tel'] }),
            },
            {
              name: 'priority',
              title: 'Priority',
              type: 'number',
              description: 'Slides with a lower number appear first. Ties fall back to Studio order.',
              initialValue: 100,
            },
          ],
          preview: {
            select: { title: 'heading', subtitle: 'subheading', media: 'image' },
          },
        },
      ],
    }
  ]
}

// ==========================================================================
// 3. Category Schema Definition
// ==========================================================================
const categoryType = {
  name: 'category',
  title: 'Category Tabs',
  type: 'document',
  icon: TagIcon,
  fields: [
    { name: 'title', title: 'Category Title', type: 'string' },
    { name: 'slug', title: 'Slug Identifier', type: 'slug', options: { source: 'title' } },
    {
      name: 'bannerImage',
      title: 'Theme Banner Image',
      type: 'image',
      options: { hotspot: true },
      description: 'Wide banner shown in the Catalogue page slideshow for this theme. Recommended: 1920 × 700 px (aspect ratio ~2.74:1).',
    },
  ]
}

// ==========================================================================
// 3a. Collection Schema Definition — curated shelves powered by Sanity
// ==========================================================================
const collectionType = {
  name: 'collection',
  title: 'Collections (Curated Shelves)',
  type: 'document',
  icon: TagIcon,
  fields: [
    {
      name: 'title',
      title: 'Collection Title',
      type: 'string',
      validation: (Rule: any) => Rule.required(),
    },
    {
      name: 'slug',
      title: 'Slug',
      type: 'slug',
      options: { source: 'title', maxLength: 96 },
      validation: (Rule: any) => Rule.required(),
    },
    {
      name: 'description',
      title: 'Description',
      type: 'text',
      rows: 3,
    },
    {
      name: 'bannerImage',
      title: 'Banner Image',
      type: 'image',
      options: { hotspot: true },
      description: 'Recommended: 1920 × 400 px. Shown at the top of the /collections/[slug] page.',
    },
    {
      name: 'thumbnailImage',
      title: 'Homepage Thumbnail (optional)',
      type: 'image',
      options: { hotspot: true },
      description: 'Optional square or landscape thumbnail for compact homepage widgets.',
    },
    {
      name: 'displayStyle',
      title: 'Display Style',
      type: 'string',
      description: 'Controls how this collection is rendered on the homepage.',
      options: {
        list: [
          { title: 'Carousel (horizontal scrolling row)', value: 'carousel' },
          { title: 'Grid (multi-column grid)', value: 'grid' },
          { title: 'Featured Banner (large promotional banner)', value: 'featured_banner' },
        ],
        layout: 'radio',
      },
      initialValue: 'carousel',
    },
    {
      name: 'featured',
      title: 'Show on Homepage',
      type: 'boolean',
      initialValue: false,
      description: 'Featured collections are automatically displayed on the homepage.',
    },
    {
      name: 'enabled',
      title: 'Enabled',
      type: 'boolean',
      initialValue: true,
      description: 'Disabled collections are hidden everywhere.',
    },
    {
      name: 'priority',
      title: 'Priority',
      type: 'number',
      initialValue: 100,
      description: 'Lower numbers appear first. Controls homepage and listing order.',
    },
    {
      name: 'books',
      title: 'Books in this Collection',
      type: 'array',
      of: [{ type: 'reference', to: [{ type: 'book' }] }],
      description: 'A single book may appear in multiple collections.',
    },
  ],
  preview: {
    select: { title: 'title', subtitle: 'description', media: 'thumbnailImage' },
  },
}

// ==========================================================================
// 3b. Bundle Schema Definition — group multiple books into a discounted set
// ==========================================================================
const bundleType = {
  name: 'bundle',
  title: 'Bundles & Sets',
  type: 'document',
  icon: BookIcon,
  fields: [
    { name: 'name', title: 'Bundle Name', type: 'string', validation: (Rule: any) => Rule.required() },
    { name: 'description', title: 'Description', type: 'text' },
    { name: 'coverImage', title: 'Bundle Cover Image', type: 'image', options: { hotspot: true } },
    {
      name: 'books',
      title: 'Books in this Bundle',
      type: 'array',
      of: [{ type: 'reference', to: [{ type: 'book' }] }],
      validation: (Rule: any) => Rule.min(2).error('A bundle must contain at least two books.'),
    },
    {
      name: 'discountType',
      title: 'Discount Type',
      type: 'string',
      options: {
        list: [
          { title: 'None (Just a Convenience Bundle)', value: 'none' },
          { title: 'Percentage Off', value: 'percentage' },
          { title: 'Fixed Amount Off', value: 'fixed' },
          { title: 'Set Final Price', value: 'final' },
        ],
        layout: 'radio',
      },
      initialValue: 'none',
    },
    {
      name: 'discountValue',
      title: 'Discount Value',
      type: 'number',
      description: 'Meaning depends on Discount Type: percent for percentage (0-100), rupees for fixed / final.',
      validation: (Rule: any) => Rule.min(0),
    },
    {
      name: 'active',
      title: 'Active',
      type: 'boolean',
      initialValue: true,
      description: 'Inactive bundles are hidden from the storefront.',
    },
    {
      name: 'priority',
      title: 'Priority',
      type: 'number',
      description: 'Lower numbers appear first.',
      initialValue: 100,
    },
  ],
  preview: {
    select: { title: 'name', subtitle: 'description', media: 'coverImage' },
  },
}

// ==========================================================================
// 4. Order Schema Definition
// ==========================================================================
const orderType = {
  name: 'order',
  title: 'Incoming Orders',
  type: 'document',
  icon: ClipboardIcon,
  fields: [
    { name: 'customerName', title: 'Customer Name', type: 'string' },
    { name: 'totalAmount', title: 'Total Amount', type: 'number' },
    { name: 'status', title: 'Status', type: 'string' }
  ]
}

// ==========================================================================
// Main Sanity Configuration Context Environment
// ==========================================================================
export default defineConfig({
  name: 'default',
  title: 'Idarah-i Adabiyat-i Dilli',

  projectId: 'lvzmkv9e',
  dataset: process.env.NEXT_PUBLIC_SANITY_DATASET || 'production',

  plugins: [
    structureTool({ structure })
  ],

  schema: {
    types: [authorType, bookType, categoryType, collectionType, bundleType, orderType],
  },
})
