import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { ReceiptBuilderService, ReceiptData } from '../../../../../core/services/receipt-builder.service';
import { NetworkService } from '../../../../../core/services/network.service';
import { BusinessOperationsService } from '../../../../../core/services/business-operations.service';

@Component({
  selector: 'app-receipt',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './receipt.component.html',
  styleUrl: './receipt.component.css'
})
export class ReceiptComponent implements OnInit {
  private readonly router = inject(Router);
  private readonly receiptBuilder = inject(ReceiptBuilderService);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly networkService = inject(NetworkService);
  private readonly businessOps = inject(BusinessOperationsService);

  receiptHtml: SafeHtml | null = null;
  unavailable = false;
  canDownloadPdf = false;
  downloadingPdf = false;
  private saleId: string | null = null;

  ngOnInit(): void {
    const state = history.state;
    const { sale, business, cashierName } = (state || {}) as { sale?: any; business?: any; cashierName?: string };

    if (!sale || !business) {
      this.unavailable = true;
      return;
    }

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
        taxAmount: sale.taxAmount ?? 0
      },
      cashierName: cashierName ?? 'Vendeur'
    };

    const html = this.receiptBuilder.buildReceiptHtml(receiptData);
    this.receiptHtml = this.sanitizer.bypassSecurityTrustHtml(html);
    this.saleId = sale.id;
    this.canDownloadPdf = this.networkService.isOnline && !String(sale.id).startsWith('local-');
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
    const text = `${business.name ?? ''}\n${regLine}Reçu #${sale.id}\n${sale.saleDate ?? ''}\n\n${lines}\n\nTotal: ${sale.totalAmount ?? 0} FCFA`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: `Reçu ${sale.id}`,
          text
        });
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
      error: () => {
        this.downloadingPdf = false;
      }
    });
  }

  goBack(): void {
    this.router.navigate(['/dashboard/business/sales']);
  }
}
