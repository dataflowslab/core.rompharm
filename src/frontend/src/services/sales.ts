import { api } from './api';

export interface SalesOrder {
  _id: string;
  reference: string;
  customer: string;
  customer_detail?: {
    _id: string;
    name: string;
  };
  status: number;
  status_text?: string;
  description?: string;
  creation_date?: string;
  target_date?: string;
  shipment_date?: string;
  notes?: string;
  total_price?: string;
}

export interface SalesOrderItem {
  _id: string;
  order: string;
  part: string;
  part_detail?: {
    _id: string;
    name: string;
    IPN?: string;
    description?: string;
  };
  quantity: number;
  allocated: number;
  shipped: number;
  sale_price?: string;
  sale_price_currency?: string;
  reference?: string;
  notes?: string;
}

export interface Shipment {
  _id: string;
  order: string;
  reference?: string;
  tracking_number?: string;
  shipment_date?: string;
  delivery_date?: string;
  notes?: string;
}

export const salesService = {
  // Get all sales orders
  async getSalesOrders(params?: Record<string, string>) {
    const response = await api.get('/api/sales/sales-orders', params ? { params } : undefined);
    return response.data;
  },

  // Get single sales order
  async getSalesOrder(orderId: string) {
    const response = await api.get(`/api/sales/sales-orders/${orderId}`);
    return response.data;
  },

  // Get sales order items
  async getSalesOrderItems(orderId: string) {
    const response = await api.get(`/api/sales/sales-orders/${orderId}/items`);
    return response.data;
  },

  // Get shipments
  async getShipments(orderId: string) {
    const response = await api.get(`/api/sales/sales-orders/${orderId}/shipments`);
    return response.data;
  },

  // Get attachments
  async getAttachments(orderId: string) {
    const response = await api.get(`/api/sales/sales-orders/${orderId}/attachments`);
    return response.data;
  },

  // Get order statuses
  async getOrderStatuses() {
    const response = await api.get('/api/sales/order-statuses');
    return response.data;
  },

  // Update order status
  async updateOrderStatus(orderId: string, status: number) {
    const response = await api.patch(`/api/sales/sales-orders/${orderId}/status`, { status });
    return response.data;
  },

  // Get customers
  async getCustomers(search?: string) {
    const params = search ? { search } : {};
    const response = await api.get('/api/sales/customers', { params });
    return response.data;
  },
};
