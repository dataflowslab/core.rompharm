type ApprovalLike = {
  object_type: string;
  object_id: string;
};

const APPROVAL_TYPE_LABELS: Record<string, string> = {
  purchase_request: 'Requests',
  stock_request: 'Requests',
  stock_request_operations: 'Stocks',
  stock_request_reception: 'Stocks',
  stock_request_production: 'Stocks',
  stock_request_production_series: 'Stocks',
  stock_qc: 'Stocks',
  build_order_production: 'Stocks',
  build_order_production_series: 'Stocks',
  sales_order: 'Sales',
  return_order: 'Sales',
  procurement_order: 'Purchase',
  purchase_order: 'Purchase',
};

const STOCK_REQUEST_TABS: Record<string, string> = {
  stock_request: 'approval',
  stock_request_operations: 'operations',
  stock_request_reception: 'reception',
  stock_request_production: 'production',
  stock_request_production_series: 'production',
};

const BUILD_ORDER_TABS: Record<string, string> = {
  build_order_production: 'production',
  build_order_production_series: 'production',
};

const splitSeriesObjectId = (value: string) => {
  const raw = String(value || '');
  if (raw.includes(':')) {
    const [baseId, batch] = raw.split(':', 2);
    return { baseId, batch };
  }
  return { baseId: raw, batch: '' };
};

export const getApprovalTypeLabelKey = (objectType: string) => {
  return APPROVAL_TYPE_LABELS[objectType] || objectType;
};

export const getApprovalRoute = (approval: ApprovalLike) => {
  const objectType = approval.object_type;
  const rawId = String(approval.object_id || '');

  if (objectType === 'procurement_order' || objectType === 'purchase_order') {
    return rawId ? `/procurement/${rawId}` : null;
  }

  if (objectType === 'sales_order') {
    return rawId ? `/sales/${rawId}` : null;
  }

  if (objectType === 'return_order') {
    return rawId ? `/returns/${rawId}` : null;
  }

  if (objectType === 'purchase_request' || objectType === 'stock_request') {
    const query = new URLSearchParams({ tab: 'approval' });
    return rawId ? `/requests/${rawId}?${query.toString()}` : null;
  }

  if (objectType.startsWith('stock_request_')) {
    const { baseId, batch } = splitSeriesObjectId(rawId);
    const tab = STOCK_REQUEST_TABS[objectType] || 'details';
    const query = new URLSearchParams({ tab });
    if (batch) {
      query.set('batch', batch);
    }
    return baseId ? `/requests/${baseId}?${query.toString()}` : null;
  }

  if (objectType === 'stock_qc') {
    return rawId ? `/inventory/stocks/${rawId}` : null;
  }

  if (objectType.startsWith('build_order_')) {
    const { baseId, batch } = splitSeriesObjectId(rawId);
    const tab = BUILD_ORDER_TABS[objectType] || 'details';
    const query = new URLSearchParams({ tab });
    if (batch) {
      query.set('batch', batch);
    }
    return baseId ? `/build-orders/${baseId}?${query.toString()}` : null;
  }

  return null;
};
