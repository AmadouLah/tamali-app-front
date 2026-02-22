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
    const subtotalLabel = taxAmount > 0 ? 'Sous-total HT:' : 'Sous-total:';
    const taxLabel = taxAmount > 0 ? 'TVA (18%):' : 'TVA:';

    const commerceRegisterHtml = b.commerceRegisterNumber?.trim()
      ? `<p>Registre de commerce: ${this.escapeHtml(b.commerceRegisterNumber.trim())}</p>`
      : '';

    const itemsHtml = (s.items ?? [])
      .map(item => {
        const lineTotal = item.price * item.quantity;
        return `<tr><td>${this.escapeHtml(item.productName)}</td><td>${item.quantity}</td><td>${this.formatMoney(item.price)}</td><td>${this.formatMoney(lineTotal)}</td></tr>`;
      })
      .join('') || '<tr><td colspan="4">Aucun article</td></tr>';

    return `
<div class="receipt">
  <div class="header-section">
    <h2>${this.escapeHtml(b.name ?? '')}</h2>
    <p>${this.escapeHtml(b.address ?? '')}</p>
    <p>Tél: ${this.escapeHtml(b.phone ?? '')} | Email: ${this.escapeHtml(b.email ?? '')}</p>
    ${commerceRegisterHtml}
  </div>
  <hr />
  <p><strong>Reçu N°:</strong> ${this.escapeHtml(s.id)}</p>
  <p><strong>Date:</strong> ${this.formatDate(s.saleDate)}</p>
  <p><strong>Vendeur:</strong> ${this.escapeHtml(data.cashierName)}</p>
  <hr />
  <table>
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
  <hr />
  <p><strong>${subtotalLabel}</strong> ${this.formatMoney(subtotal)}</p>
  <p><strong>${taxLabel}</strong> ${this.formatMoney(taxAmount)}</p>
  <p><strong>Total:</strong> ${this.formatMoney(s.totalAmount)}</p>
  <hr />
  <p class="footer">Merci de votre visite !</p>
</div>`;
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}
