import { Component, OnInit } from '@angular/core';
import { ChartConfiguration, ChartData, ChartType } from 'chart.js';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { UserService, User, StudentMonthlyDueResponse } from '../../services/user.service';
import { TransactionService } from '../../services/transaction.service';
import { ToastService } from '../../services/toast.service';
import { LoadingService } from '../../services/loading.service';
import { PdfHeaderFooterService } from '../../services/pdf-header-footer.service';

@Component({
  selector: 'app-student-report',
  templateUrl: './student-report.component.html',
  styleUrls: ['./student-report.component.css']
})
export class StudentReportComponent implements OnInit {
  allStudents: User[] = [];
  filteredStudents: User[] = [];
  searchQuery = '';
  currentPage = 1;
  itemsPerPage = 10;
  sortColumn: string | null = null;
  sortDirection: 'asc' | 'desc' = 'asc';
  isLoading = false;
  /** Payment month range (YYYY-MM); both required to filter by Fee in those calendar months. */
  paymentFilterMonthFrom = '';
  paymentFilterMonthTo = '';
  /** Months used for the last successful load (for subtitle), YYYY-MM. */
  reportPaymentMonthFrom: string | null = null;
  reportPaymentMonthTo: string | null = null;

  isDueModalOpen = false;
  isDueModalLoading = false;
  dueModalStudent: User | null = null;
  dueModalData: StudentMonthlyDueResponse | null = null;

  // Analytics chart for report (due amount by course)
  isAnalyticsOpen = false;
  reportChartOptions: ChartConfiguration['options'] = {
    responsive: true,
    plugins: {
      legend: { position: 'bottom' },
      title: { display: true, text: 'Total Due Amount by Course' }
    },
    scales: { y: { beginAtZero: true } }
  };
  reportChartType: ChartType = 'bar';
  reportChartData: ChartData<'bar'> = {
    labels: [],
    datasets: [{ label: 'Total due (₹)', data: [], backgroundColor: '#667eea' }]
  };

  constructor(
    private userService: UserService,
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
    const monthFrom = this.paymentFilterMonthFrom?.trim();
    const monthTo = this.paymentFilterMonthTo?.trim();
    const params =
      monthFrom && monthTo ? { month_from: monthFrom, month_to: monthTo } : undefined;
    this.userService.getStudentReport(params).subscribe({
      next: (response) => {
        if (response.success) {
          this.allStudents = Array.isArray(response.data) ? response.data : [];
          this.filteredStudents = [...this.allStudents];
          if (params) {
            this.reportPaymentMonthFrom = params.month_from;
            this.reportPaymentMonthTo = params.month_to;
          } else {
            this.reportPaymentMonthFrom = null;
            this.reportPaymentMonthTo = null;
          }
          if (this.searchQuery.trim()) {
            this.onSearch();
          }
        }
        this.isLoading = false;
        this.loadingService.hide();
      },
      error: (err) => {
        this.toastService.error(err?.error?.error || 'Failed to load students');
        this.isLoading = false;
        this.loadingService.hide();
      }
    });
  }

  applyPaymentMonthFilter(): void {
    const from = this.paymentFilterMonthFrom?.trim();
    const to = this.paymentFilterMonthTo?.trim();
    if (!from || !to) {
      this.toastService.error('Select both from and to months to filter by payments');
      return;
    }
    if (from > to) {
      this.toastService.error('From month must be on or before to month');
      return;
    }
    this.loadData();
  }

  clearPaymentMonthFilter(): void {
    this.paymentFilterMonthFrom = '';
    this.paymentFilterMonthTo = '';
    this.loadData();
  }

  /** Display YYYY-MM as e.g. "January 2026". */
  formatMonthLabel(ym: string): string {
    const [y, m] = ym.split('-').map(Number);
    if (!y || !m || m < 1 || m > 12) return ym;
    return new Date(y, m - 1, 1).toLocaleString('en-IN', { month: 'long', year: 'numeric' });
  }

