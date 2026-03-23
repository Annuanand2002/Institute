import { Component, HostListener, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { ChartConfiguration, ChartData, ChartType } from 'chart.js';
import { Chart, registerables } from 'chart.js';
import { UserService, User } from '../services/user.service';
import { CourseService, Course } from '../services/course.service';
import { BatchService } from '../services/batch.service';
import { TransactionService, Transaction } from '../services/transaction.service';
import { ToastService } from '../services/toast.service';
import { LoadingService } from '../services/loading.service';

Chart.register(...registerables);

export type DateFilterPreset = 'week' | 'month' | 'quarter' | 'sixmonths' | 'year' | 'all';

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css']
})
export class DashboardComponent implements OnInit {
  stats: { label: string; value: string | number; icon: string; color: string }[] = [];
  students: User[] = [];
  staff: User[] = [];
  courses: Course[] = [];
  batches: any[] = [];
  payments: Transaction[] = [];
  receipts: Transaction[] = [];
  recentTransactions: Transaction[] = [];
  /** Student report data for due amount analytics */
  studentReport: User[] = [];

  dateFilterPresets: { key: DateFilterPreset; label: string }[] = [
    { key: 'week', label: 'This Week' },
    { key: 'month', label: 'This Month' },
    { key: 'quarter', label: 'Last 3 Months' },
    { key: 'sixmonths', label: 'Last 6 Months' },
    { key: 'year', label: 'This Year' },
    { key: 'all', label: 'All Time' }
  ];
  activeDateFilter: DateFilterPreset = 'sixmonths';
  studentsByCourse: { name: string; count: number }[] = [];
  monthlyPayments: { month: string; amount: number }[] = [];
  monthlyReceipts: { month: string; amount: number }[] = [];

