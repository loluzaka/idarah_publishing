# SEO strategy — Idarah-e-Adabiyat-e-Delhi (idarahbooks.in)

How the keyword matrix is wired into the site, and the editorial plan for the `/articles` journal.

## 1. Keyword matrix (single source: `app/lib/seo.ts`)

| Group | Terms | Where it appears |
|---|---|---|
| Primary brand (`BRAND_PRIMARY`) | Idarah-e-Adabiyat-e-Delhi · Idara Adabiyat Delhi · Idara e Adabiyat · Idarah Books | Home `<title>`/H1, every page title suffix, meta keywords, `Organization.alternateName` |
| Variants / typos (`BRAND_VARIANTS`) | Idara Adabiyat · Idara Adabiyat E Delhi · Idarah Adabiyat · Idara-e-Adabiyat · Idara Adabiyath · Dilli / Delli spellings | meta keywords, `Organization.alternateName`, footer "Also known as" line |
| Vernacular (`BRAND_VERNACULAR`) | ادارہ ادبیات دہلی · ادارہ ادبیات · इदारे अदबियात दिल्ली · इदारा अदबियात | meta keywords, `Organization.alternateName`, visible in the footer with `lang="ur"` / `lang="hi"` |
| Intent (`INTENT_KEYWORDS`) | Urdu bookstore online India · buy classical Urdu literature books · Persian manuscripts India · Ghalib rare books · Islamic history books online · Urdu academic publications Delhi | meta keywords on every page; page-specific subsets on `/`, `/books`, `/articles` |

How it works:

- **Title template** (`app/layout.tsx`): `%s | Idara Adabiyat Delhi (Idarah Books)` — a book page becomes
  `The Life and Times of … by Khaliq Ahmad Nizami | Idara Adabiyat Delhi (Idarah Books)`.
  The home page uses an explicit title containing the primary brand spelling.
- **`buildMetadata()`** returns `title`, `description`, `keywords` (page-specific first, brand/intent after),
  `alternates.canonical`, `openGraph`, `twitter`, `robots`.
- **Visible copy matters more than `<meta keywords>`** (Google ignores that tag; Bing barely reads it). The
  variants are therefore also in visible text: the footer line, the home page `<h1>`, and the Organization JSON-LD.
  When writing articles, use the variants naturally in the intro and one H2.
- Spelling note: the site's own brand is "Idarah-i Adabiyat-i Dilli". Pick one spelling for the logo/header and keep
  the rest as variants — consistency of the *primary* name matters for entity recognition.

## 2. Structured data (`components/seo/SchemaOrg.tsx`)

| Schema | Rendered on |
|---|---|
| `Organization` (with `alternateName[]`) + `WebSite` (with sitelinks search → `/books?q=`) | every page (root layout) |
| `Book` + `Offer` + `BreadcrumbList` | `/books/[id]` |
| `Article` + `BreadcrumbList` + `FAQPage` | `/articles/[slug]` |
| `BreadcrumbList` | `/articles` |

Validate after deploy with Google's Rich Results Test and Search Console → Enhancements.

## 3. Sitemap / robots

- `app/sitemap.ts` — static routes + every book, enabled collection and published article from Sanity. Cached
  (`revalidate = 3600`); one failing Sanity query drops only its section.
- `app/robots.ts` — blocks `/api/`, `/admin`, `/profile`, `/checkout`, `/login`, `/cart`, `/stud10` (the real Studio
  route) and points to the sitemap. **Submit `https://idarahbooks.in/sitemap.xml` in Google Search Console and Bing
  Webmaster Tools.**

## 4. Article plan (`/articles`, authored in Sanity Studio → "Articles (Journal)")

Per article: 1,200–1,800 words, H2 every ~250 words, 3+ internal links to book pages (use the *Link to a book*
annotation and the **Related Books** field), 4–6 FAQ items with 40–60-word answers, a main image with alt text.

### 1. A Guide to Classical Urdu Literature and Rare Manuscripts in Delhi
- **Primary keyword:** classical Urdu literature Delhi · **Secondary:** rare Urdu manuscripts Delhi, Urdu bookstore online India, Idara Adabiyat Delhi
- **Outline**
  - H2 Why Delhi is the home of classical Urdu (Dilli school, Mir, Zauq, Ghalib)
  - H2 The major genres: ghazal, masnavi, marsiya, dastan, tazkira
  - H2 Manuscripts vs. printed critical editions — what to look for
  - H2 Where to find and how to authenticate rare Urdu books and manuscripts in Delhi
  - H2 Ten essential titles to start with *(each links to a product page)*
  - H2 How Idara Adabiyat Delhi sources and publishes classical texts
  - FAQ: What is the oldest Urdu text in print? · Where can I buy classical Urdu books online in India? · How do I tell a critical edition from a reprint?

