/**
 * Procurement API service
 * Centralized API calls for procurement module
 */
import { getModuleApiPrefix } from '../config/modules';

const API_PREFIX = getModuleApiPrefix('procurement');

export const procurementApi = {
  // Suppliers - FROM INVENTORY MODULE
  getSuppliers: () => `/modules/inventory/api/suppliers`,
  createSupplier: () => `/modules/inventory/api/suppliers`,
  
  // Purchase Orders
  getPurchaseOrders: () => `${API_PREFIX}/purchase-orders`,
  getPurchaseOrder: (id: string | number) => `${API_PREFIX}/purchase-orders/${id}`,
  createPurchaseOrder: () => `${API_PREFIX}/purchase-orders`,
  updateOrderStatus: (id: string | number) => `${API_PREFIX}/purchase-orders/${id}/status`,
  
  // Items
  getOrderItems: (orderId: string | number) => `${API_PREFIX}/purchase-orders/${orderId}/items`,
  addOrderItem: (orderId: string | number) => `${API_PREFIX}/purchase-orders/${orderId}/items`,
  updateOrderItem: (orderId: string | number, itemId: string | number) => `${API_PREFIX}/purchase-orders/${orderId}/items/${itemId}`,
  deleteOrderItem: (orderId: string | number, itemId: string | number) => `${API_PREFIX}/purchase-orders/${orderId}/items/${itemId}`,
  
  // Parts - FROM INVENTORY MODULE
  getParts: () => `/modules/inventory/api/parts`,
  
  // Stock Locations - FROM INVENTORY MODULE
  getStockLocations: () => `/modules/inventory/api/locations`,
  
  // Currencies - FROM GLOBAL API
  getCurrencies: () => `/api/currencies`,
  
  // Attachments
  getAttachments: (orderId: string | number) => `${API_PREFIX}/purchase-orders/${orderId}/attachments`,
  uploadAttachment: (orderId: string | number) => `${API_PREFIX}/purchase-orders/${orderId}/attachments`,
  deleteAttachment: (orderId: string | number, attachmentId: string | number) => `${API_PREFIX}/purchase-orders/${orderId}/attachments/${attachmentId}`,
  
  // Stock Reception
  getReceivedItems: (orderId: string | number) => `${API_PREFIX}/purchase-orders/${orderId}/received-items`,
  receiveStock: (orderId: string | number) => `${API_PREFIX}/purchase-orders/${orderId}/receive-stock`,
  
  // Statuses
  getOrderStatuses: () => `${API_PREFIX}/order-statuses`,
  getStockStatuses: () => `${API_PREFIX}/stock-statuses`,
  
  // QC Records
  getQCRecords: (orderId: string | number) => `${API_PREFIX}/purchase-orders/${orderId}/qc-records`,
  createQCRecord: (orderId: string | number) => `${API_PREFIX}/purchase-orders/${orderId}/qc-records`,
  updateQCRecord: (orderId: string | number, recordId: string) => `${API_PREFIX}/purchase-orders/${orderId}/qc-records/${recordId}`,
};
