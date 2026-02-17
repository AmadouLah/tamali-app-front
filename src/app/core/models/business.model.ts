export type LegalStatus =
  | 'SARL' | 'SA' | 'SAS' | 'EURL' | 'SN' | 'SCS' | 'SCA' | 'EI'
  | 'AUTO_ENTREPRENEUR' | 'ASSOCIATION' | 'AUTRE';

export interface BusinessDto {
  id: string;
  name?: string;
  sectorId?: string;
  address?: string;
  phone?: string;
  country?: string;
  commerceRegisterNumber?: string;
  identificationNumber?: string;
  legalStatus?: LegalStatus;
  bankAccountNumber?: string;
  websiteUrl?: string;
  logoUrl?: string;
  receiptTemplateId?: string;
  email?: string;
}

export interface BusinessSectorDto {
  id: string;
  name: string;
  description?: string;
  active: boolean;
}

export interface ReceiptTemplateDto {
  id: string;
  code: string;
  name: string;
  htmlContent: string;
  cssContent?: string;
  isDefault: boolean;
  active: boolean;
}

export const LEGAL_STATUS_OPTIONS: { value: LegalStatus; label: string }[] = [
  { value: 'SARL', label: 'SARL - Société à Responsabilité Limitée' },
  { value: 'SA', label: 'SA - Société Anonyme' },
  { value: 'SAS', label: 'SAS - Société par Actions Simplifiée' },
  { value: 'EURL', label: 'EURL - Entreprise Unipersonnelle à Responsabilité Limitée' },
  { value: 'SN', label: 'SN - Société en Nom Collectif' },
  { value: 'SCS', label: 'SCS - Société en Commandite Simple' },
  { value: 'SCA', label: 'SCA - Société en Commandite par Actions' },
  { value: 'EI', label: 'EI - Entreprise Individuelle' },
  { value: 'AUTO_ENTREPRENEUR', label: 'Auto-entrepreneur' },
  { value: 'ASSOCIATION', label: 'Association' },
  { value: 'AUTRE', label: 'Autre' }
];
