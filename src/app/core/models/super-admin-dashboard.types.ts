export interface SuperAdminPlatformStats {
  totalBusinesses: number;
  totalUsers: number;
  totalSalesCount: number;
  totalTransactionVolume: number;
  activeBusinessesToday: number;
}

export interface BusinessActivitySummary {
  id: string;
  name: string;
  saleCountOrDaysSinceLastSale: number;
}

export interface SuperAdminRecentActivity {
  newBusinessesCount: number;
  newUsersCount: number;
  mostActiveBusinesses: BusinessActivitySummary[];
  inactiveBusinesses: BusinessActivitySummary[];
}

export interface SalesPerDay {
  date: string;
  count: number;
}

export interface SuperAdminUsageStats {
  salesPerDay: SalesPerDay[];
  peakActivityLabel: string;
  usageRatePercent: number;
}

export interface SuperAdminSystemMonitoring {
  serverStatus: string;
  criticalErrors: string[];
  syncFailures: string[];
  emailOrWhatsAppFailures: string[];
}

export interface SuperAdminDashboard {
  platformStats: SuperAdminPlatformStats;
  recentActivity: SuperAdminRecentActivity;
  usageStats: SuperAdminUsageStats;
  systemMonitoring: SuperAdminSystemMonitoring;
}

export interface BusinessSummaryDto {
  id: string;
  name: string;
  email: string | null;
  active: boolean;
  userCount: number;
  createdAt: string;
}

export interface ServiceRequestDto {
  id: string;
  email: string;
  objective: string;
  processed: boolean;
  createdAt: string;
}
