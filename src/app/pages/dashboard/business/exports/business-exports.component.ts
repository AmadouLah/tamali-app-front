import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AuthService, UserDto } from '../../../../core/services/auth.service';
import { BusinessExportService, ExportFormat, ExportPeriod } from '../../../../core/services/business-export.service';
import { IndexedDbService } from '../../../../core/services/indexed-db.service';
import { BusinessOperationsService } from '../../../../core/services/business-operations.service';
import type { SaleDto, StockMovementDto, BusinessActivityEntryDto } from '../../../../core/models/product.model';
import { GlassCardComponent } from '../../../../shared/components/glass-card/glass-card.component';
import { AdminSidebarComponent } from '../../../../shared/components/admin-sidebar/admin-sidebar.component';
import { UserAvatarComponent } from '../../../../shared/components/user-avatar/user-avatar.component';
import { getBusinessMenuItems } from '../business-menu.const';

@Component({
  selector: 'app-business-exports',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    GlassCardComponent,
    AdminSidebarComponent,
    UserAvatarComponent
  ],
  templateUrl: './business-exports.component.html',
  styleUrl: './business-exports.component.css'
})
export class BusinessExportsComponent implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly exportService = inject(BusinessExportService);
  private readonly db = inject(IndexedDbService);
  private readonly router = inject(Router);
  private readonly businessOps = inject(BusinessOperationsService);

  user: UserDto | null = null;
  businessId: string | null = null;

  period: ExportPeriod = 'ALL';
  customFrom?: string;
  customTo?: string;

  loadingSales = false;
  loadingStock = false;
  loadingActivity = false;

  activeMenu = 'exports';
  sidebarOpen = false;
  menuItems = getBusinessMenuItems(null);

  readonly periodOptions: { value: ExportPeriod; label: string }[] = [
    { value: 'ALL', label: 'Depuis le début' },
    { value: 'TODAY', label: "Aujourd'hui" },
    { value: 'THIS_WEEK', label: 'Cette semaine' },
    { value: 'THIS_MONTH', label: 'Ce mois' },
    { value: 'SIX_MONTHS', label: '6 mois' },
    { value: 'ONE_YEAR', label: '1 an' },
    { value: 'CUSTOM', label: 'Personnalisé' }
  ];

  ngOnInit(): void {
    this.user = this.authService.getUser();
    this.menuItems = getBusinessMenuItems(this.user);

    if (!this.authService.canAccessBusinessDashboard(this.user)) {
      if (this.user && this.authService.shouldRedirectToSetup(this.user)) {
        this.router.navigate(['/business/setup'], { queryParams: { userId: this.user.id } });
      } else {
        this.router.navigate(['/auth/login']);
      }
      return;
    }

    if (!this.authService.isBusinessOwner(this.user)) {
      this.router.navigate(['/dashboard/business/sales']);
      return;
    }

    this.businessId = this.user?.businessId ?? null;
  }

  setPeriod(p: ExportPeriod): void {
    this.period = p;
  }

  getPeriodButtonClass(p: ExportPeriod): string {
    return this.period === p
      ? 'bg-purple-500/30 text-purple-300 border border-purple-400/50'
      : 'glass-effect-subtle text-gray-400 border border-white/20';
  }

  async exportSales(format: ExportFormat): Promise<void> {
    if (!this.businessId || this.loadingSales) return;
    this.loadingSales = true;
    try {
      const custom = this.getCustomRange();
      const apiSales = await firstValueFrom(
        this.exportService.getSalesExport(this.businessId, this.period, custom)
      );

      const localSales = await this.db.getLocalSales(this.businessId);
      const localRows: (SaleDto & { status: string; isLocal?: boolean })[] = localSales.map(ls => {
        const sale = ls.sale as SaleDto;
        const status = ls.synced ? 'CORRIGÉ' : 'HORS_LIGNE';
        return {
          ...sale,
          id: ls.serverId ?? ls.id,
          businessId: sale.businessId ?? this.businessId!,
          status,
          isLocal: !ls.synced
        } as SaleDto & { status: string; isLocal?: boolean };
      });

      const rows = [...apiSales, ...localRows].map(s => [
        s.id,
        s.businessId,
        s.cashierId,
        this.getActorRole(s.cashierId),
        s.totalAmount,
        s.taxAmount ?? 0,
        (s as any).status ?? 'SYNCHRONISÉ',
        s.saleDate
      ]);

      const headers = [
        'ID',
        'ID entreprise',
        'ID utilisateur',
        'Rôle (propriétaire / associé)',
        'Montant total',
        'TVA',
        'Statut',
        'Date vente'
      ];

      this.exportData('ventes', format, headers, rows);
    } finally {
      this.loadingSales = false;
    }
  }

  async exportStockMovements(format: ExportFormat): Promise<void> {
    if (!this.businessId || this.loadingStock) return;
    this.loadingStock = true;
    try {
      const custom = this.getCustomRange();
      const movements = await firstValueFrom(
        this.exportService.getStockMovementsExport(this.businessId, this.period, custom)
      );

      const apiRows = movements.map((m: StockMovementDto) => [
        m.id,
        m.businessId,
        m.productId,
        m.quantity,
        m.type,
        m.userId ?? '',
        this.getActorRole(m.userId ?? undefined),
        m.userDisplayName ?? '',
        'SYNCHRONISÉ',
        m.movementAt
      ]);

      const products = await firstValueFrom(this.businessOps.getProducts(this.businessId));
      const localMovementsRows: (string | number | null | undefined)[][] = [];
      for (const product of products) {
        const locals = await this.db.getLocalStockMovements(product.id);
        locals
          .filter(m => !m.synced)
          .forEach(m => {
            const actorId = m.userId || this.user?.id || '';
            const actorRole = this.getActorRole(actorId);
            const actorName = actorId === this.user?.id ? this.authService.getDisplayName(this.user) : '';
            localMovementsRows.push([
              m.id,
              product.businessId,
              product.id,
              m.quantity,
              m.type,
              actorId,
              actorRole,
              actorName,
              'HORS_LIGNE',
              new Date(m.timestamp).toISOString()
            ]);
          });
      }

      const rows = [...apiRows, ...localMovementsRows];

      const headers = [
        'ID',
        'ID entreprise',
        'ID produit',
        'Quantité',
        'Type',
        'ID utilisateur',
        'Rôle (propriétaire / associé)',
        'Nom utilisateur',
        'Statut',
        'Date mouvement'
      ];

      this.exportData('mouvements-stock', format, headers, rows);
    } finally {
      this.loadingStock = false;
    }
  }

  async exportActivityLog(format: ExportFormat): Promise<void> {
    if (!this.businessId || this.loadingActivity) return;
    this.loadingActivity = true;
    try {
      const custom = this.getCustomRange();
      const entries = await firstValueFrom(
        this.exportService.getActivityLogExport(this.businessId, this.period, custom)
      );

      const apiRows = entries.map((e: BusinessActivityEntryDto) => [
        e.id,
        e.businessId,
        e.type,
        e.action,
        e.userId ?? '',
        this.getActorRole(e.userId ?? undefined),
        e.userDisplayName ?? '',
        e.syncStatus,
        e.occurredAt
      ]);

      const localSales = await this.db.getLocalSales(this.businessId);
      const localSaleRows = localSales
        .filter(ls => !ls.synced)
        .map(ls => {
          const sale = ls.sale as SaleDto;
          const saleDate = (sale && (sale as any).saleDate) || new Date(ls.timestamp).toISOString();
          return [
            ls.id,
            this.businessId,
            'VENTE',
            'Création de vente (hors ligne)',
            sale?.cashierId ?? '',
            this.getActorRole(sale?.cashierId),
            '',
            'HORS_LIGNE',
            saleDate
          ] as (string | number | null | undefined)[];
        });

      const rows = [...apiRows, ...localSaleRows];

      const headers = [
        'ID',
        'ID entreprise',
        'Type',
        'Action',
        'ID utilisateur',
        'Rôle (propriétaire / associé)',
        'Nom utilisateur',
        'Statut',
        'Horodatage'
      ];

      this.exportData('journal-activites', format, headers, rows);
    } finally {
      this.loadingActivity = false;
    }
  }

  async exportAll(format: ExportFormat): Promise<void> {
    await this.exportSales(format);
    await this.exportStockMovements(format);
    await this.exportActivityLog(format);
  }

  setActiveMenu(menu: string): void {
    this.activeMenu = menu;
  }

  getDisplayName(): string {
    return this.authService.getDisplayName(this.user);
  }

  private getActorRole(userId: string | null | undefined): string {
    if (!userId || !this.user) return '';
    if (userId === this.user.id && this.authService.isBusinessOwner(this.user)) {
      return 'Propriétaire';
    }
    if (userId === this.user.id && this.authService.isBusinessAssociate(this.user)) {
      return 'Associé';
    }
    // Pour les autres utilisateurs du même business, on les considère comme associés.
    return 'Associé';
  }

  private getCustomRange(): { from?: Date | null; to?: Date | null } | undefined {
    if (this.period !== 'CUSTOM') return undefined;
    const from = this.customFrom ? new Date(this.customFrom) : null;
    const to = this.customTo ? new Date(this.customTo) : null;
    return { from, to };
  }

  private exportData(
    baseName: string,
    format: ExportFormat,
    headers: string[],
    rows: (string | number | null | undefined)[][]
  ): void {
    const filenameBase = `${baseName}-${this.buildFilenameSuffix()}`;

    if (format === 'CSV' || format === 'EXCEL') {
      const csv = this.buildCsv(headers, rows);
      const ext = 'csv';
      const mime = 'text/csv;charset=utf-8';
      this.triggerDownload(`${filenameBase}.${ext}`, mime, csv);
      return;
    }

    const html = this.buildHtmlTable(headers, rows, baseName);
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(html);
    win.document.close();
    win.focus();
    win.print();
  }

  private buildCsv(
    headers: string[],
    rows: (string | number | null | undefined)[][]
  ): string {
    const esc = (v: unknown) => {
      const s = v == null ? '' : String(v);
      const needsQuote = s.includes(',') || s.includes('"') || s.includes('\n');
      const t = s.replace(/"/g, '""');
      return needsQuote ? `"${t}"` : t;
    };
    const lines = [
      headers.map(esc).join(','),
      ...rows.map(r => r.map(esc).join(','))
    ];
    // Préfixe BOM UTF-8 pour une ouverture correcte dans Excel (encodage + évite l'erreur SYLK).
    return '\uFEFF' + lines.join('\n');
  }

  private triggerDownload(filename: string, mimeType: string, content: string): void {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  private buildFilenameSuffix(): string {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  }

  private buildHtmlTable(
    headers: string[],
    rows: (string | number | null | undefined)[][],
    title: string
  ): string {
    const head = headers.map(h => `<th style="padding:8px;border:1px solid #e5e7eb;">${h}</th>`).join('');
    const body = rows
      .map(r => `<tr>${r
        .map(v => `<td style="padding:6px 8px;border:1px solid #e5e7eb;font-size:12px;">${v ?? ''}</td>`)
        .join('')}</tr>`)
      .join('');
    return `<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <title>${title}</title>
  <style>
    body { font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; padding: 16px; }
    h1 { font-size: 20px; margin-bottom: 12px; }
    table { border-collapse: collapse; width: 100%; }
    thead { background: #f3f4f6; }
  </style>
</head>
<body>
  <h1>Export ${title}</h1>
  <table>
    <thead><tr>${head}</tr></thead>
    <tbody>${body}</tbody>
  </table>
</body>
</html>`;
  }
}

