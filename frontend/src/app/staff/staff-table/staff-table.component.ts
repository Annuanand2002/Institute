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
  selector: 'app-staff-table',
  templateUrl: './staff-table.component.html',
  styleUrls: ['./staff-table.component.css']
})
export class StaffTableComponent implements OnInit {
  allStaff: User[] = [];
  filteredStaff: User[] = [];
  searchQuery = '';
  currentPage = 1;
  itemsPerPage = 10;
  sortColumn: string | null = null;
  sortDirection: 'asc' | 'desc' = 'asc';

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
    this.loadingService.show();
    // Management view: show all staff (active + inactive)
    this.userService.getUsers({ role: 'Staff' }).subscribe({
      next: (response) => {
        if (response.success) {
          // Normalise is_active coming from backend (0/1 or boolean) into a strict boolean
          this.allStaff = (response.data || []).map(s => ({
            ...s,
            is_active: s.is_active === true || (s as any).is_active === 1
          }));
          this.filteredStaff = [...this.allStaff];
        }
        this.loadingService.hide();
      },
      error: (err) => {
        this.toastService.error(err?.error?.error || 'Failed to load staff');
        this.loadingService.hide();
      }
    });
  }

  onSearch(): void {
    if (!this.searchQuery.trim()) {
      this.filteredStaff = [...this.allStaff];
      this.currentPage = 1;
      return;
    }
    const query = this.searchQuery.toLowerCase();
    this.filteredStaff = this.allStaff.filter(s =>
      (s.name || '').toLowerCase().includes(query) ||
      (s.email || '').toLowerCase().includes(query) ||
      (s.personal_number || '').includes(query) ||
      (s.registration_no || '').toLowerCase().includes(query)
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
    this.filteredStaff.sort((a, b) => {
      const aVal = (a as any)[column] ?? '';
      const bVal = (b as any)[column] ?? '';
      if (aVal < bVal) return this.sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return this.sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }

  get paginatedStaff(): User[] {
    const start = (this.currentPage - 1) * this.itemsPerPage;
    return this.filteredStaff.slice(start, start + this.itemsPerPage);
  }

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.filteredStaff.length / this.itemsPerPage));
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
    const headers = ['Staff ID', 'Name', 'Email', 'Phone', 'Qualification', 'Status'];
    const rows = this.filteredStaff.map(s => [
      s.registration_no || '',
      s.name || '',
      s.email || '',
      s.personal_number || '',
      s.educational_qualification || '',
      s.is_active !== false ? 'Active' : 'Inactive'
    ]);
    const csvContent = [headers.join(','), ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `staff_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
    this.toastService.success('CSV downloaded');
  }

  downloadPDF(): void {
    this.pdfHeaderFooter.getHeaderFooter().subscribe(({ header, footer }) => {
      const doc = new jsPDF();
      const startY = this.pdfHeaderFooter.addHeader(doc, header);
      const headers = [['Staff ID', 'Name', 'Email', 'Phone', 'Status']];
      const rows = this.filteredStaff.map(s => [
        (s.registration_no || '').substring(0, 15),
        (s.name || '').substring(0, 20),
        (s.email || '').substring(0, 25),
        s.personal_number || '',
        s.is_active !== false ? 'Active' : 'Inactive'
      ]);
      doc.text('Staff Management', 14, startY);
      autoTable(doc, { head: headers, body: rows, theme: 'striped', styles: { fontSize: 9 }, headStyles: { fillColor: [102, 126, 234] }, startY: startY + 7 });
      this.pdfHeaderFooter.addFooter(doc, footer);
      doc.save(`Staff_${new Date().getTime()}.pdf`);
      this.toastService.success('PDF downloaded');
    });
  }

  downloadExcel(): void {
    const headers = ['Staff ID', 'Name', 'Email', 'Phone', 'Qualification', 'Status'];
    const rows = this.filteredStaff.map(s => [
      s.registration_no || '',
      s.name || '',
      s.email || '',
      s.personal_number || '',
      s.educational_qualification || '',
      s.is_active !== false ? 'Active' : 'Inactive'
    ]);
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Staff');
    XLSX.writeFile(wb, `Staff_${new Date().getTime()}.xlsx`);
    this.toastService.success('Excel downloaded');
  }

  addNew(): void {
    this.router.navigate(['/dashboard/staff/staff/create']);
  }

  toggleActive(staff: User, checked: boolean): void {
    if (!staff?.id) return;
    const previous = staff.is_active !== false;
    staff.is_active = checked;

    this.userService.updateUser(staff.id, { is_active: checked }).subscribe({
      next: (resp) => {
        if (resp.success) {
          this.toastService.success('Staff active status updated');
        } else {
          staff.is_active = previous ? true : false;
          this.toastService.error('Failed to update active status');
        }
      },
      error: (err) => {
        staff.is_active = previous ? true : false;
        this.toastService.error(err?.error?.error || 'Failed to update active status');
      }
    });
  }

  editStaff(staff: User): void {
    if (staff.id) this.router.navigate(['/dashboard/staff/staff/edit', staff.id]);
  }

  deleteStaff(staff: User): void {
    if (!staff.id) return;
    if (confirm(`Are you sure you want to delete "${staff.name}"?`)) {
      this.loadingService.show();
      this.userService.deleteUser(staff.id).subscribe({
        next: (response) => {
          if (response.success) {
            this.toastService.success('Staff deleted successfully');
            this.loadData();
          }
          this.loadingService.hide();
        },
        error: (err) => {
          this.toastService.error(err?.error?.error || 'Failed to delete staff');
          this.loadingService.hide();
        }
      });
    }
  }
}
