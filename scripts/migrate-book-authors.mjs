#!/usr/bin/env node

/**
 * One-time Sanity migration: `book.author` (single reference) →
 * `book.authors` (ordered reference array).
 *
 * Safe properties:
 * - Dry-run is the default: it makes no changes.
 * - It never overwrites an existing non-empty `authors` array.
 * - It converts every old reference to a one-item array, then removes `author`.
 * - Re-running after a successful migration is a no-op.
 *
 * Required environment variables:
 *   NEXT_PUBLIC_SANITY_PROJECT_ID (or SANITY_PROJECT_ID)
 *   NEXT_PUBLIC_SANITY_DATASET (or SANITY_DATASET; defaults to production)
 *   SANITY_API_TOKEN  (Editor or Administrator token; never commit it)
 *
 * Usage:
 *   node scripts/migrate-book-authors.mjs
 *   node scripts/migrate-book-authors.mjs --apply
 */

import { createClient } from '@sanity/client';

const apply = process.argv.includes('--apply');
const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID || process.env.SANITY_PROJECT_ID || 'lvzmkv9e';
const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET || process.env.SANITY_DATASET || 'production';
const token = process.env.SANITY_API_TOKEN;

if (!token) {
  console.error('Missing SANITY_API_TOKEN. Create an Editor/Admin token in sanity.io/manage, export it for this command, and retry.');
  process.exit(1);
}

const client = createClient({
  projectId,
  dataset,
  apiVersion: '2024-03-01',
  token,
  useCdn: false,
});

const books = await client.fetch(`*[_type == "book"]{ _id, title, author, authors }`);
const migrate = books.filter(book =>
  book?.author?._ref && (!Array.isArray(book.authors) || book.authors.length === 0)
);
const alreadyDone = books.filter(book => Array.isArray(book?.authors) && book.authors.length > 0).length;
const needsReview = books.filter(book =>
  !book?.author?._ref && (!Array.isArray(book?.authors) || book.authors.length === 0)
);

console.log(`Dataset: ${projectId}/${dataset}`);
console.log(`Books found: ${books.length}`);
console.log(`Will migrate: ${migrate.length}`);
console.log(`Already use authors: ${alreadyDone}`);
console.log(`Need manual author assignment: ${needsReview.length}`);

if (needsReview.length) {
  console.log('\nBooks without either author field:');
  for (const book of needsReview) console.log(`- ${book.title || '(untitled)'} (${book._id})`);
}

if (!migrate.length) {
  console.log('\nNothing to migrate.');
  process.exit(0);
}

console.log('\nBooks to migrate:');
for (const book of migrate) console.log(`- ${book.title || '(untitled)'} (${book._id})`);

if (!apply) {
  console.log('\nDry run only — no documents were changed. Re-run with --apply after reviewing this list.');
  process.exit(0);
}

const transaction = client.transaction();
for (const book of migrate) {
  transaction.patch(book._id, patch => patch
    .set({ authors: [{ _type: 'reference', _ref: book.author._ref }] })
    .unset(['author'])
  );
}

const result = await transaction.commit();
console.log(`\nMigrated ${migrate.length} book(s). Transaction ID: ${result.transactionId}`);
console.log('Open Sanity Studio, add co-authors where needed, and publish the updated Studio/site.');
