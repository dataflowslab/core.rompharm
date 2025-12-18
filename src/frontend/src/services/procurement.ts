/**
 * Procurement API service
 * Centralized API calls for procurement module
 */
import { getModuleApiPrefix } from '../config/modules';

const API_PREFIX = getModuleApiPrefix('procurement');

export const procurementApi = {
  // Suppliers
  getSuppliers: () => `${API_PREFIX}/suppliers`,
  createSupplier: () => `${API_PREFIX}/suppliers`,
  
  // Purchase Orders
  getPurchaseOrders: () => `${API_PREFIX}/purchase-orders`,
  getPurchaseOrder: (id: string | number) => `${API_PREFIX}/purchase-orders/${id}`,
  createPurchaseOrder: () => `${API_PREFIX}/purchase-orders`,
  updateOrderStatus: (id: string | number) => `${API_PREFIX}/purchase-orders/${id}/status`,
  
  // Items
  getOrderItems: (orderId: string | number) => `${API_PREFIX}/purchase-orders/${orderId}/items`,
  addOrderItem: (orderId: string | number) => `${API_PREFIX}/purchase-orders/${orderId}/items`,
  updateOrderItem: (orderId: string | number, itemId: number) => `${API_PREFIX}/purchase-orders/${orderId}/items/${itemId}`,
  deleteOrderItem: (orderId: string | number, itemId: number) => `${API_PREFIX}/purchase-orders/${orderId}/items/${itemId}`,
  
  // Parts
  getParts: () => `${API_PREFIX}/parts`,
  
  // Stock Locations
  getStockLocations: () => `${API_PREFIX}/stock-locations`,
  
  // Currencies
  getCurrencies: () => `${API_PREFIX}/currencies`,
  
  // Attachments
  getAttachments: (orderId: string | number) => `${API_PREFIX}/purchase-orders/${orderId}/attachments`,
  uploadAttachment: (orderId: string | number) => `${API_PREFIX}/purchase-orders/${orderId}/attachments`,
  deleteAttachment: (orderId: string | number, attachmentId: number) => `${API_PREFIX}/purchase-orders/${orderId}/attachments/${attachmentId}`,
  
  // Stock Reception
  getReceivedItems: (orderId: string | number) => `${API_PREFIX}/purchase-orders/${orderId}/received-items`,
  receiveStock: (orderId: string | number) => `${API_PREFIX}/purchase-orders/${orderId}/receive-stock`,
  
  // Statuses
  getOrderStatuses: () => `${API_PREFIX}/order-statuses`,
};
