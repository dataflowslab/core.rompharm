import { api } from './api';

export interface SalesOrder {
  pk: number;
  reference: string;
  customer: number;
  customer_detail?: {
    pk: number;
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
  pk: number;
  order: number;
  part: number;
  part_detail?: {
    pk: number;
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
  pk: number;
  order: number;
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
  async getSalesOrder(orderId: number) {
    const response = await api.get(`/api/sales/sales-orders/${orderId}`);
    return response.data;
  },

  // Get sales order items
  async getSalesOrderItems(orderId: number) {
    const response = await api.get(`/api/sales/sales-orders/${orderId}/items`);
    return response.data;
  },

  // Get shipments
  async getShipments(orderId: number) {
    const response = await api.get(`/api/sales/sales-orders/${orderId}/shipments`);
    return response.data;
  },

  // Get attachments
  async getAttachments(orderId: number) {
    const response = await api.get(`/api/sales/sales-orders/${orderId}/attachments`);
    return response.data;
  },

  // Get order statuses
  async getOrderStatuses() {
    const response = await api.get('/api/sales/order-statuses');
    return response.data;
  },

  // Update order status
  async updateOrderStatus(orderId: number, status: number) {
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
