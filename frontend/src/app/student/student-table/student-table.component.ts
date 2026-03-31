import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { UserService, User } from '../../services/user.service';
import { ToastService } from '../../services/toast.service';
import { LoadingService } from '../../services/loading.service';
import { PdfHeaderFooterService } from '../../services/pdf-header-footer.service';

@Component({
  selector: 'app-student-table',
  templateUrl: './student-table.component.html',
  styleUrls: ['./student-table.component.css']
})
export class StudentTableComponent implements OnInit {
  allStudents: User[] = [];
  filteredStudents: User[] = [];
  searchQuery = '';
  currentPage = 1;
  itemsPerPage = 10;
  sortColumn: string | null = null;
  sortDirection: 'asc' | 'desc' = 'asc';
  isLoading = false;

  constructor(
    private router: Router,
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
    // Management view: show all students (active + inactive)
    this.userService.getUsers({ role: 'Student' }).subscribe({
      next: (response) => {
        if (response.success) {
          // Normalise is_active from backend into a strict boolean
          this.allStudents = (response.data || []).map(s => ({
            ...s,
            is_active: s.is_active === true || (s as any).is_active === 1
          }));
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
      (s.email || '').toLowerCase().includes(query) ||
      (s.personal_number || '').includes(query) ||
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

  downloadCSV(): void {
    const headers = ['Reg No', 'Name', 'Email', 'Phone', 'Course', 'Status'];
    const rows = this.filteredStudents.map(s => [
      s.registration_no || '',
      s.name || '',
      s.email || '',
      s.personal_number || '',
      s.course_name || '',
      s.is_active !== false ? 'Active' : 'Inactive'
    ]);
    const csvContent = [headers.join(','), ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `students_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
    this.toastService.success('CSV downloaded');
  }

  downloadPDF(): void {
    this.pdfHeaderFooter.getHeaderFooter().subscribe(({ header, footer }) => {
      const doc = new jsPDF();
      const startY = this.pdfHeaderFooter.addHeader(doc, header);
      const headers = [['Reg No', 'Name', 'Email', 'Course', 'Status']];
      const rows = this.filteredStudents.map(s => [
        (s.registration_no || '').substring(0, 15),
        (s.name || '').substring(0, 25),
        (s.email || '').substring(0, 25),
        (s.course_name || '').substring(0, 20),
        s.is_active !== false ? 'Active' : 'Inactive'
      ]);
      doc.text('Student Management', 14, startY);
      autoTable(doc, { head: headers, body: rows, theme: 'striped', styles: { fontSize: 9 }, headStyles: { fillColor: [102, 126, 234] }, startY: startY + 7 });
      this.pdfHeaderFooter.addFooter(doc, footer);
      doc.save(`Students_${new Date().getTime()}.pdf`);
      this.toastService.success('PDF downloaded');
    });
  }

  downloadExcel(): void {
    const headers = ['Reg No', 'Name', 'Email', 'Phone', 'Course', 'Status'];
    const rows = this.filteredStudents.map(s => [
      s.registration_no || '',
      s.name || '',
      s.email || '',
      s.personal_number || '',
      s.course_name || '',
      s.is_active !== false ? 'Active' : 'Inactive'
    ]);
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Students');
    XLSX.writeFile(wb, `Students_${new Date().getTime()}.xlsx`);
    this.toastService.success('Excel downloaded');
  }

  addNew(): void {
    this.router.navigate(['/dashboard/student/student/create']);
  }

  editStudent(student: User): void {
    if (student.id) this.router.navigate(['/dashboard/student/student/edit', student.id]);
  }

  deleteStudent(student: User): void {
    if (!student.id) return;
    if (confirm(`Are you sure you want to delete "${student.name}"?`)) {
      this.isLoading = true;
      this.loadingService.show();
      this.userService.deleteUser(student.id).subscribe({
        next: (response) => {
          if (response.success) {
            this.toastService.success('Student deleted successfully');
            this.loadData();
          } else {
            this.isLoading = false;
            this.loadingService.hide();
          }
        },
        error: (err) => {
          this.toastService.error(err?.error?.error || 'Failed to delete student');
          this.isLoading = false;
          this.loadingService.hide();
        }
      });
    }
  }

  toggleActive(student: User, checked: boolean): void {
    if (!student?.id) return;
    const previous = student.is_active !== false;
    student.is_active = checked;

    this.userService.updateUser(student.id, { is_active: checked }).subscribe({
      next: (resp) => {
        if (resp.success) {
          this.toastService.success('Student active status updated');
        } else {
          student.is_active = previous ? true : false;
          this.toastService.error('Failed to update active status');
        }
      },
      error: (err) => {
        student.is_active = previous ? true : false;
        this.toastService.error(err?.error?.error || 'Failed to update active status');
      }
    });
  }

  printStudent(student: User): void {
    this.pdfHeaderFooter.getHeaderFooter().subscribe(({ header, footer }) => {
      const doc = new jsPDF();
      const startY = this.pdfHeaderFooter.addHeader(doc, header);
      doc.text('Student Details', 14, startY);

      const details = [
        ['Reg No', student.registration_no || '-'],
        ['Name', student.name || '-'],
        ['Email', student.email || '-'],
        ['Phone', student.personal_number || '-'],
        ['Course', student.course_name || '-'],
        ['Batch', student.batch_name || '-'],
        ['Status', student.is_active !== false ? 'Active' : 'Inactive']
      ];

      autoTable(doc, {
        head: [['Field', 'Value']],
        body: details,
        theme: 'striped',
        styles: { fontSize: 10 },
        headStyles: { fillColor: [102, 126, 234] },
        startY: startY + 7
      });

      this.pdfHeaderFooter.addFooter(doc, footer);
      const safe = (student.name || 'student').replace(/[^a-z0-9]+/gi, '_');
      doc.save(`Student_${safe}.pdf`);
      this.toastService.success('Student print downloaded');
    });
  }
}
