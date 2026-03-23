export interface ProductCategoryDto {
  id: string;
  name: string;
  businessId: string;
}

export type ProductType = 'UNIT' | 'WEIGHT';
export type ProductUnit = 'PIECE' | 'KG' | 'G' | 'LITRE' | 'SAC' | 'METRE';

export interface ProductDto {
  id: string;
  name: string;
  reference?: string;
  unitPrice: number;
  purchasePrice?: number;
  productType: ProductType;
  unit: ProductUnit;
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
  purchasePrice?: number;
}

export interface SaleDto {
  id: string;
  businessId: string;
  cashierId: string;
  customerId?: string;
  customerName?: string;
  customerPhone?: string;
  items: SaleItemDto[];
  totalAmount: number;
  taxAmount?: number;
  saleDate: string;
}

export interface CustomerDto {
  id: string;
  businessId: string;
  name: string;
  phone?: string;
}

export interface CustomerSummaryDto {
  id: string;
  name: string;
  phone?: string;
  purchasesCount: number;
  totalSpent: number;
}

export interface CustomerDetailsDto {
  id: string;
  name: string;
  phone?: string;
  purchasesCount: number;
  totalSpent: number;
  sales: SaleDto[];
}

export type PaymentMethod = 'CASH' | 'ORANGE_MONEY' | 'CARD';
export type MovementType = 'IN' | 'OUT' | 'SALE';

export interface StockMovementDto {
  id: string;
  productId: string;
  businessId: string;
  userId?: string | null;
  userDisplayName?: string | null;
  quantity: number;
  type: MovementType;
  movementAt: string;
}

export interface BusinessActivityEntryDto {
  type: 'VENTE' | 'MOUVEMENT_STOCK';
  action: string;
  id: string;
  businessId: string;
  userId?: string | null;
  userDisplayName?: string | null;
  occurredAt: string;
  syncStatus: 'SYNCHRONISÉ' | 'HORS_LIGNE' | 'CORRIGÉ';
}

export interface ProductCreateRequest {
  name: string;
  reference?: string;
  categoryId?: string;
  unitPrice: number;
  purchasePrice?: number;
  productType: ProductType;
  unit: ProductUnit;
  taxable: boolean;
  initialQuantity: number;
}

export interface ProductUpdateRequest {
  name?: string;
  reference?: string;
  categoryId?: string;
  unitPrice?: number;
  purchasePrice?: number;
  productType?: ProductType;
  unit?: ProductUnit;
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
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
}

export interface StockMovementCreateRequest {
  quantity: number;
  type: MovementType;
  userId?: string;
}

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  CASH: 'Espèces',
  ORANGE_MONEY: 'Orange Money',
  CARD: 'Carte'
};
