export interface PartDetail {
    name: string;
    IPN: string;
}

export interface RecipeItem {
    type: number;
    id?: number;
    q?: number;
    start?: string;
    fin?: string;
    mandatory: boolean;
    notes?: string;
    part_detail?: PartDetail;
    items?: RecipeItem[];
}

export interface Recipe {
    _id: string;
    id: number;
    rev: number;
    rev_date: string;
    items: RecipeItem[];
    product_detail: PartDetail;
    created_at: string;
    created_by: string;
    updated_at: string;
    updated_by: string;
}

export interface Part {
    id: number;
    name: string;
    IPN: string;
}
