import { Component, OnInit } from '@angular/core';
import { ChartConfiguration, ChartData, ChartType } from 'chart.js';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { UserService, User, StudentMonthlyDueResponse } from '../../services/user.service';
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
  /** Current month label for report (e.g. "2025-03") */

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
    this.userService.getStudentReport().subscribe({
      next: (response) => {
        if (response.success) {
          this.allStudents = Array.isArray(response.data) ? response.data : [];
          this.filteredStudents = [...this.allStudents];
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
      (s.course_name || '').toLowerCase().includes(query)
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
    const headers = ['Student ID (Reg No)', 'Student Name', 'Course Name', 'Overall due amount'];
    const rows = this.filteredStudents.map(s => [
      (s.registration_no || (s as any).student_id) ?? '',
      s.name || '',
      s.course_name || '-',
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
      const headers = [['Student ID', 'Student Name', 'Course Name', 'Overall due amount']];
      const rows = this.filteredStudents.map(s => [
        (s.registration_no || '').substring(0, 15),
        (s.name || '').substring(0, 25),
        (s.course_name || '-').substring(0, 20),
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
    const headers = ['Student ID (Reg No)', 'Student Name', 'Course Name', 'Overall due amount'];
    const rows = this.filteredStudents.map(s => [
      (s.registration_no || (s as any).student_id) ?? '',
      s.name || '',
      s.course_name || '-',
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
}

