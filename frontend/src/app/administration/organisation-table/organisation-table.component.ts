import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { OrganisationService, Organisation } from '../../services/organisation.service';
import { ToastService } from '../../services/toast.service';
import { LoadingService } from '../../services/loading.service';
import { PdfHeaderFooterService } from '../../services/pdf-header-footer.service';

@Component({
  selector: 'app-organisation-table',
  templateUrl: './organisation-table.component.html',
  styleUrls: ['./organisation-table.component.css']
})
export class OrganisationTableComponent implements OnInit {
  allOrganisations: Organisation[] = [];
  filteredOrganisations: Organisation[] = [];
  searchQuery = '';
  currentPage = 1;
  itemsPerPage = 10;
  sortColumn: string | null = null;
  sortDirection: 'asc' | 'desc' = 'asc';

  constructor(
    private router: Router,
    private organisationService: OrganisationService,
    private toastService: ToastService,
    private loadingService: LoadingService,
    private pdfHeaderFooter: PdfHeaderFooterService
  ) {}

  ngOnInit(): void {
    this.loadData();
  }

  loadData(): void {
    this.loadingService.show();
    this.organisationService.getAll().subscribe({
      next: (response) => {
        if (response.success) {
          this.allOrganisations = response.data;
          this.filteredOrganisations = [...this.allOrganisations];
        }
        this.loadingService.hide();
      },
      error: (error) => {
        this.toastService.error('Failed to load organisations');
        this.loadingService.hide();
      }
    });
  }

  onSearch(): void {
    if (!this.searchQuery.trim()) {
      this.filteredOrganisations = [...this.allOrganisations];
      this.currentPage = 1;
      return;
    }
    const query = this.searchQuery.toLowerCase();
    this.filteredOrganisations = this.allOrganisations.filter(org =>
      (org.org_name || '').toLowerCase().includes(query) ||
      (org.email || '').toLowerCase().includes(query) ||
      (org.address || '').toLowerCase().includes(query) ||
      (org.phone_number || '').includes(query) ||
      (org.org_code || '').toLowerCase().includes(query)
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
    this.filteredOrganisations.sort((a, b) => {
      const aVal = (a as any)[column] || '';
      const bVal = (b as any)[column] || '';
      if (aVal < bVal) return this.sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return this.sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }

  get paginatedOrganisations(): Organisation[] {
    const start = (this.currentPage - 1) * this.itemsPerPage;
    return this.filteredOrganisations.slice(start, start + this.itemsPerPage);
  }

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.filteredOrganisations.length / this.itemsPerPage));
  }

  /** Only one organisation allowed: show Add only when none exist */
  get canAddOrganisation(): boolean {
    return this.allOrganisations.length === 0;
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
    const headers = ['Org Code', 'Organisation Name', 'Address', 'Phone', 'Email', 'Website'];
    const rows = this.filteredOrganisations.map(org => [
      org.org_code || '',
      org.org_name || '',
      org.address || '',
      org.phone_number || '',
      org.email || '',
      org.website || 'N/A'
    ]);
    const csvContent = [headers.join(','), ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `organisations_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
    this.toastService.success('CSV downloaded');
  }

  downloadPDF(): void {
    this.pdfHeaderFooter.getHeaderFooter().subscribe(({ header, footer }) => {
      const doc = new jsPDF();
      const startY = this.pdfHeaderFooter.addHeader(doc, header);
      const headers = [['Org Code', 'Organisation Name', 'Address', 'Phone', 'Email']];
      const rows = this.filteredOrganisations.map(org => [
        org.org_code || '',
        org.org_name || '',
        (org.address || '').substring(0, 40),
        org.phone_number || '',
        org.email || ''
      ]);
      doc.text('Organisations', 14, startY);
      autoTable(doc, {
        head: headers,
        body: rows,
        theme: 'striped',
        styles: { fontSize: 9 },
        headStyles: { fillColor: [102, 126, 234] },
        startY: startY + 7
      });
      this.pdfHeaderFooter.addFooter(doc, footer);
      doc.save(`Organisations_${new Date().getTime()}.pdf`);
      this.toastService.success('PDF downloaded');
    });
  }

  downloadExcel(): void {
    const headers = ['Org Code', 'Organisation Name', 'Address', 'Phone', 'Email', 'Website', 'Created'];
    const rows = this.filteredOrganisations.map(org => [
      org.org_code || '',
      org.org_name || '',
      org.address || '',
      org.phone_number || '',
      org.email || '',
      org.website || 'N/A',
      org.created_date ? new Date(org.created_date).toLocaleDateString() : ''
    ]);
    const worksheetData = [headers, ...rows];
    const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Organisations');
    XLSX.writeFile(workbook, `Organisations_${new Date().getTime()}.xlsx`);
    this.toastService.success('Excel downloaded');
  }

  addNew(): void {
    this.router.navigate(['/dashboard/administration/organisation/create']);
  }

  editOrganisation(org: Organisation): void {
    if (org.id) this.router.navigate(['/dashboard/administration/organisation/edit', org.id]);
  }
}
