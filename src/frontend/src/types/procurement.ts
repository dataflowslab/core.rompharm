export interface ReceivedItem {
    _id: string;
    part: number;
    part_detail?: {
        name: string;
        IPN: string;
    };
    quantity: number;
    quantity_received?: number;  // Original quantity in Manufacturer UM
    quantity_system_um?: number;  // Converted quantity in System UM
    conversion_modifier?: number;
    system_um_detail?: {
        name: string;
        abrev: string;
        symbol: string;
    };
    manufacturer_um_detail?: {
        name: string;
        abrev: string;
        symbol: string;
    };
    location: number;
    location_detail?: {
        name: string;
    };
    batch?: string;  // Legacy field
    batch_code?: string;  // New field
    serial: string;
    packaging: string;
    status: number;
    status_detail?: {
        name: string;
        value: number;
        color: string;
    };
    notes: string;
}

export interface PurchaseOrderItem {
    _id: string;
    part_id: string;
    part_detail?: {
        name: string;
        ipn: string;
        IPN?: string;
        um?: string;
        manufacturer_um?: string;
        lotallexp?: boolean;
    };
    quantity: number;
    received: number;
    purchase_price?: number;
    purchase_price_currency?: string;
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
    required_officers: any[];
    optional_officers: any[];
}

// Consolidating types from ProcurementPage.tsx
export interface PurchaseOrder {
    _id: string;
    reference: string;
    description: string;
    supplier?: number; // legacy
    supplier_id?: string;
    supplier_detail?: {
        name: string;
        _id: string;
    };
    supplier_reference?: string;
    order_currency?: string;
    currency?: string;
    state_id?: string;
    state_detail?: {
        name: string;
        color: string;
        value: number;
    };
    status?: number | string;
    status_text?: string;
    issue_date: string;
    target_date: string;
    creation_date?: string;
    destination_id?: string;
    destination_detail?: {
        name: string;
    };
    notes?: string;
    line_items?: number;
    lines?: number;
    created_by?: string;
}

export interface Supplier {
    _id?: string;
    name: string;
    currency?: string;
}

export interface Currency {
    code: string;
    name: string;
}

export interface OrderState {
    _id: string;
    name: string;
    color: string;
}
