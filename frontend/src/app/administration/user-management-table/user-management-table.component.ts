import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { UserProfileService, UserProfile } from '../../services/user-profile.service';
import { UserService } from '../../services/user.service';
import { ToastService } from '../../services/toast.service';
import { LoadingService } from '../../services/loading.service';
import { PdfHeaderFooterService } from '../../services/pdf-header-footer.service';

@Component({
  selector: 'app-user-management-table',
  templateUrl: './user-management-table.component.html',
  styleUrls: ['./user-management-table.component.css']
})
export class UserManagementTableComponent implements OnInit {
  allUsers: UserProfile[] = [];
  filteredUsers: UserProfile[] = [];
  searchQuery = '';
  currentPage = 1;
  itemsPerPage = 10;
  sortColumn: string | null = null;
  sortDirection: 'asc' | 'desc' = 'asc';

  constructor(
    private router: Router,
    private userProfileService: UserProfileService,
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
    this.userProfileService.getAll().subscribe({
      next: (response) => {
        if (response.success) {
          this.allUsers = response.data;
          this.filteredUsers = [...this.allUsers];
        }
        this.loadingService.hide();
      },
      error: (err) => {
        this.toastService.error(err?.error?.error || err?.error?.message || 'Failed to load users');
        this.loadingService.hide();
      }
    });
  }

  onSearch(): void {
    if (!this.searchQuery.trim()) {
      this.filteredUsers = [...this.allUsers];
      this.currentPage = 1;
      return;
    }
    const query = this.searchQuery.toLowerCase();
    this.filteredUsers = this.allUsers.filter(u =>
      (u.userId || '').toLowerCase().includes(query) ||
      (u.username || '').toLowerCase().includes(query) ||
      (u.staff_name || u.tutorName || '').toLowerCase().includes(query) ||
      (u.staff_reg_no || u.tutorRegNo || '').toLowerCase().includes(query)
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
    this.filteredUsers.sort((a, b) => {
      const aVal = (a as any)[column] || '';
      const bVal = (b as any)[column] || '';
      if (aVal < bVal) return this.sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return this.sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }

  get paginatedUsers(): UserProfile[] {
    const start = (this.currentPage - 1) * this.itemsPerPage;
    return this.filteredUsers.slice(start, start + this.itemsPerPage);
  }

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.filteredUsers.length / this.itemsPerPage));
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
    const headers = ['User ID', 'Username', 'Staff Name', 'Reg No', 'Can Login', 'Created'];
    const rows = this.filteredUsers.map(u => [
      u.userId || '',
      u.username || '',
      u.staff_name || u.tutorName || '',
      u.staff_reg_no || u.tutorRegNo || '',
      u.can_login ? 'Yes' : 'No',
      u.created_date ? new Date(u.created_date).toLocaleDateString() : ''
    ]);
    const csvContent = [headers.join(','), ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `users_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
    this.toastService.success('CSV downloaded');
  }

  downloadPDF(): void {
    this.pdfHeaderFooter.getHeaderFooter().subscribe(({ header, footer }) => {
      const doc = new jsPDF();
      const startY = this.pdfHeaderFooter.addHeader(doc, header);
      const headers = [['User ID', 'Username', 'Staff Name', 'Can Login']];
      const rows = this.filteredUsers.map(u => [
        u.userId || '',
        u.username || '',
        (u.staff_name || u.tutorName || '').substring(0, 30),
        u.can_login ? 'Yes' : 'No'
      ]);
      doc.text('User Management', 14, startY);
      autoTable(doc, { head: headers, body: rows, theme: 'striped', styles: { fontSize: 9 }, headStyles: { fillColor: [102, 126, 234] }, startY: startY + 7 });
      this.pdfHeaderFooter.addFooter(doc, footer);
      doc.save(`User_Management_${new Date().getTime()}.pdf`);
      this.toastService.success('PDF downloaded');
    });
  }

  downloadExcel(): void {
    const headers = ['User ID', 'Username', 'Staff Name', 'Reg No', 'Can Login', 'Created'];
    const rows = this.filteredUsers.map(u => [
      u.userId || '',
      u.username || '',
      u.staff_name || u.tutorName || '',
      u.staff_reg_no || u.tutorRegNo || '',
      u.can_login ? 'Yes' : 'No',
      u.created_date ? new Date(u.created_date).toLocaleDateString() : ''
    ]);
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Users');
    XLSX.writeFile(wb, `User_Management_${new Date().getTime()}.xlsx`);
    this.toastService.success('Excel downloaded');
  }

  addNew(): void {
    this.router.navigate(['/dashboard/administration/user-management/create']);
  }

  editUser(user: UserProfile): void {
    if (user.id) this.router.navigate(['/dashboard/administration/user-management/edit', user.id]);
  }

  deleteUser(user: UserProfile): void {
    if (!user.id) return;
    if (confirm(`Are you sure you want to delete user ${user.username}?`)) {
      this.loadingService.show();
      this.userProfileService.delete(user.id).subscribe({
        next: (response) => {
          if (response.success) {
            this.toastService.success('User deleted successfully');
            this.loadData();
          }
          this.loadingService.hide();
        },
        error: (err) => {
          this.toastService.error(err?.error?.error || err?.error?.message || 'Failed to delete user');
          this.loadingService.hide();
        }
      });
    }
  }

  toggleActive(user: UserProfile, checked: boolean): void {
    if (!user?.staff_id) return;
    const previous = !!user.is_active;
    user.is_active = checked;

    this.userService.updateUser(user.staff_id, { is_active: checked }).subscribe({
      next: (resp) => {
        if (resp.success) {
          this.toastService.success('User active status updated');
          // If user is deactivated, it will no longer appear due to active-only filters.
          this.loadData();
        } else {
          user.is_active = previous;
          this.toastService.error('Failed to update active status');
        }
      },
      error: (err) => {
        user.is_active = previous;
        this.toastService.error(err?.error?.error || 'Failed to update active status');
      }
    });
  }

  printUser(user: UserProfile): void {
    this.pdfHeaderFooter.getHeaderFooter().subscribe(({ header, footer }) => {
      const doc = new jsPDF();
      const startY = this.pdfHeaderFooter.addHeader(doc, header);
      doc.text('User Profile Details', 14, startY);

      const details = [
        ['User ID', user.userId || '-'],
        ['Username', user.username || '-'],
        ['Staff Name', user.staff_name || user.tutorName || '-'],
        ['Staff Reg No', user.staff_reg_no || user.tutorRegNo || '-'],
        ['Can Login', user.can_login ? 'Yes' : 'No'],
        ['Active', user.is_active ? 'Yes' : 'No']
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
      const safe = (user.username || 'user').replace(/[^a-z0-9]+/gi, '_');
      doc.save(`User_${safe}.pdf`);
      this.toastService.success('User print downloaded');
    });
  }
}
