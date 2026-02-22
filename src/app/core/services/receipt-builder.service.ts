import { Injectable } from '@angular/core';

export interface ReceiptItemDto {
  productId: string;
  productName: string;
  quantity: number;
  price: number;
}

export interface ReceiptSaleDto {
  id: string;
  saleDate: string;
  items: ReceiptItemDto[];
  totalAmount: number;
  taxAmount?: number;
}

export interface ReceiptBusinessDto {
  name?: string;
  address?: string;
  phone?: string;
  email?: string;
  commerceRegisterNumber?: string;
  logoUrl?: string;
}

export interface ReceiptData {
  business: ReceiptBusinessDto;
  sale: ReceiptSaleDto;
  cashierName: string;
}

@Injectable({ providedIn: 'root' })
export class ReceiptBuilderService {

  formatMoney(amount: number): string {
    return `${(amount ?? 0).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} FCFA`.replace('.', ',');
  }

  formatDate(dateStr: string): string {
    const d = new Date(dateStr);
    return d.toLocaleString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  buildReceiptHtml(data: ReceiptData): string {
    const b = data.business;
    const s = data.sale;
    const subtotal = s.totalAmount - (s.taxAmount ?? 0);
    const taxAmount = s.taxAmount ?? 0;
    const subtotalLabel = taxAmount > 0 ? 'Sous-total HT' : 'Sous-total';
    const taxLabel = taxAmount > 0 ? 'TVA (18%)' : 'TVA';

    const initials = this.getInitials(b.name ?? '');
    const logoHtml = b.logoUrl?.trim()
      ? `<div class="receipt-logo-wrap"><img src="${this.escapeAttr(b.logoUrl.trim())}" alt="Logo" class="receipt-logo" onerror="this.style.display='none';var f=this.nextElementSibling;if(f)f.style.display='flex'" /><div class="receipt-logo-fallback" style="display:none">${this.escapeHtml(initials)}</div></div>`
      : `<div class="receipt-logo-wrap"><div class="receipt-logo-fallback">${this.escapeHtml(initials)}</div></div>`;

    const commerceRegisterHtml = b.commerceRegisterNumber?.trim()
      ? `<p class="receipt-register">Registre de commerce : ${this.escapeHtml(b.commerceRegisterNumber.trim())}</p>`
      : '';

    const itemsHtml = (s.items ?? [])
      .map(item => {
        const lineTotal = item.price * item.quantity;
        return `<tr><td class="col-article">${this.escapeHtml(item.productName)}</td><td class="col-qty">${item.quantity}</td><td class="col-pu">${this.formatMoney(item.price)}</td><td class="col-total">${this.formatMoney(lineTotal)}</td></tr>`;
      })
      .join('') || '<tr><td colspan="4" class="text-center">Aucun article</td></tr>';

    return `
<div class="receipt">
  <header class="receipt-header">
    ${logoHtml}
    <h1 class="receipt-title">${this.escapeHtml(b.name ?? '')}</h1>
    <p class="receipt-address">${this.escapeHtml(b.address ?? '')}</p>
    <p class="receipt-contact">Tél : ${this.escapeHtml(b.phone ?? '')} &nbsp;|&nbsp; Email : ${this.escapeHtml(b.email ?? '')}</p>
    ${commerceRegisterHtml}
  </header>
  <section class="receipt-info">
    <p><span class="label">Reçu N°</span> <span class="value">${this.escapeHtml(String(s.id).substring(0, 12))}</span></p>
    <p><span class="label">Date</span> <span class="value">${this.formatDate(s.saleDate)}</span></p>
    <p><span class="label">Vendeur</span> <span class="value">${this.escapeHtml(data.cashierName)}</span></p>
  </section>
  <table class="receipt-table">
    <thead>
      <tr>
        <th>Article</th>
        <th>Qté</th>
        <th>P.U</th>
        <th>Total</th>
      </tr>
    </thead>
    <tbody>${itemsHtml}</tbody>
  </table>
  <section class="receipt-totals">
    <div class="total-row"><span>${subtotalLabel}</span><span>${this.formatMoney(subtotal)}</span></div>
    <div class="total-row"><span>${taxLabel}</span><span>${this.formatMoney(taxAmount)}</span></div>
    <div class="total-row total-final"><span>Total</span><span>${this.formatMoney(s.totalAmount)}</span></div>
  </section>
  <footer class="receipt-footer">Merci de votre visite !</footer>
</div>`;
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  private escapeAttr(text: string): string {
    return text.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  private getInitials(name: string): string {
    const words = name.trim().split(/\s+/).filter(Boolean);
    if (words.length >= 2) {
      return (words[0][0] + words[words.length - 1][0]).toUpperCase().slice(0, 2);
    }
    return name.slice(0, 2).toUpperCase() || '??';
  }
}
