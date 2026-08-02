import { defineType } from 'sanity';

export default defineType({
  name: 'order',
  title: 'Customer Orders',
  type: 'document',
  fields: [
    { name: 'orderId', title: 'Order Reference ID', type: 'string', readOnly: true },
    {
      name: 'status',
      title: 'Order Status',
      type: 'string',
      options: {
        list: [
          { title: 'Pending WhatsApp Sync', value: 'pending_sync' },
          { title: 'Confirmed / Awaiting Weight Calc', value: 'confirmed' },
          { title: 'Dispatched via India Post', value: 'dispatched' },
          { title: 'Completed / Delivered', value: 'completed' },
          { title: 'Cancelled', value: 'cancelled' },
        ],
      },
      initialValue: 'pending_sync',
    },
    { name: 'customerName', title: 'Customer Name', type: 'string' },
    { name: 'customerPhone', title: 'Customer Phone', type: 'string' },
    { name: 'customerEmail', title: 'Customer Email', type: 'string' },
    { name: 'deliveryAddress', title: 'Delivery Address', type: 'text' },
    { name: 'trackingNumber', title: 'India Post Tracking Number', type: 'string' },
    {
      name: 'items',
      title: 'Ordered Volumes',
      type: 'array',
      of: [
        {
          type: 'object',
          fields: [
            { name: 'book', title: 'Book Reference', type: 'reference', to: [{ type: 'book' }] },
            { name: 'quantity', title: 'Quantity Ordered', type: 'number' },
            { name: 'pricePaid', title: 'Price (Per Unit)', type: 'number' },
          ],
        },
      ],
    },
    { name: 'totalAmount', title: 'Total Invoice Price (INR)', type: 'number' },
    { name: 'userId', title: 'Customer User ID (Firebase UID)', type: 'string', readOnly: true },
  ],
});
