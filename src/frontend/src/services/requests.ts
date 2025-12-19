/**
 * Requests API service
 * Centralized API calls for requests module
 */

const API_PREFIX = '/modules/requests/api';

export const requestsApi = {
  // Requests
  getRequests: () => `${API_PREFIX}/`,
  getRequest: (id: string) => `${API_PREFIX}/${id}`,
  createRequest: () => `${API_PREFIX}/`,
  updateRequest: (id: string) => `${API_PREFIX}/${id}`,
  deleteRequest: (id: string) => `${API_PREFIX}/${id}`,
  
  // Stock Locations
  getStockLocations: () => `${API_PREFIX}/stock-locations`,
  
  // Parts
  getParts: () => `${API_PREFIX}/parts`,
  getPartStockInfo: (partId: number) => `${API_PREFIX}/parts/${partId}/stock-info`,
  getPartRecipe: (partId: number) => `${API_PREFIX}/parts/${partId}/recipe`,
  getPartBatchCodes: (partId: number) => `${API_PREFIX}/parts/${partId}/batch-codes`,
  getPartBom: (partId: number) => `${API_PREFIX}/parts/${partId}/bom`,
  
  // Approval Flow
  getApprovalFlow: (requestId: string) => `${API_PREFIX}/${requestId}/approval-flow`,
  createApprovalFlow: (requestId: string) => `${API_PREFIX}/${requestId}/approval-flow`,
  signRequest: (requestId: string) => `${API_PREFIX}/${requestId}/sign`,
  removeSignature: (requestId: string, userId: string) => `${API_PREFIX}/${requestId}/signatures/${userId}`,
};