### 2. Top Recommended Books on South Asian History and Poetry
- **Primary:** South Asian history books · **Secondary:** Urdu poetry books to read, Islamic history books online, Ghalib rare books
- **Outline**
  - H2 How to read South Asian history through its poetry
  - H2 Essential history titles (Mughal Delhi, 1857, Sufi orders, partition)
  - H2 Essential poetry titles (Mir, Ghalib, Iqbal, Faiz, Josh)
  - H2 Translations vs. originals: choosing an edition
  - H2 A reading order for beginners / for students / for collectors
  - FAQ: Which Ghalib edition is best for a first read? · Are there Urdu poetry books with English translation?

### 3. Understanding the Legacy of Idara Adabiyat Delhi in Preserving Heritage
- **Primary:** Idara Adabiyat Delhi · **Secondary:** Idarah-e-Adabiyat-e-Delhi history, Urdu publisher Delhi, ادارہ ادبیات دہلی, इदारे अदबियात दिल्ली
- **Outline**
  - H2 Who we are — Idara Adabiyat Delhi (also spelled Idarah-e-Adabiyat-e-Delhi / Idara-e-Adabiyat) *(state every spelling once, naturally)*
  - H2 The founding vision and the scholars behind it
  - H2 Landmark publications and the authors we published
  - H2 Preserving texts: editing, typesetting and reprinting classical Urdu
  - H2 Where to buy our books today
  - FAQ: What is Idara Adabiyat Delhi? · Is Idara Adabiyat the same as Idarah-e-Adabiyat-e-Delhi? · Does Idarah Books ship internationally?

### 4. How to Buy Urdu, Persian and Arabic Books Online in India (and Ship Abroad)
- **Primary:** Urdu bookstore online India · **Secondary:** buy Urdu books online, Persian books India, Arabic books India, international shipping Urdu books
- **Outline**
  - H2 What to check before buying a classical text (edition, editor, binding, language)
  - H2 Payment and delivery in India (India Post Gyan Post tiers, delivery windows)
  - H2 Ordering from outside India
  - H2 Bulk, library and institutional orders
  - H2 Our recommended starter shelf *(product links)*
  - FAQ: How long does delivery take? · Can I order Urdu books from the USA/UK? · Do you sell rare or out-of-print titles?

### 5. Ghalib: Which Editions to Read, Collect and Gift
- **Primary:** Ghalib books · **Secondary:** Ghalib rare books, Diwan-e-Ghalib edition, Ghalib letters, Urdu poetry gift books
- **Outline**
  - H2 The Diwan: the principal editions and how they differ
  - H2 Ghalib's letters (*Khutoot*) and why they matter
  - H2 Commentaries (sharah) — which to choose
  - H2 Collector's notes: first editions, bindings, calligraphy editions
  - H2 Gifting guide *(product links)*
  - FAQ: Which is the most authentic Diwan-e-Ghalib? · What is the best Ghalib book for beginners?

### Publishing cadence & internal-linking rules
- 2 articles/month, each updated yearly (the `dateModified` is emitted automatically).
- Every article links to ≥3 book pages; every featured book links back via the "Read more about this book" block
  on its product page (automatic, from the *Related Books* field).
- Cross-link the 5 articles to each other (pillar: article 1; supports: 2, 4, 5; brand page: 3).

## 5. Things to do outside the code
1. Add the sitemap in Google Search Console + Bing Webmaster Tools and request indexing for the home page.
2. Create/claim a Google Business Profile (Delhi address, phone) and add its URL, plus any social profiles, to
   `sameAs` in `organizationJsonLd()`.
3. Set one primary brand spelling and use it for the logo, social handles and directory listings.
4. Get listings/backlinks from Urdu literature societies, university departments and library directories.
5. Give books friendly URLs (`/books/<title-slug>`): add a `slug` field to the book schema, then change the route
   param. Titles in URLs help CTR; the current URLs use the Sanity document id.
