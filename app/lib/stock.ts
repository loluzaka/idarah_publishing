// Derive customer-facing stock status from a numeric `stock` field.

export type StockStatus = 'in_stock' | 'low_stock' | 'out_of_stock' | 'unknown';

const LOW_STOCK_THRESHOLD = 5;

export function getStockStatus(stock: number | null | undefined): StockStatus {
  if (stock == null || !Number.isFinite(stock)) return 'unknown';
  if (stock <= 0) return 'out_of_stock';
  if (stock <= LOW_STOCK_THRESHOLD) return 'low_stock';
  return 'in_stock';
}

export function stockLabel(stock: number | null | undefined): string {
  const status = getStockStatus(stock);
  switch (status) {
    case 'in_stock': return 'In Stock';
    case 'low_stock': return `Only ${stock} Left`;
    case 'out_of_stock': return 'Out of Stock';
    default: return 'In Stock'; // legacy books without a stock field default to In Stock
  }
}

/** True when the book can be added to cart / purchased. */
export function isPurchasable(stock: number | null | undefined): boolean {
  return getStockStatus(stock) !== 'out_of_stock';
}
