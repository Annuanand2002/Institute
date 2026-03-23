import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { BatchService, Batch } from '../../services/batch.service';
import { ToastService } from '../../services/toast.service';
import { LoadingService } from '../../services/loading.service';
import { PdfHeaderFooterService } from '../../services/pdf-header-footer.service';

@Component({
  selector: 'app-batch-table',
  templateUrl: './batch-table.component.html',
  styleUrls: ['./batch-table.component.css']
})
export class BatchTableComponent implements OnInit {
  allBatches: Batch[] = [];
  filteredBatches: Batch[] = [];
  searchQuery = '';
  currentPage = 1;
  itemsPerPage = 10;
  sortColumn: string | null = null;
  sortDirection: 'asc' | 'desc' = 'asc';

  constructor(
    private router: Router,
    private batchService: BatchService,
    private toastService: ToastService,
    private loadingService: LoadingService,
    private pdfHeaderFooter: PdfHeaderFooterService
  ) {}

  ngOnInit(): void {
    this.loadData();
  }

  loadData(): void {
    this.loadingService.show();
    this.batchService.getBatches().subscribe({
      next: (response) => {
        if (response.success) {
          this.allBatches = response.data;
          this.filteredBatches = [...this.allBatches];
        }
        this.loadingService.hide();
      },
      error: (err) => {
        this.toastService.error(err?.error?.error || 'Failed to load batches');
        this.loadingService.hide();
      }
    });
  }

  onSearch(): void {
    if (!this.searchQuery.trim()) {
      this.filteredBatches = [...this.allBatches];
      this.currentPage = 1;
      return;
    }
    const query = this.searchQuery.toLowerCase();
    this.filteredBatches = this.allBatches.filter(b =>
      (b.batch_code || '').toLowerCase().includes(query) ||
      (b.batch_name || '').toLowerCase().includes(query)
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
    this.filteredBatches.sort((a, b) => {
      const aVal = (a as any)[column] || '';
      const bVal = (b as any)[column] || '';
      if (aVal < bVal) return this.sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return this.sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }

  get paginatedBatches(): Batch[] {
    const start = (this.currentPage - 1) * this.itemsPerPage;
    return this.filteredBatches.slice(start, start + this.itemsPerPage);
  }

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.filteredBatches.length / this.itemsPerPage));
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
    const headers = ['Batch Code', 'Batch Name'];
    const rows = this.filteredBatches.map(b => [b.batch_code || '', b.batch_name || '']);
    const csvContent = [headers.join(','), ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `batches_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
    this.toastService.success('CSV downloaded');
  }

  downloadPDF(): void {
    this.pdfHeaderFooter.getHeaderFooter().subscribe(({ header, footer }) => {
      const doc = new jsPDF();
      const startY = this.pdfHeaderFooter.addHeader(doc, header);
      const headers = [['Batch Code', 'Batch Name']];
      const rows = this.filteredBatches.map(b => [b.batch_code || '', b.batch_name || '']);
      doc.text('Batch Management', 14, startY);
      autoTable(doc, { head: headers, body: rows, theme: 'striped', styles: { fontSize: 9 }, headStyles: { fillColor: [102, 126, 234] }, startY: startY + 7 });
      this.pdfHeaderFooter.addFooter(doc, footer);
      doc.save(`Batches_${new Date().getTime()}.pdf`);
      this.toastService.success('PDF downloaded');
    });
  }

  downloadExcel(): void {
    const headers = ['Batch Code', 'Batch Name'];
    const rows = this.filteredBatches.map(b => [b.batch_code || '', b.batch_name || '']);
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Batches');
    XLSX.writeFile(wb, `Batches_${new Date().getTime()}.xlsx`);
    this.toastService.success('Excel downloaded');
  }

  addNew(): void {
    this.router.navigate(['/dashboard/staff/batch/create']);
  }

  editBatch(batch: Batch): void {
    if (batch.id) this.router.navigate(['/dashboard/staff/batch/edit', batch.id]);
  }

  deleteBatch(batch: Batch): void {
    if (!batch.id) return;
    if (confirm(`Are you sure you want to delete batch "${batch.batch_name}"?`)) {
      this.loadingService.show();
      this.batchService.deleteBatch(batch.id).subscribe({
        next: (response) => {
          if (response.success) {
            this.toastService.success('Batch deleted successfully');
            this.loadData();
          }
          this.loadingService.hide();
        },
        error: (err) => {
          this.toastService.error(err?.error?.error || 'Failed to delete batch');
          this.loadingService.hide();
        }
      });
    }
  }
}