  onSearch(): void {
    if (!this.searchQuery.trim()) {
      this.filteredStudents = [...this.allStudents];
      this.currentPage = 1;
      return;
    }
    const query = this.searchQuery.toLowerCase();
    this.filteredStudents = this.allStudents.filter(s =>
      (s.name || '').toLowerCase().includes(query) ||
      (s.registration_no || '').toLowerCase().includes(query) ||
      (s.course_name || '').toLowerCase().includes(query) ||
      (s.batch_name || '').toLowerCase().includes(query)
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
    this.filteredStudents.sort((a, b) => {
      const aVal = (a as any)[column] ?? '';
      const bVal = (b as any)[column] ?? '';
      if (aVal < bVal) return this.sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return this.sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }

  get paginatedStudents(): User[] {
    const start = (this.currentPage - 1) * this.itemsPerPage;
    return this.filteredStudents.slice(start, start + this.itemsPerPage);
  }

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.filteredStudents.length / this.itemsPerPage));
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

  openAnalytics(): void {
    // Group due_amount by course for current filtered list
    const byCourse = new Map<string, number>();
    for (const s of this.filteredStudents) {
      const course = (s.course_name || 'No course').trim() || 'No course';
      const due = s.due_amount ?? 0;
      byCourse.set(course, (byCourse.get(course) || 0) + due);
    }
    const labels = Array.from(byCourse.keys());
    const data = labels.map(l => Math.round((byCourse.get(l) || 0) * 100) / 100);

    this.reportChartData = {
      labels,
      datasets: [
        {
          label: 'Total due (₹)',
          data,
          backgroundColor: '#667eea'
        }
      ]
    };
    this.isAnalyticsOpen = true;
  }

  closeAnalytics(): void {
    this.isAnalyticsOpen = false;
  }

  downloadCSV(): void {
    const headers = ['Student ID (Reg No)', 'Student Name', 'Course Name', 'Batch', 'Overall due amount'];
    const rows = this.filteredStudents.map(s => [
      (s.registration_no || (s as any).student_id) ?? '',
      s.name || '',
      s.course_name || '-',
      s.batch_name || '-',
      (s.due_amount ?? 0)
    ]);
    const csvContent = [headers.join(','), ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `students_report_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
    this.toastService.success('CSV downloaded');
  }

  downloadPDF(): void {
    this.pdfHeaderFooter.getHeaderFooter().subscribe(({ header, footer }) => {
      const doc = new jsPDF();
      const startY = this.pdfHeaderFooter.addHeader(doc, header);
      const headers = [['Student ID', 'Student Name', 'Course Name', 'Batch', 'Overall due amount']];
      const rows = this.filteredStudents.map(s => [
        (s.registration_no || '').substring(0, 15),
        (s.name || '').substring(0, 25),
        (s.course_name || '-').substring(0, 20),
        (s.batch_name || '-').substring(0, 18),
        String(s.due_amount ?? 0)
      ]);
      doc.text('Student Report – Overall due amount', 14, startY);
      autoTable(doc, {
        head: headers,
        body: rows,
        theme: 'striped',
        styles: { fontSize: 9 },
        headStyles: { fillColor: [102, 126, 234] },
        startY: startY + 7
      });
      this.pdfHeaderFooter.addFooter(doc, footer);
      doc.save(`Student_Report_${new Date().getTime()}.pdf`);
      this.toastService.success('PDF downloaded');
    });
  }

  downloadExcel(): void {
    const headers = ['Student ID (Reg No)', 'Student Name', 'Course Name', 'Batch', 'Overall due amount'];
    const rows = this.filteredStudents.map(s => [
      (s.registration_no || (s as any).student_id) ?? '',
      s.name || '',
      s.course_name || '-',
      s.batch_name || '-',
      (s.due_amount ?? 0)
    ]);
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Students');
    XLSX.writeFile(wb, `student_report_${new Date().getTime()}.xlsx`);
    this.toastService.success('Excel downloaded');
  }

  openMonthlyDue(student: User): void {
    const id = Number(student.id ?? (student as any).student_id);
    if (!id || Number.isNaN(id)) return;

    this.isDueModalOpen = true;
    this.isDueModalLoading = true;
    this.dueModalStudent = student;
    this.dueModalData = null;

    this.userService.getStudentMonthlyDue(id).subscribe({
      next: (resp) => {
        if (resp.success) {
          this.dueModalData = resp.data;
        } else {
          this.toastService.error('Failed to load monthly due details');
          this.isDueModalOpen = false;
        }
        this.isDueModalLoading = false;
      },
      error: (err) => {
        this.toastService.error(err?.error?.error || 'Failed to load monthly due details');
        this.isDueModalLoading = false;
      }
    });
  }

  closeDueModal(): void {
    this.isDueModalOpen = false;
    this.isDueModalLoading = false;
    this.dueModalStudent = null;
    this.dueModalData = null;
  }

  printDueModal(): void {
    const studentName = this.dueModalData?.name || this.dueModalStudent?.name || '-';
    const regNo = this.dueModalData?.registration_no || this.dueModalStudent?.registration_no || '-';
    const monthlyAmount = this.dueModalData?.monthly_amount ?? 0;
    const months = this.dueModalData?.months || [];

    this.pdfHeaderFooter.getHeaderFooter().subscribe(({ header, footer }) => {
      const doc = new jsPDF();
      const startY = this.pdfHeaderFooter.addHeader(doc, header);
      doc.text('Student Monthly Due Details', 14, startY);
      doc.setFontSize(10);
      doc.text(`${studentName} (${regNo})`, 14, startY + 6);
      doc.text(`Monthly installment: ${monthlyAmount}`, 14, startY + 12);

      const rows = months.map(m => [m.month, m.status, String(m.paid_amount), String(m.due_amount)]);
      autoTable(doc, {
        head: [['Month', 'Status', 'Paid', 'Due']],
        body: rows.length ? rows : [['-', '-', '0', '0']],
        theme: 'striped',
        styles: { fontSize: 9 },
        headStyles: { fillColor: [102, 126, 234] },
        startY: startY + 17
      });

      this.pdfHeaderFooter.addFooter(doc, footer);
      const safe = (studentName || 'student').replace(/[^a-z0-9]+/gi, '_');
      doc.save(`Student_Monthly_Due_${safe}.pdf`);
      this.toastService.success('Monthly due print downloaded');
    });
  }

  printStudentPayments(student: User): void {
    const id = Number(student.id ?? (student as any).student_id);
    if (!id || Number.isNaN(id)) return;

    this.loadingService.show();
    this.transactionService.getTransactions({
      user_id: id,
      transtypes: 'Fee,Admission,Opening Balance,Other'
    }).subscribe({
      next: (response) => {
        this.loadingService.hide();
        const txns = response.success ? (response.data || []) : [];
        this.pdfHeaderFooter.getHeaderFooter().subscribe(({ header, footer }) => {
          const doc = new jsPDF();
          const startY = this.pdfHeaderFooter.addHeader(doc, header);
          doc.text(`Student Payment Details`, 14, startY);
          doc.setFontSize(10);
          doc.text(`${student.name || '-'} (${student.registration_no || '-'})`, 14, startY + 6);

          const headers = [['Date', 'Reference', 'Mode', 'Type', 'Amount', 'Remarks']];
          const rows = txns.map(t => [
            t.transaction_date ? new Date(t.transaction_date).toLocaleDateString('en-IN') : '-',
            (t.reference_number || '-').substring(0, 12),
            (t.payment_mode || '-').substring(0, 10),
            (t.transtype || '-').substring(0, 15),
            String(t.amount ?? 0),
            (t.remarks || '-').substring(0, 22)
          ]);

          autoTable(doc, {
            head: headers,
            body: rows.length ? rows : [['-', '-', '-', '-', '0', 'No payments found']],
            theme: 'striped',
            styles: { fontSize: 8 },
            headStyles: { fillColor: [102, 126, 234] },
            startY: startY + 10
          });

          this.pdfHeaderFooter.addFooter(doc, footer);
          const safe = (student.name || 'student').replace(/[^a-z0-9]+/gi, '_');
          doc.save(`Student_Payments_${safe}.pdf`);
          this.toastService.success('Student payment print downloaded');
        });
      },
      error: (err) => {
        this.loadingService.hide();
        this.toastService.error(err?.error?.error || 'Failed to load student payments');
      }
    });
  }
}

