import { Component, HostListener, OnInit } from '@angular/core';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { ChartConfiguration, ChartData, ChartType } from 'chart.js';
import { Chart, registerables } from 'chart.js';
import { TransactionService, Transaction } from '../../services/transaction.service';
import { ToastService } from '../../services/toast.service';
import { LoadingService } from '../../services/loading.service';
import { PdfHeaderFooterService } from '../../services/pdf-header-footer.service';

Chart.register(...registerables);

export type DateFilterPreset = 'week' | 'month' | 'quarter' | 'sixmonths' | 'year' | 'all';

export interface ProfitLossRow {
  transaction_date: string;
  reference_number?: string;
  type: 'payment' | 'receipt';
  transtype: string;
  studentOrRecipientId: string;
  studentOrRecipient: string;
  amount: number;
}

@Component({
  selector: 'app-profit-loss',
  templateUrl: './profit-loss.component.html',
  styleUrls: ['./profit-loss.component.css']
})
export class ProfitLossComponent implements OnInit {
  title = 'Profit & Loss';
  payments: Transaction[] = [];
  receipts: Transaction[] = [];
  combinedRows: ProfitLossRow[] = [];
  totalAmount = 0;
  totalSalary = 0;   // kept for backward compatibility; same as totalExpenses
  totalExpenses = 0; // sum of all receipts (Expense + Salary + Refund)
  profitLoss = 0;
  /** Row counts for the active period (after date filter), for summary card context */
  paymentsInCount = 0;
  expensesOutCount = 0;
  isLoading = false;

  dateFilterPresets: { key: DateFilterPreset; label: string }[] = [
    { key: 'week', label: 'This Week' },
    { key: 'month', label: 'This Month' },
    { key: 'quarter', label: 'Last 3 Months' },
    { key: 'sixmonths', label: 'Last 6 Months' },
    { key: 'year', label: 'This Year' },
    { key: 'all', label: 'All Time' }
  ];
  activeDateFilter: DateFilterPreset = 'sixmonths';

  showAnalyticsPopup = false;
  barChartOptions: ChartConfiguration['options'] = {
    responsive: true,
    plugins: { legend: { position: 'bottom' }, title: { display: true, text: 'Amount vs Expenses by Month' } },
    scales: { y: { beginAtZero: true } }
  };
  barChartData: ChartData<'bar'> = { labels: [], datasets: [] };
  barChartType: ChartType = 'bar';
  doughnutChartOptions: ChartConfiguration['options'] = {
    responsive: true,
    plugins: { legend: { position: 'bottom' }, title: { display: true, text: 'Amount vs Expenses' } }
  };
  doughnutChartData: ChartData<'doughnut', number[], string | string[]> = {
    labels: ['Amount (In)', 'Expenses (Out)'],
    datasets: [{ data: [0, 0], backgroundColor: ['#10b981', '#ef4444'] }]
  };
  doughnutChartType: ChartType = 'doughnut';
  lineChartOptions: ChartConfiguration['options'] = {
    responsive: true,
    plugins: { legend: { position: 'bottom' }, title: { display: true, text: 'Profit / Loss by Month' } },
    scales: { y: { beginAtZero: true } }
  };
  lineChartData: ChartData<'line'> = { labels: [], datasets: [] };
  lineChartType: ChartType = 'line';

  constructor(
    private transactionService: TransactionService,
    private toastService: ToastService,
    private loadingService: LoadingService,
    private pdfHeaderFooter: PdfHeaderFooterService
  ) {}

  ngOnInit(): void {
    this.loadData();
  }

  loadData(): void {
    this.isLoading = true;
    this.loadingService.show();
    const paymentTypes = 'Fee,Admission,Opening Balance,Other';
    const receiptTypes = 'Expense,Salary,Refund';

    let loaded = 0;
    const total = 2;
    const done = () => {
      loaded++;
      if (loaded >= total) {
        this.buildCombinedData();
        this.isLoading = false;
        this.loadingService.hide();
      }
    };

    this.transactionService.getTransactions({ transtypes: paymentTypes }).subscribe({
      next: (r) => {
        this.payments = r.success ? (r.data || []) : [];
        done();
      },
      error: () => done()
    });

    this.transactionService.getTransactions({ transtypes: receiptTypes }).subscribe({
      next: (r) => {
        this.receipts = r.success ? (r.data || []) : [];
        done();
      },
      error: () => done()
    });
  }

  /** Coerce API amounts (often strings from MySQL) so card totals sum correctly */
  private txnAmount(v: unknown): number {
    const n = typeof v === 'number' ? v : parseFloat(String(v ?? ''));
    return Number.isFinite(n) ? n : 0;
  }

