import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { ReceiptBuilderService, ReceiptData } from '../../../../../core/services/receipt-builder.service';

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

  receiptHtml: SafeHtml | null = null;
  unavailable = false;

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
        commerceRegisterNumber: business.commerceRegisterNumber
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
    const text = `${business.name ?? ''}\nReçu #${sale.id}\n${sale.saleDate ?? ''}\n\n${lines}\n\nTotal: ${sale.totalAmount ?? 0} FCFA`;

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

  goBack(): void {
    this.router.navigate(['/dashboard/business/sales']);
  }
}
