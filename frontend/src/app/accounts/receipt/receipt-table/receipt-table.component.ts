import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { TransactionService, Transaction } from '../../../services/transaction.service';
import { ToastService } from '../../../services/toast.service';
import { LoadingService } from '../../../services/loading.service';
import { PdfHeaderFooterService } from '../../../services/pdf-header-footer.service';

const RECEIPT_TRANSTYPES = 'Expense,Salary,Refund';

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

  constructor(
    private router: Router,
    private transactionService: TransactionService,
    private toastService: ToastService,
    private loadingService: LoadingService,
    private pdfHeaderFooter: PdfHeaderFooterService
  ) {}

  ngOnInit(): void {
    this.loadData();
  }

  loadData(): void {
    this.loadingService.show();
    this.transactionService.getTransactions({ transtypes: RECEIPT_TRANSTYPES }).subscribe({
      next: (response) => {
        if (response.success) {
          this.allReceipts = response.data;
          this.filteredReceipts = [...this.allReceipts];
        }
        this.loadingService.hide();
      },
      error: (err) => {
        this.toastService.error(err?.error?.error || 'Failed to load receipts');
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

  downloadCSV(): void {
    const headers = ['Date', 'Reference', 'Payment Mode', 'Amount', 'Type', 'Recipient ID', 'Recipient', 'Remarks'];
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
    link.download = `receipts_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
    this.toastService.success('CSV downloaded');
  }

  downloadPDF(): void {
    this.pdfHeaderFooter.getHeaderFooter().subscribe(({ header, footer }) => {
      const doc = new jsPDF();
      const startY = this.pdfHeaderFooter.addHeader(doc, header);
      const headers = [['Date', 'Reference', 'Type', 'Amount', 'Recipient ID', 'Recipient']];
      const rows = this.filteredReceipts.map(p => [
        (p.transaction_date || '').substring(0, 10),
        (p.reference_number || '').substring(0, 15),
        (p.transtype || '').substring(0, 10),
        this.formatCurrencyForPDF(p.amount || 0),
        (p.registration_no || '').substring(0, 15),
        (p.user_name || '').substring(0, 25)
      ]);
      doc.text('Receipts List', 14, startY);
      autoTable(doc, { head: headers, body: rows, theme: 'striped', styles: { fontSize: 9 }, headStyles: { fillColor: [102, 126, 234] }, startY: startY + 7 });
      this.pdfHeaderFooter.addFooter(doc, footer);
      doc.save(`Receipts_${new Date().getTime()}.pdf`);
      this.toastService.success('PDF downloaded');
    });
  }

  downloadExcel(): void {
    const headers = ['Date', 'Reference', 'Payment Mode', 'Amount', 'Type', 'Recipient ID', 'Recipient', 'Remarks'];
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
    XLSX.utils.book_append_sheet(wb, ws, 'Receipts');
    XLSX.writeFile(wb, `Receipts_${new Date().getTime()}.xlsx`);
    this.toastService.success('Excel downloaded');
  }

  addNew(): void {
    this.router.navigate(['/dashboard/accounts/receipt/create']);
  }

  editReceipt(receipt: Transaction): void {
    if (receipt.id) this.router.navigate(['/dashboard/accounts/receipt/edit', receipt.id]);
  }

  deleteReceipt(receipt: Transaction): void {
    if (!receipt.id) return;
    if (confirm(`Are you sure you want to delete receipt ${receipt.reference_number || receipt.id}?`)) {
      this.loadingService.show();
      this.transactionService.deleteTransaction(receipt.id).subscribe({
        next: (response) => {
          if (response.success) {
            this.toastService.success('Receipt deleted successfully');
            this.loadData();
          }
          this.loadingService.hide();
        },
        error: (err) => {
          this.toastService.error(err?.error?.error || 'Failed to delete receipt');
          this.loadingService.hide();
        }
      });
    }
  }
}