  private getDateRange(): { start: Date | null; end: Date } {
    const now = new Date();
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
    let start: Date | null = null;
    switch (this.activeDateFilter) {
      case 'week': {
        const d = new Date(now);
        d.setDate(d.getDate() - 7);
        start = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0);
        break;
      }
      case 'month':
        start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);
        break;
      case 'quarter':
        start = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate(), 0, 0, 0);
        break;
      case 'sixmonths':
        start = new Date(now.getFullYear(), now.getMonth() - 6, now.getDate(), 0, 0, 0);
        break;
      case 'year':
        start = new Date(now.getFullYear(), 0, 1, 0, 0, 0);
        break;
      case 'all':
      default:
        break;
    }
    return { start, end };
  }

  private filterByDateRange<T extends { transaction_date?: string }>(list: T[]): T[] {
    const { start, end } = this.getDateRange();
    if (!start) return list;
    return list.filter(t => {
      const dt = t.transaction_date ? new Date(t.transaction_date) : null;
      return !!dt && !isNaN(dt.getTime()) && dt >= start && dt <= end;
    });
  }

  setDateFilter(preset: DateFilterPreset): void {
    this.activeDateFilter = preset;
    this.buildCombinedData();
  }

  private buildCombinedData(): void {
    const filteredPayments = this.filterByDateRange(this.payments);
    const filteredReceipts = this.filterByDateRange(this.receipts);

    this.paymentsInCount = filteredPayments.length;
    this.expensesOutCount = filteredReceipts.length;
    this.totalAmount = filteredPayments.reduce((s, t) => s + this.txnAmount(t.amount), 0);
    this.totalExpenses = filteredReceipts.reduce((s, t) => s + this.txnAmount(t.amount), 0);
    this.totalSalary = this.totalExpenses; // alias for exports/charts that used "salary"
    this.profitLoss = this.totalAmount - this.totalExpenses;

    const paymentRows: ProfitLossRow[] = filteredPayments.map(t => ({
      transaction_date: t.transaction_date || '',
      reference_number: t.reference_number,
      type: 'payment',
      transtype: t.transtype || 'Fee',
      studentOrRecipientId: t.registration_no || '-',
      studentOrRecipient: t.user_name || '-',
      amount: this.txnAmount(t.amount)
    }));

    const receiptRows: ProfitLossRow[] = filteredReceipts.map(t => ({
      transaction_date: t.transaction_date || '',
      reference_number: t.reference_number,
      type: 'receipt',
      transtype: t.transtype || 'Expense',
      studentOrRecipientId: t.registration_no || '-',
      studentOrRecipient: t.user_name || '-',
      amount: this.txnAmount(t.amount)
    }));

    this.combinedRows = [...paymentRows, ...receiptRows].sort((a, b) => {
      const da = new Date(a.transaction_date).getTime();
      const db = new Date(b.transaction_date).getTime();
      return db - da; // newest first
    });
  }

  formatCurrency(v: number): string {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(v);
  }

  /** PDF-safe format (no Unicode ₹) so jsPDF renders correctly */
  formatCurrencyForPDF(v: number): string {
    return 'Rs. ' + new Intl.NumberFormat('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v);
  }

  formatDate(d: string): string {
    if (!d) return '-';
    return new Date(d).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  }

  get isProfit(): boolean {
    return this.profitLoss >= 0;
  }

  downloadPDF(): void {
    this.pdfHeaderFooter.getHeaderFooter().subscribe(({ header, footer }) => {
      const doc = new jsPDF();
      const startY = this.pdfHeaderFooter.addHeader(doc, header);
      doc.text('Profit & Loss Report', 14, startY);

      const summaryData = [
        ['Amount (Payments In)', this.formatCurrencyForPDF(this.totalAmount)],
        ['Expenses (Out)', this.formatCurrencyForPDF(this.totalExpenses)],
        [this.isProfit ? 'Profit' : 'Loss', this.formatCurrencyForPDF(this.isProfit ? this.profitLoss : -this.profitLoss)]
      ];
      autoTable(doc, {
        head: [['Summary', 'Value']],
        body: summaryData,
        theme: 'plain',
        styles: { fontSize: 10 },
        headStyles: { fillColor: [102, 126, 234] },
        startY: startY + 7
      });

      const tableHeaders = [['Date', 'Reference', 'Type', 'Transaction Type', 'Student / Recipient ID', 'Student / Recipient', 'Amount']];
      const tableRows = this.combinedRows.map(r => [
        this.formatDate(r.transaction_date),
        (r.reference_number || '-').substring(0, 12),
        r.type === 'payment' ? 'Payment' : 'Receipt',
        (r.transtype || '-').substring(0, 12),
        (r.studentOrRecipientId || '-').substring(0, 15),
        (r.studentOrRecipient || '-').substring(0, 25),
        (r.type === 'payment' ? '+' : '-') + this.formatCurrencyForPDF(r.amount)
      ]);
      autoTable(doc, {
        head: tableHeaders,
        body: tableRows,
        theme: 'striped',
        styles: { fontSize: 8 },
        headStyles: { fillColor: [102, 126, 234] },
        startY: (doc as any).lastAutoTable.finalY + 15
      });

      this.pdfHeaderFooter.addFooter(doc, footer);
      doc.save(`Profit_Loss_${new Date().getTime()}.pdf`);
      this.toastService.success('PDF downloaded');
    });
  }

  downloadExcel(): void {
    const summaryData = [
      ['Profit & Loss Report'],
      [],
      ['Amount (Payments In)', this.totalAmount],
      ['Expenses (Out)', this.totalExpenses],
      [this.isProfit ? 'Profit' : 'Loss', this.isProfit ? this.profitLoss : -this.profitLoss],
      []
    ];
    const headers = ['Date', 'Reference', 'Type', 'Transaction Type', 'Student / Recipient ID', 'Student / Recipient', 'Amount'];
    const rows = this.combinedRows.map(r => [
      this.formatDate(r.transaction_date),
      r.reference_number || '-',
      r.type === 'payment' ? 'Payment' : 'Receipt',
      r.transtype || '-',
      r.studentOrRecipientId || '-',
      r.studentOrRecipient || '-',
      (r.type === 'payment' ? 1 : -1) * r.amount
    ]);
    const ws = XLSX.utils.aoa_to_sheet([...summaryData, headers, ...rows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Profit & Loss');
    XLSX.writeFile(wb, `Profit_Loss_${new Date().getTime()}.xlsx`);
    this.toastService.success('Excel downloaded');
  }

  openAnalyticsPopup(): void {
    this.buildCharts();
    this.showAnalyticsPopup = true;
  }

  closeAnalyticsPopup(): void {
    this.showAnalyticsPopup = false;
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.showAnalyticsPopup) this.closeAnalyticsPopup();
  }

  private buildCharts(): void {
    const filteredPayments = this.filterByDateRange(this.payments);
    const filteredReceipts = this.filterByDateRange(this.receipts);

    const now = new Date();
    const monthCount = this.activeDateFilter === 'all' || this.activeDateFilter === 'year' ? 12 : 6;
    const months: string[] = [];
    for (let i = monthCount - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push(d.toLocaleString('default', { month: 'short' }) + ' ' + d.getFullYear());
    }

    const payByMonth = this.groupByMonth(filteredPayments, months, now);
    const expensesByMonth = this.groupByMonth(filteredReceipts, months, now);
    this.barChartData = {
      labels: months,
      datasets: [
        { label: 'Amount (₹)', data: payByMonth, backgroundColor: '#10b981' },
        { label: 'Expenses (₹)', data: expensesByMonth, backgroundColor: '#ef4444' }
      ]
    };

    const totalPay = filteredPayments.reduce((s, t) => s + this.txnAmount(t.amount), 0);
    const totalExp = filteredReceipts.reduce((s, t) => s + this.txnAmount(t.amount), 0);
    this.doughnutChartData = {
      labels: ['Amount (In)', 'Expenses (Out)'],
      datasets: [{ data: [totalPay || 0.01, totalExp || 0.01], backgroundColor: ['#10b981', '#ef4444'] }]
    };

    const profitByMonth = months.map((_, i) => payByMonth[i] - expensesByMonth[i]);
    this.lineChartData = {
      labels: months,
      datasets: [{
        label: 'Profit / Loss (₹)',
        data: profitByMonth,
        borderColor: '#667eea',
        backgroundColor: 'rgba(102, 126, 234, 0.2)',
        tension: 0.4,
        fill: true
      }]
    };
  }

  private groupByMonth(list: Transaction[], months: string[], now: Date): number[] {
    const monthCount = months.length;
    return months.map((_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (monthCount - 1 - i), 1);
      const next = new Date(d.getFullYear(), d.getMonth() + 1, 1);
      return list
        .filter(t => {
          const dt = t.transaction_date ? new Date(t.transaction_date) : null;
          return dt && dt >= d && dt < next;
        })
        .reduce((s, t) => s + this.txnAmount(t.amount), 0);
    });
  }
}
