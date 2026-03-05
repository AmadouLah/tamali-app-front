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
  purchasePrice?: number;
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

export interface StockMovementDto {
  id: string;
  productId: string;
  businessId: string;
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
  userId?: string;
}

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  CASH: 'Espèces',
  ORANGE_MONEY: 'Orange Money',
  CARD: 'Carte'
};
