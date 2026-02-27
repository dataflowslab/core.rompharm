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
  issue_date?: string;
  target_date?: string;
  shipment_date?: string;
  notes?: string;
  total_price?: string;
  line_items?: number;
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

  // Add sales order item
  async addSalesOrderItem(orderId: string, payload: any) {
    const response = await api.post(`/api/sales/sales-orders/${orderId}/items`, payload);
    return response.data;
  },

  // Update sales order item
  async updateSalesOrderItem(orderId: string, itemId: string, payload: any) {
    const response = await api.put(`/api/sales/sales-orders/${orderId}/items/${itemId}`, payload);
    return response.data;
  },

  // Delete sales order item
  async deleteSalesOrderItem(orderId: string, itemId: string) {
    const response = await api.delete(`/api/sales/sales-orders/${orderId}/items/${itemId}`);
    return response.data;
  },

  // Get shipments
  async getShipments(orderId: string) {
    const response = await api.get(`/api/sales/sales-orders/${orderId}/shipments`);
    return response.data;
  },

  async createShipment(orderId: string, payload: any) {
    const response = await api.post(`/api/sales/sales-orders/${orderId}/shipments`, payload);
    return response.data;
  },

  async updateShipment(orderId: string, shipmentId: string, payload: any) {
    const response = await api.put(`/api/sales/sales-orders/${orderId}/shipments/${shipmentId}`, payload);
    return response.data;
  },

  async deleteShipment(orderId: string, shipmentId: string) {
    const response = await api.delete(`/api/sales/sales-orders/${orderId}/shipments/${shipmentId}`);
    return response.data;
  },

  async createAllocation(orderId: string, payload: any) {
    const response = await api.post(`/api/sales/sales-orders/${orderId}/allocations`, payload);
    return response.data;
  },

  async updateAllocation(orderId: string, allocationId: string, payload: any) {
    const response = await api.put(`/api/sales/sales-orders/${orderId}/allocations/${allocationId}`, payload);
    return response.data;
  },

  async deleteAllocation(orderId: string, allocationId: string) {
    const response = await api.delete(`/api/sales/sales-orders/${orderId}/allocations/${allocationId}`);
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
  async updateOrderStatus(orderId: string, status?: number, state_id?: string) {
    const payload: any = {};
    if (state_id) payload.state_id = state_id;
    if (status !== undefined) payload.status = status;
    const response = await api.patch(`/api/sales/sales-orders/${orderId}/status`, payload);
    return response.data;
  },

  // Get customers
  async getCustomers(search?: string) {
    const params = search ? { search } : {};
    const response = await api.get('/api/sales/customers', { params });
    return response.data;
  },

  // Approval flow helpers (generic approvals API)
  async getApprovalFlow(orderId: string) {
    const response = await api.get(`/api/approvals/flows/object/sales_order/${orderId}`);
    return response.data?.flow || null;
  },

  async createApprovalFlow(orderId: string, templateId: string) {
    const response = await api.post('/api/approvals/flows', {
      object_type: 'sales_order',
      object_source: 'depo_sales',
      object_id: orderId,
      template_id: templateId
    });
    return response.data;
  },

  async signApprovalFlow(flowId: string) {
    const response = await api.post(`/api/approvals/flows/${flowId}/sign`, {});
    return response.data;
  },
};
