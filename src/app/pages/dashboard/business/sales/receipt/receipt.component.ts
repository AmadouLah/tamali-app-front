import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { DomSanitizer, SafeHtml, SafeResourceUrl } from '@angular/platform-browser';
import { HttpClient } from '@angular/common/http';
import { ReceiptBuilderService, ReceiptData } from '../../../../../core/services/receipt-builder.service';
import { ApiConfigService } from '../../../../../core/services/api-config.service';
import { NetworkService } from '../../../../../core/services/network.service';
import { BusinessOperationsService } from '../../../../../core/services/business-operations.service';

@Component({
  selector: 'app-receipt',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './receipt.component.html',
  styleUrl: './receipt.component.css'
})
export class ReceiptComponent implements OnInit, OnDestroy {
  private readonly router = inject(Router);
  private readonly http = inject(HttpClient);
  private readonly receiptBuilder = inject(ReceiptBuilderService);
  private readonly apiConfig = inject(ApiConfigService);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly networkService = inject(NetworkService);
  private readonly businessOps = inject(BusinessOperationsService);

  /** Rendu identique au PDF (HTML du backend) dans une iframe */
  receiptFrameUrl: SafeResourceUrl | null = null;
  /** Fallback : HTML construit côté front quand pas d’API (vente locale / hors ligne) */
  receiptHtml: SafeHtml | null = null;
  unavailable = false;
  canDownloadPdf = false;
  downloadingPdf = false;
  loadingReceipt = true;
  private saleId: string | null = null;
  private blobUrl: string | null = null;
  private stateSale: any;
  private stateBusiness: any;
  private stateCashierName = '';

  ngOnInit(): void {
    const state = history.state;
    const { sale, business, cashierName } = (state || {}) as { sale?: any; business?: any; cashierName?: string };

    if (!sale || !business) {
      this.unavailable = true;
      this.loadingReceipt = false;
      return;
    }

    this.stateSale = sale;
    this.stateBusiness = business;
    this.stateCashierName = cashierName ?? 'Vendeur';
    this.saleId = sale.id;
    this.canDownloadPdf = this.networkService.isOnline && !String(sale.id).startsWith('local-');

    const saleIdForApi = this.saleId && !String(this.saleId).startsWith('local-') ? this.saleId : null;
    const useApi = this.networkService.isOnline && saleIdForApi;
    if (useApi && saleIdForApi) {
      this.http.get<{ html: string }>(this.apiConfig.getReceiptHtmlUrl(saleIdForApi)).subscribe({
        next: (res) => {
          if (res?.html) {
            const blob = new Blob([res.html], { type: 'text/html;charset=utf-8' });
            this.blobUrl = URL.createObjectURL(blob);
            this.receiptFrameUrl = this.sanitizer.bypassSecurityTrustResourceUrl(this.blobUrl);
          }
          this.loadingReceipt = false;
        },
        error: () => this.buildFallbackReceipt(this.stateSale, this.stateBusiness, this.stateCashierName)
      });
    } else {
      this.buildFallbackReceipt(this.stateSale, this.stateBusiness, this.stateCashierName);
    }
  }

  private buildFallbackReceipt(sale: any, business: any, cashierName: string): void {
    this.loadingReceipt = false;
    const receiptData: ReceiptData = {
      business: {
        name: business.name,
        address: business.address,
        phone: business.phone,
        email: business.email,
        commerceRegisterNumber: business.commerceRegisterNumber ?? (business as any).commerce_register_number ?? '',
        logoUrl: business.logoUrl
      },
      sale: {
        id: sale.id,
        saleDate: sale.saleDate ?? new Date().toISOString(),
        items: (sale.items ?? []).map((i: any) => ({
          productId: i.productId,
          productName: i.productName ?? 'Produit',
          quantity: i.quantity,
          price: i.price ?? 0
        })),
        totalAmount: sale.totalAmount ?? 0,
        taxAmount: sale.taxAmount ?? 0,
        receiptNumber: sale.receiptNumber
      },
      cashierName: cashierName ?? 'Vendeur'
    };
    const html = this.receiptBuilder.buildReceiptHtml(receiptData);
    this.receiptHtml = this.sanitizer.bypassSecurityTrustHtml(html);
  }

  ngOnDestroy(): void {
    if (this.blobUrl) {
      URL.revokeObjectURL(this.blobUrl);
      this.blobUrl = null;
    }
  }

  print(): void {
    window.print();
  }

  async share(): Promise<void> {
    const state = this.router.lastSuccessfulNavigation?.extras?.state ?? history.state;
    const { sale, business } = (state || {}) as { sale?: any; business?: any };
    if (!sale || !business) return;

    const lines = (sale.items ?? [])
      .map((i: any) => `- ${i.productName ?? 'Produit'} x${i.quantity} : ${(i.price ?? 0) * (i.quantity ?? 0)} FCFA`)
      .join('\n');
    const commerceRegister = business.commerceRegisterNumber ?? (business as any).commerce_register_number;
    const regLine = commerceRegister ? `Registre de commerce: ${commerceRegister}\n` : '';
    const receiptNum = sale.receiptNumber ?? sale.id;
const text = `${business.name ?? ''}\n${regLine}Reçu #${receiptNum}\n${sale.saleDate ?? ''}\n\n${lines}\n\nTotal: ${sale.totalAmount ?? 0} FCFA`;

    if (navigator.share) {
      try {
        await navigator.share({ title: `Reçu ${receiptNum}`, text });
      } catch (err) {
        if ((err as Error).name !== 'AbortError') this.fallbackShare(text);
      }
    } else {
      this.fallbackShare(text);
    }
  }

  private fallbackShare(text: string): void {
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text).then(() => alert('Reçu copié dans le presse-papiers.'));
    } else {
      alert('Utilisez l\'impression pour enregistrer en PDF.');
    }
  }

  downloadPdf(): void {
    if (!this.saleId || this.downloadingPdf) return;
    this.downloadingPdf = true;
    this.businessOps.generateReceipt(this.saleId).subscribe({
      next: async (res) => {
        if (res?.receiptPdfUrl) {
          try {
            const resp = await fetch(res.receiptPdfUrl);
            const blob = await resp.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `recu-${this.saleId}.pdf`;
            a.click();
            URL.revokeObjectURL(url);
          } catch {
            window.open(res.receiptPdfUrl, '_blank', 'noopener');
          }
        }
        this.downloadingPdf = false;
      },
      error: () => { this.downloadingPdf = false; }
    });
  }

  goBack(): void {
    this.router.navigate(['/dashboard/business/sales']);
  }
}