  pieChartOptions: ChartConfiguration['options'] = {
    responsive: true,
    plugins: {
      legend: { position: 'bottom' },
      title: { display: true, text: 'Students by Course' }
    }
  };
  pieChartData: ChartData<'pie', number[], string | string[]> = {
    labels: [],
    datasets: [{ data: [], backgroundColor: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4'] }]
  };
  pieChartType: ChartType = 'pie';

  barChartOptions: ChartConfiguration['options'] = {
    responsive: true,
    plugins: {
      legend: { position: 'bottom' },
      title: { display: true, text: 'Payments vs Receipts (Last 6 Months)' }
    },
    scales: { y: { beginAtZero: true } }
  };
  barChartData: ChartData<'bar'> = {
    labels: [],
    datasets: [
      { label: 'Payments (₹)', data: [], backgroundColor: '#10b981' },
      { label: 'Receipts (₹)', data: [], backgroundColor: '#ef4444' }
    ]
  };
  barChartType: ChartType = 'bar';

  doughnutChartOptions: ChartConfiguration['options'] = {
    responsive: true,
    plugins: {
      legend: { position: 'bottom' },
      title: { display: true, text: 'Revenue Overview' }
    }
  };
  doughnutChartData: ChartData<'doughnut', number[], string | string[]> = {
    labels: ['Total Payments', 'Total Receipts'],
    datasets: [{ data: [0, 0], backgroundColor: ['#10b981', '#ef4444'] }]
  };
  doughnutChartType: ChartType = 'doughnut';

  lineChartOptions: ChartConfiguration['options'] = {
    responsive: true,
    plugins: {
      legend: { position: 'bottom' },
      title: { display: true, text: 'Student & Staff Count' }
    },
    scales: { y: { beginAtZero: true } }
  };
  lineChartData: ChartData<'line'> = {
    labels: ['Students', 'Staff'],
    datasets: [
      { label: 'Count', data: [0, 0], borderColor: '#667eea', backgroundColor: 'rgba(102, 126, 234, 0.2)', tension: 0.4, fill: true }
    ]
  };
  lineChartType: ChartType = 'line';

  // Student due amount by course (for dashboard + popup)
  studentDueChartOptions: ChartConfiguration['options'] = {
    responsive: true,
    plugins: {
      legend: { position: 'bottom' },
      title: { display: true, text: 'Student Due Amount by Course' }
    },
    scales: { y: { beginAtZero: true } }
  };
  studentDueChartData: ChartData<'bar'> = {
    labels: [],
    datasets: [{ label: 'Total due (₹)', data: [], backgroundColor: '#f97316' }]
  };
  studentDueChartType: ChartType = 'bar';

  /** Options for charts when shown in the popup (larger size) */
  pieChartOptionsPopup: ChartConfiguration['options'] = {
    responsive: true,
    maintainAspectRatio: true,
    aspectRatio: 1.2,
    plugins: {
      legend: { position: 'bottom' },
      title: { display: false }
    }
  };
  barChartOptionsPopup: ChartConfiguration['options'] = {
    responsive: true,
    maintainAspectRatio: true,
    aspectRatio: 1.5,
    plugins: {
      legend: { position: 'bottom' },
      title: { display: false }
    },
    scales: { y: { beginAtZero: true } }
  };
  doughnutChartOptionsPopup: ChartConfiguration['options'] = {
    responsive: true,
    maintainAspectRatio: true,
    aspectRatio: 1.2,
    plugins: {
      legend: { position: 'bottom' },
      title: { display: false }
    }
  };
  lineChartOptionsPopup: ChartConfiguration['options'] = {
    responsive: true,
    maintainAspectRatio: true,
    aspectRatio: 1.5,
    plugins: {
      legend: { position: 'bottom' },
      title: { display: false }
    },
    scales: { y: { beginAtZero: true } }
  };

  chartPopup: 'pie' | 'bar' | 'doughnut' | 'line' | null = null;
  isLoading = true;

  constructor(
    private router: Router,
    private userService: UserService,
    private courseService: CourseService,
    private batchService: BatchService,
    private transactionService: TransactionService,
    private toastService: ToastService,
    private loadingService: LoadingService
  ) {}

  ngOnInit(): void {
    this.isLoading = true;
    this.loadingService.show();
    this.loadAllData();
  }

  private loadAllData(options?: { minDisplayMs?: number }): void {
    const paymentTypes = 'Fee,Admission';
    const receiptTypes = 'Expense,Salary,Refund';
    let loaded = 0;
    const total = 8;
    const startTime = Date.now();
    const minDisplayMs = options?.minDisplayMs ?? 0;

    const hideLoader = () => {
      const elapsed = Date.now() - startTime;
      const remaining = minDisplayMs > 0 ? Math.max(0, minDisplayMs - elapsed) : 0;
      if (remaining > 0) {
        setTimeout(() => {
          this.isLoading = false;
          this.loadingService.hide();
        }, remaining);
      } else {
        this.isLoading = false;
        this.loadingService.hide();
      }
    };

    const done = () => {
      loaded++;
      this.updateDashboard();
      if (loaded >= total) {
        hideLoader();
      }
    };

    this.userService.getUsers({ role: 'Student', is_active: true }).subscribe({
      next: (r) => { this.students = r.success ? (r.data || []) : []; done(); },
      error: () => done()
    });
    this.userService.getUsers({ role: 'Staff', is_active: true }).subscribe({
      next: (r) => { this.staff = r.success ? (r.data || []) : []; done(); },
      error: () => done()
    });
    this.courseService.getCourses().subscribe({
      next: (r) => { this.courses = r.success ? (r.data || []) : []; done(); },
      error: () => done()
    });
    this.batchService.getBatches().subscribe({
      next: (r) => { this.batches = r.success ? (r.data || []) : []; done(); },
      error: () => done()
    });
    this.transactionService.getTransactions({ transtypes: paymentTypes }).subscribe({
      next: (r) => { this.payments = r.success ? (r.data || []) : []; done(); },
      error: () => done()
    });
    this.transactionService.getTransactions({ transtypes: receiptTypes }).subscribe({
      next: (r) => { this.receipts = r.success ? (r.data || []) : []; done(); },
      error: () => done()
    });
    this.transactionService.getTransactions().subscribe({
      next: (r) => {
        this.recentTransactions = (r.success ? (r.data || []) : []).slice(0, 8);
        done();
      },
      error: () => done()
    });
    this.userService.getStudentReport().subscribe({
      next: (r) => {
        this.studentReport = r.success && Array.isArray(r.data) ? r.data : [];
        done();
      },
      error: () => done()
    });
  }

  private updateDashboard(): void {
    this.buildStats();
    this.buildCharts();
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
      case 'month': {
        start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);
        break;
      }
      case 'quarter': {
        start = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate(), 0, 0, 0);
        break;
      }
      case 'sixmonths': {
        start = new Date(now.getFullYear(), now.getMonth() - 6, now.getDate(), 0, 0, 0);
        break;
      }
      case 'year': {
        start = new Date(now.getFullYear(), 0, 1, 0, 0, 0);
        break;
      }
      case 'all':
      default:
        break;
    }
    return { start, end };
  }

  filterByDateRange<T extends { transaction_date?: string }>(list: T[]): T[] {
    const { start } = this.getDateRange();
    if (!start) return list;
    return list.filter(t => {
      const dt = t.transaction_date ? new Date(t.transaction_date) : null;
      return dt && dt >= start;
    });
  }

  setDateFilter(preset: DateFilterPreset): void {
    this.activeDateFilter = preset;
    this.updateDashboard();
  }

  refreshData(): void {
    this.isLoading = true;
    this.loadingService.show();
    this.loadAllData({ minDisplayMs: 2500 });
  }

  get filteredRecentTransactions(): Transaction[] {
    return this.filterByDateRange(this.recentTransactions).slice(0, 8);
  }

  private buildStats(): void {
    const filteredPayments = this.filterByDateRange(this.payments);
    const filteredReceipts = this.filterByDateRange(this.receipts);
    const totalPayments = filteredPayments.reduce((s, t) => s + (t.amount || 0), 0);
    const totalReceipts = filteredReceipts.reduce((s, t) => s + (t.amount || 0), 0);
    const activeCourses = this.courses.filter(c => c.is_active !== false).length;

    this.stats = [
      { label: 'Total Students', value: this.students.length, icon: '👥', color: '#3b82f6' },
      { label: 'Total Staff', value: this.staff.length, icon: '👨‍🏫', color: '#10b981' },
      { label: 'Active Courses', value: activeCourses, icon: '📚', color: '#f59e0b' },
      { label: 'Batches', value: this.batches.length, icon: '📦', color: '#8b5cf6' },
      { label: 'Total Payments', value: this.formatCurrency(totalPayments), icon: '💰', color: '#10b981' },
      { label: 'Total Receipts', value: this.formatCurrency(totalReceipts), icon: '📤', color: '#ef4444' },
      { label: 'Net Balance', value: this.formatCurrency(totalPayments - totalReceipts), icon: '📊', color: totalPayments >= totalReceipts ? '#10b981' : '#ef4444' }
    ];
  }

  private buildCharts(): void {
    const filteredPayments = this.filterByDateRange(this.payments);
    const filteredReceipts = this.filterByDateRange(this.receipts);
    const pieColors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4'];
    const courseCounts: { [key: string]: number } = {};
    this.students.forEach(s => {
      const name = s.course_name || 'No Course';
      courseCounts[name] = (courseCounts[name] || 0) + 1;
    });
    this.studentsByCourse = Object.entries(courseCounts).map(([name, count]) => ({ name, count }));
    const pieLabels = this.studentsByCourse.length ? this.studentsByCourse.map(x => x.name) : ['No data'];
    const pieValues = this.studentsByCourse.length ? this.studentsByCourse.map(x => x.count) : [1];
    this.pieChartData = {
      labels: pieLabels,
      datasets: [{ data: pieValues, backgroundColor: pieColors }]
    };

    const now = new Date();
    const monthCount = this.activeDateFilter === 'all' || this.activeDateFilter === 'year' ? 12 : 6;
    const months: string[] = [];
    for (let i = monthCount - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push(d.toLocaleString('default', { month: 'short' }) + ' ' + d.getFullYear());
    }
    const payByMonth = this.groupByMonth(filteredPayments, months, now);
    const recByMonth = this.groupByMonth(filteredReceipts, months, now);
    this.barChartData = {
      labels: months,
      datasets: [
        { label: 'Payments (₹)', data: payByMonth, backgroundColor: '#10b981' },
        { label: 'Receipts (₹)', data: recByMonth, backgroundColor: '#ef4444' }
      ]
    };

    const totalPayments = filteredPayments.reduce((s, t) => s + (t.amount || 0), 0);
    const totalReceipts = filteredReceipts.reduce((s, t) => s + (t.amount || 0), 0);
    this.doughnutChartData = {
      labels: ['Total Payments', 'Total Receipts'],
      datasets: [{ data: [totalPayments || 0.01, totalReceipts || 0.01], backgroundColor: ['#10b981', '#ef4444'] }]
    };

    this.lineChartData = {
      labels: ['Students', 'Staff'],
      datasets: [
        {
          label: 'Count',
          data: [this.students.length, this.staff.length],
          borderColor: '#667eea',
          backgroundColor: 'rgba(102, 126, 234, 0.2)',
          tension: 0.4,
          fill: true
        }
      ]
    };

    // Student due by course (from studentReport)
    const byCourse = new Map<string, number>();
    for (const s of this.studentReport || []) {
      const course = (s.course_name || 'No course').trim() || 'No course';
      const due = s.due_amount ?? 0;
      byCourse.set(course, (byCourse.get(course) || 0) + due);
    }
    const labels = Array.from(byCourse.keys());
    const data = labels.map(l => Math.round((byCourse.get(l) || 0) * 100) / 100);
    this.studentDueChartData = {
      labels,
      datasets: [
        {
          label: 'Total due (₹)',
          data,
          backgroundColor: '#f97316'
        }
      ]
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
        .reduce((s, t) => s + (t.amount || 0), 0);
    });
  }

  formatCurrency(v: number): string {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v);
  }

  formatDate(d: string): string {
    if (!d) return '-';
    return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  navigateTo(route: string): void {
    this.router.navigate([route]);
  }

  openChartPopup(chart: 'pie' | 'bar' | 'doughnut' | 'line'): void {
    this.chartPopup = chart;
  }

  closeChartPopup(): void {
    this.chartPopup = null;
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.chartPopup) this.closeChartPopup();
  }
}
