import { api } from './api';

export interface ReturnOrderItem {
  _id: string;
  order_item_id?: string;
  part_id: string;
  part?: string;
  part_detail?: {
    name?: string;
    ipn?: string;
    IPN?: string;
    um?: string;
    manufacturer_um?: string;
    lotallexp?: boolean;
  };
  quantity: number;
  received?: number;
  sale_price?: number;
  sale_price_currency?: string;
  notes?: string;
}

export interface ReturnOrder {
  _id: string;
  reference: string;
  sales_order_id?: string;
  sales_order_reference?: string;
  customer_id?: string;
  customer_detail?: {
    _id: string;
    name: string;
  };
  currency?: string;
  issue_date?: string;
  notes?: string;
  state_id?: string;
  state_detail?: {
    name: string;
    color: string;
    value: number;
  };
  status?: number | string;
  status_text?: string;
  line_items?: number;
  lines?: number;
  items?: ReturnOrderItem[];
  created_at?: string;
  created_by?: string;
}

export interface StockLocation {
  _id: string;
  name: string;
  description?: string;
}

export interface ApprovalFlow {
  _id: string;
  signatures: Array<{
    user_id: string;
    username: string;
    user_name?: string;
    signed_at: string;
    signature_hash: string;
  }>;
  status: string;
  required_officers?: any[];
  optional_officers?: any[];
  min_signatures?: number;
}

export interface Attachment {
  _id: string;
  attachment: string;
  filename: string;
  comment: string;
  upload_date?: string;
}

export const returnsApi = {
  getReturnOrders: () => '/api/returns',
  getReturnOrder: (id: string) => `/api/returns/${id}`,
  updateReturnOrder: (id: string) => `/api/returns/${id}`,
  getOrderItems: (id: string) => `/api/returns/${id}/items`,
  receiveStock: (id: string) => `/api/returns/${id}/receive-stock`,
  getReceivedItems: (id: string) => `/api/returns/${id}/received-items`,
  deleteStockItem: (stockId: string) => `/api/returns/stock-items/${stockId}`,
  getAttachments: (id: string) => `/api/returns/${id}/attachments`,
  uploadAttachment: (id: string) => `/api/returns/${id}/attachments`,
  deleteAttachment: (id: string, attachmentId: string) => `/api/returns/${id}/attachments/${attachmentId}`,
  getApprovalFlow: (id: string) => `/api/returns/${id}/approval-flow`,
  createApprovalFlow: (id: string) => `/api/returns/${id}/approval-flow`,
  signReturnOrder: (id: string) => `/api/returns/${id}/sign`,
  removeSignature: (id: string, userId: string) => `/api/returns/${id}/signatures/${userId}`,
  getOrderStatuses: () => '/api/returns/order-statuses',
  getStockStatuses: () => '/api/returns/stock-statuses',
  getJournal: (id: string) => `/api/returns/${id}/journal`,
  getStockLocations: () => '/modules/inventory/api/locations'
};

export const returnsService = {
  async getReturnOrders(params?: Record<string, string>) {
    const response = await api.get(returnsApi.getReturnOrders(), params ? { params } : undefined);
    return response.data;
  },
  async getReturnOrder(id: string) {
    const response = await api.get(returnsApi.getReturnOrder(id));
    return response.data;
  },
  async getOrderItems(id: string) {
    const response = await api.get(returnsApi.getOrderItems(id));
    return response.data;
  },
  async getOrderStatuses() {
    const response = await api.get(returnsApi.getOrderStatuses());
    return response.data;
  },
  async getStockStatuses() {
    const response = await api.get(returnsApi.getStockStatuses());
    return response.data;
  },
  async getApprovalFlow(id: string) {
    const response = await api.get(returnsApi.getApprovalFlow(id));
    return response.data;
  },
  async createApprovalFlow(id: string) {
    const response = await api.post(returnsApi.createApprovalFlow(id));
    return response.data;
  },
  async signReturnOrder(id: string, action: 'issue' | 'cancel') {
    const response = await api.post(returnsApi.signReturnOrder(id), { action });
    return response.data;
  },
  async removeSignature(id: string, userId: string) {
    const response = await api.delete(returnsApi.removeSignature(id, userId));
    return response.data;
  }
};
