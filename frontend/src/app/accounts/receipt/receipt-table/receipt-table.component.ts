import { Component, HostListener, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { TransactionService, Transaction } from '../../../services/transaction.service';
import { ToastService } from '../../../services/toast.service';
import { LoadingService } from '../../../services/loading.service';
import { PdfHeaderFooterService } from '../../../services/pdf-header-footer.service';

// In the intentionally swapped UI, this table is shown on the "Payment" page.
// So it must include opening balances as payment-type transactions.
const RECEIPT_TRANSTYPES = 'Fee,Admission,Opening Balance,Other';

@Component({
  selector: 'app-receipt-table',
  templateUrl: './receipt-table.component.html',
  styleUrls: ['./receipt-table.component.css']
})
export class ReceiptTableComponent implements OnInit {
  allReceipts: Transaction[] = [];
  filteredReceipts: Transaction[] = [];
  searchQuery = '';
  currentPage = 1;
  itemsPerPage = 10;
  sortColumn: string | null = null;
  sortDirection: 'asc' | 'desc' = 'asc';
  openReceiptDownloadKey: string | null = null;
  receiptDownloadDirection: Record<string, 'up' | 'down'> = {};

  constructor(
    private router: Router,
    private transactionService: TransactionService,
    private toastService: ToastService,
    private loadingService: LoadingService,
    private pdfHeaderFooter: PdfHeaderFooterService
  ) {}

  @HostListener('document:click')
  closeReceiptDownloadMenu(): void {
    this.openReceiptDownloadKey = null;
  }

  ngOnInit(): void {
    this.loadData();
  }

  loadData(): void {
    this.loadingService.show();
    this.transactionService.getTransactions({ transtypes: RECEIPT_TRANSTYPES }).subscribe({
      next: (response) => {
        if (response.success) {
          this.allReceipts = response.data || [];
          this.filteredReceipts = [...this.allReceipts];
        }
        this.loadingService.hide();
      },
      error: (err) => {
        this.toastService.error(err?.error?.error || 'Failed to load payments');
        this.loadingService.hide();
      }
    });
  }

  onSearch(): void {
    if (!this.searchQuery.trim()) {
      this.filteredReceipts = [...this.allReceipts];
      this.currentPage = 1;
      return;
    }
    const query = this.searchQuery.toLowerCase();
    this.filteredReceipts = this.allReceipts.filter(p =>
      (p.reference_number || '').toLowerCase().includes(query) ||
      (p.transaction_date || '').includes(query) ||
      (p.user_name || '').toLowerCase().includes(query) ||
      (p.registration_no || '').toLowerCase().includes(query) ||
      (p.payment_mode || '').toLowerCase().includes(query) ||
      (p.transtype || '').toLowerCase().includes(query) ||
      String(p.amount || '').includes(query)
    );
    this.currentPage = 1;
  }

  sort(column: string): void {
    if (this.sortColumn === column) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortColumn = column;
      this.sortDirection = 'asc';
    }
    this.filteredReceipts.sort((a, b) => {
      const aVal = (a as any)[column] ?? '';
      const bVal = (b as any)[column] ?? '';
      if (aVal < bVal) return this.sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return this.sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }

  get paginatedReceipts(): Transaction[] {
    const start = (this.currentPage - 1) * this.itemsPerPage;
    return this.filteredReceipts.slice(start, start + this.itemsPerPage);
  }

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.filteredReceipts.length / this.itemsPerPage));
  }

  goToPage(page: number): void {
    if (page >= 1 && page <= this.totalPages) this.currentPage = page;
  }

  getPageNumbers(): number[] {
    const pages: number[] = [];
    const maxPages = 5;
    let start = Math.max(1, this.currentPage - Math.floor(maxPages / 2));
    let end = Math.min(this.totalPages, start + maxPages - 1);
    if (end - start < maxPages - 1) start = Math.max(1, end - maxPages + 1);
    for (let i = start; i <= end; i++) pages.push(i);
    return pages;
  }

  formatCurrency(value: number): string {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2
    }).format(value);
  }

  /** PDF-safe format (no Unicode ₹) so jsPDF renders correctly */
  formatCurrencyForPDF(value: number): string {
    return 'Rs. ' + new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
  }

  getReceiptRowKey(receipt: Transaction): string {
    // Used to keep a single dropdown open.
    return String(receipt.id ?? receipt.reference_number ?? receipt.transaction_date ?? 'receipt');
  }

  toggleReceiptDownloadMenu(receipt: Transaction, event: MouseEvent): void {
    event.preventDefault();
    event.stopPropagation();
    const key = this.getReceiptRowKey(receipt);
    const trigger = event.currentTarget as HTMLElement | null;
    if (trigger) {
      this.receiptDownloadDirection[key] = this.getDropdownDirection(trigger);
    }
    this.openReceiptDownloadKey = this.openReceiptDownloadKey === key ? null : key;
  }

  getReceiptDownloadDirection(receipt: Transaction): 'up' | 'down' {
    const key = this.getReceiptRowKey(receipt);
    return this.receiptDownloadDirection[key] || 'down';
  }

  private getDropdownDirection(triggerElement: HTMLElement): 'up' | 'down' {
    const rect = triggerElement.getBoundingClientRect();
    const estimatedMenuHeight = 150;
    const gap = 12;
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;

    if (spaceBelow >= estimatedMenuHeight + gap) return 'down';
    if (spaceAbove >= estimatedMenuHeight + gap) return 'up';
    return spaceBelow >= spaceAbove ? 'down' : 'up';
  }

  downloadReceiptRow(receipt: Transaction, format: 'pdf' | 'excel' | 'csv'): void {
    this.openReceiptDownloadKey = null;
    if (format === 'pdf') {
      this.downloadReceiptRowPDF(receipt);
      return;
    }
    if (format === 'excel') {
      this.downloadReceiptRowExcel(receipt);
      return;
    }
    this.downloadReceiptRowCSV(receipt);
  }

  private sanitizeFilePart(value: unknown): string {
    return String(value ?? '')
      .trim()
      .replace(/[\\/:*?"<>|]/g, '_')
      .replace(/\s+/g, '_')
      .slice(0, 60);
  }

  private truncateForPDF(value: unknown, maxLen: number): string {
    const s = String(value ?? '');
    if (s.length <= maxLen) return s;
    return s.slice(0, Math.max(0, maxLen - 1)) + '…';
  }

  private downloadReceiptRowPDF(receipt: Transaction): void {
    this.pdfHeaderFooter.getHeaderFooter().subscribe(({ header, footer }) => {
      const doc = new jsPDF();
      let y = this.pdfHeaderFooter.addHeader(doc, header);

      doc.setFontSize(14);
      doc.text('Payment Voucher', 14, y);
      y += 8;

      doc.setFontSize(10);
      doc.text(`Date: ${String(receipt.transaction_date ?? '').substring(0, 10) || '-'}`, 18, y + 10);
      doc.text(`Reference: ${this.truncateForPDF(receipt.reference_number, 25) || '-'}`, 18, y + 16);
      doc.text(`Mode: ${this.truncateForPDF(receipt.payment_mode, 18) || '-'}`, 18, y + 22);
      doc.text(`Student: ${this.truncateForPDF(receipt.user_name, 30) || '-'}`, 18, y + 28);
      doc.text(`Reg No: ${this.truncateForPDF(receipt.registration_no, 18) || '-'}`, 18, y + 34);

      const amountStr = this.formatCurrencyForPDF(receipt.amount || 0);
      doc.setFontSize(12);
      doc.text(amountStr, 196, y + 19, { align: 'right' } as any);

      // Remarks section
      const remarksLines = doc.splitTextToSize(this.truncateForPDF(receipt.remarks || '-', 160), 172) as string[];
      y = y + 60;
      doc.setFontSize(10);
      doc.text('Remarks:', 14, y);
      remarksLines.slice(0, 3).forEach((line, i) => doc.text(line, 14, y + 5 + i * 5));

      this.pdfHeaderFooter.addFooter(doc, footer);
      const refPart = this.sanitizeFilePart(receipt.reference_number ?? receipt.id ?? 'receipt');
      doc.save(`Payment_${refPart}.pdf`);
      this.toastService.success('Payment PDF downloaded');
    });
  }

  private downloadReceiptRowExcel(receipt: Transaction): void {
    const headers = ['Date', 'Reference', 'Payment Mode', 'Amount', 'Transaction Type', 'Student ID', 'Student', 'Remarks'];
    const row = [
      receipt.transaction_date || '',
      receipt.reference_number || '',
      receipt.payment_mode || '',
      receipt.amount || 0,
      receipt.transtype || '',
      receipt.registration_no || '',
      receipt.user_name || '',
      receipt.remarks || ''
    ];
    const ws = XLSX.utils.aoa_to_sheet([headers, row]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Payment');
    const refPart = this.sanitizeFilePart(receipt.reference_number ?? receipt.id ?? 'receipt');
    XLSX.writeFile(wb, `Payment_${refPart}.xlsx`);
    this.toastService.success('Payment Excel downloaded');
  }

  private downloadReceiptRowCSV(receipt: Transaction): void {
    const headers = ['Date', 'Reference', 'Payment Mode', 'Amount', 'Transaction Type', 'Student ID', 'Student', 'Remarks'];
    const row = [
      receipt.transaction_date || '',
      receipt.reference_number || '',
      receipt.payment_mode || '',
      receipt.amount || 0,
      receipt.transtype || '',
      receipt.registration_no || '',
      receipt.user_name || '',
      receipt.remarks || ''
    ];

    const csvContent = [
      headers.join(','),
      row
        .map(cell => `"${String(cell).replace(/"/g, '""')}"`)
        .join(',')
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    const refPart = this.sanitizeFilePart(receipt.reference_number ?? receipt.id ?? 'receipt');
    link.download = `Payment_${refPart}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
    this.toastService.success('Payment CSV downloaded');
  }

  downloadCSV(): void {
    const headers = ['Date', 'Reference', 'Payment Mode', 'Amount', 'Transaction Type', 'Student ID', 'Student', 'Remarks'];
    const rows = this.filteredReceipts.map(p => [
      p.transaction_date || '',
      p.reference_number || '',
      p.payment_mode || '',
      p.amount || 0,
      p.transtype || '',
      p.registration_no || '',
      p.user_name || '',
      p.remarks || ''
    ]);
    const csvContent = [headers.join(','), ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `payments_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
    this.toastService.success('CSV downloaded');
  }

  downloadPDF(): void {
    this.pdfHeaderFooter.getHeaderFooter().subscribe(({ header, footer }) => {
      const doc = new jsPDF();
      const startY = this.pdfHeaderFooter.addHeader(doc, header);
      const headers = [['Date', 'Reference', 'Mode', 'Amount', 'Student ID', 'Student']];
      const rows = this.filteredReceipts.map(p => [
        (p.transaction_date || '').substring(0, 10),
        (p.reference_number || '').substring(0, 15),
        (p.payment_mode || '').substring(0, 10),
        this.formatCurrencyForPDF(p.amount || 0),
        (p.registration_no || '').substring(0, 15),
        (p.user_name || '').substring(0, 25)
      ]);
      doc.text('Payments List', 14, startY);
      autoTable(doc, { head: headers, body: rows, theme: 'striped', styles: { fontSize: 9 }, headStyles: { fillColor: [102, 126, 234] }, startY: startY + 7 });
      this.pdfHeaderFooter.addFooter(doc, footer);
      doc.save(`Payments_${new Date().getTime()}.pdf`);
      this.toastService.success('PDF downloaded');
    });
  }

  downloadExcel(): void {
    const headers = ['Date', 'Reference', 'Payment Mode', 'Amount', 'Transaction Type', 'Student ID', 'Student', 'Remarks'];
    const rows = this.filteredReceipts.map(p => [
      p.transaction_date || '',
      p.reference_number || '',
      p.payment_mode || '',
      p.amount || 0,
      p.transtype || '',
      p.registration_no || '',
      p.user_name || '',
      p.remarks || ''
    ]);
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Payments');
    XLSX.writeFile(wb, `Payments_${new Date().getTime()}.xlsx`);
    this.toastService.success('Excel downloaded');
  }

  addNew(): void {
    this.router.navigate(['/dashboard/accounts/payment/create']);
  }

  editReceipt(receipt: Transaction): void {
    if (receipt.id) this.router.navigate(['/dashboard/accounts/payment/edit', receipt.id]);
  }

  deleteReceipt(receipt: Transaction): void {
    if (!receipt.id) return;
    if (confirm(`Are you sure you want to delete payment ${receipt.reference_number || receipt.id}?`)) {
      this.loadingService.show();
      this.transactionService.deleteTransaction(receipt.id).subscribe({
        next: (response) => {
          if (response.success) {
            this.toastService.success('Payment deleted successfully');
            this.loadData();
          }
          this.loadingService.hide();
        },
        error: (err) => {
          this.toastService.error(err?.error?.error || 'Failed to delete payment');
          this.loadingService.hide();
        }
      });
    }
  }
}
