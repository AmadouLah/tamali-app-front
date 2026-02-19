export interface ProductCategoryDto {
  id: string;
  name: string;
  businessId: string;
}

export interface ProductDto {
  id: string;
  name: string;
  reference?: string;
  unitPrice: number;
  purchasePrice?: number;
  businessId: string;
  categoryId?: string;
  categoryName?: string;
  stockQuantity: number;
  taxable: boolean;
}

export interface SaleItemDto {
  id: string;
  productId: string;
  productName?: string;
  quantity: number;
  price: number;
}

export interface SaleDto {
  id: string;
  businessId: string;
  cashierId: string;
  items: SaleItemDto[];
  totalAmount: number;
  taxAmount?: number;
  saleDate: string;
}

export type PaymentMethod = 'CASH' | 'ORANGE_MONEY' | 'CARD';
export type MovementType = 'IN' | 'OUT' | 'SALE';

export interface ProductCreateRequest {
  name: string;
  reference?: string;
  categoryId?: string;
  unitPrice: number;
  purchasePrice?: number;
  taxable: boolean;
  initialQuantity: number;
}

export interface ProductUpdateRequest {
  name?: string;
  reference?: string;
  categoryId?: string;
  unitPrice?: number;
  purchasePrice?: number;
  taxable?: boolean;
}

export interface SaleItemRequest {
  productId: string;
  quantity: number;
}

export interface SaleCreateRequest {
  cashierId: string;
  items: SaleItemRequest[];
  method: PaymentMethod;
  customerEmail?: string;
  customerPhone?: string;
}

export interface StockMovementCreateRequest {
  quantity: number;
  type: MovementType;
}

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  CASH: 'Espèces',
  ORANGE_MONEY: 'Orange Money',
  CARD: 'Carte'
};
