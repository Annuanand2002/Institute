import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { CourseService, Course } from '../../services/course.service';
import { ToastService } from '../../services/toast.service';
import { LoadingService } from '../../services/loading.service';
import { PdfHeaderFooterService } from '../../services/pdf-header-footer.service';

@Component({
  selector: 'app-course-table',
  templateUrl: './course-table.component.html',
  styleUrls: ['./course-table.component.css']
})
export class CourseTableComponent implements OnInit {
  allCourses: Course[] = [];
  filteredCourses: Course[] = [];
  searchQuery = '';
  currentPage = 1;
  itemsPerPage = 10;
  sortColumn: string | null = null;
  sortDirection: 'asc' | 'desc' = 'asc';

  constructor(
    private router: Router,
    private courseService: CourseService,
    private toastService: ToastService,
    private loadingService: LoadingService,
    private pdfHeaderFooter: PdfHeaderFooterService
  ) {}

  ngOnInit(): void {
    this.loadData();
  }

  loadData(): void {
    this.loadingService.show();
    this.courseService.getCourses().subscribe({
      next: (response) => {
        if (response.success) {
          this.allCourses = response.data;
          this.filteredCourses = [...this.allCourses];
        }
        this.loadingService.hide();
      },
      error: (err) => {
        this.toastService.error(err?.error?.error || 'Failed to load courses');
        this.loadingService.hide();
      }
    });
  }

  onSearch(): void {
    if (!this.searchQuery.trim()) {
      this.filteredCourses = [...this.allCourses];
      this.currentPage = 1;
      return;
    }
    const query = this.searchQuery.toLowerCase();
    this.filteredCourses = this.allCourses.filter(c =>
      (c.course_code || '').toLowerCase().includes(query) ||
      (c.course_name || '').toLowerCase().includes(query) ||
      (c.batch_name || '').toLowerCase().includes(query)
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
    this.filteredCourses.sort((a, b) => {
      const aVal = (a as any)[column] ?? '';
      const bVal = (b as any)[column] ?? '';
      if (aVal < bVal) return this.sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return this.sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }

  get paginatedCourses(): Course[] {
    const start = (this.currentPage - 1) * this.itemsPerPage;
    return this.filteredCourses.slice(start, start + this.itemsPerPage);
  }

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.filteredCourses.length / this.itemsPerPage));
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

  downloadCSV(): void {
    const headers = ['Course Code', 'Course Name', 'Batch', 'Duration', 'Fee', 'Status'];
    const rows = this.filteredCourses.map(c => [
      c.course_code || '',
      c.course_name || '',
      c.batch_name || '',
      c.duration || '',
      c.total_fee ?? '',
      c.is_active ? 'Active' : 'Inactive'
    ]);
    const csvContent = [headers.join(','), ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `courses_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
    this.toastService.success('CSV downloaded');
  }

  downloadPDF(): void {
    this.pdfHeaderFooter.getHeaderFooter().subscribe(({ header, footer }) => {
      const doc = new jsPDF();
      const startY = this.pdfHeaderFooter.addHeader(doc, header);
      const headers = [['Course Code', 'Course Name', 'Batch', 'Fee', 'Status']];
      const rows = this.filteredCourses.map(c => [
        (c.course_code || '').substring(0, 12),
        (c.course_name || '').substring(0, 25),
        (c.batch_name || '').substring(0, 12),
        c.total_fee ?? '',
        c.is_active ? 'Active' : 'Inactive'
      ]);
      doc.text('Course Management', 14, startY);
      autoTable(doc, { head: headers, body: rows, theme: 'striped', styles: { fontSize: 9 }, headStyles: { fillColor: [102, 126, 234] }, startY: startY + 7 });
      this.pdfHeaderFooter.addFooter(doc, footer);
      doc.save(`Courses_${new Date().getTime()}.pdf`);
      this.toastService.success('PDF downloaded');
    });
  }

  downloadExcel(): void {
    const headers = ['Course Code', 'Course Name', 'Batch', 'Duration', 'Fee', 'Status'];
    const rows = this.filteredCourses.map(c => [
      c.course_code || '',
      c.course_name || '',
      c.batch_name || '',
      c.duration || '',
      c.total_fee ?? '',
      c.is_active ? 'Active' : 'Inactive'
    ]);
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Courses');
    XLSX.writeFile(wb, `Courses_${new Date().getTime()}.xlsx`);
    this.toastService.success('Excel downloaded');
  }

  addNew(): void {
    this.router.navigate(['/dashboard/staff/course/create']);
  }

  editCourse(course: Course): void {
    if (course.id) this.router.navigate(['/dashboard/staff/course/edit', course.id]);
  }

  deleteCourse(course: Course): void {
    if (!course.id) return;
    if (confirm(`Are you sure you want to delete "${course.course_name}"?`)) {
      this.loadingService.show();
      this.courseService.deleteCourse(course.id).subscribe({
        next: (response) => {
          if (response.success) {
            this.toastService.success('Course deleted successfully');
            this.loadData();
          }
          this.loadingService.hide();
        },
        error: (err) => {
          this.toastService.error(err?.error?.error || 'Failed to delete course');
          this.loadingService.hide();
        }
      });
    }
  }
}
