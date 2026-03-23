import { Component, Input, Output, EventEmitter, OnInit, OnChanges } from '@angular/core';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { PdfHeaderFooterService } from '../../services/pdf-header-footer.service';

export interface TableColumn {
  key: string;
  label: string;
  sortable?: boolean;
}

export interface TableAction {
  label: string;
  icon: string;
  action: string;
  color?: string;
}

@Component({
  selector: 'app-shared-table',
  templateUrl: './shared-table.component.html',
  styleUrls: ['./shared-table.component.css']
})
export class SharedTableComponent implements OnInit, OnChanges {
  @Input() columns: TableColumn[] = [];
  @Input() data: any[] = [];
  @Input() actions: TableAction[] = [];
  @Input() title: string = '';
  @Output() actionClick = new EventEmitter<{ action: string; item: any }>();
  @Output() createClick = new EventEmitter<void>();
  @Output() editClick = new EventEmitter<any>();
  @Output() deleteClick = new EventEmitter<any>();

  filteredData: any[] = [];
  searchTerm: string = '';
  sortColumn: string = '';
  sortDirection: 'asc' | 'desc' = 'asc';
  currentPage: number = 1;
  itemsPerPage: number = 10;
  totalPages: number = 1;

  constructor(private pdfHeaderFooter: PdfHeaderFooterService) {}

  ngOnInit(): void {
    this.filteredData = [...this.data];
    this.updatePagination();
  }

  ngOnChanges(): void {
    this.filteredData = [...this.data];
    this.applyFilters();
  }

  onSearch(): void {
    this.currentPage = 1;
    this.applyFilters();
  }

  applyFilters(): void {
    let result = [...this.data];

    // Apply search
    if (this.searchTerm) {
      const term = this.searchTerm.toLowerCase();
      result = result.filter(item =>
        this.columns.some(col => {
          const value = item[col.key];
          return value && value.toString().toLowerCase().includes(term);
        })
      );
    }

    // Apply sort
    if (this.sortColumn) {
      result.sort((a, b) => {
        const aVal = a[this.sortColumn];
        const bVal = b[this.sortColumn];
        if (aVal < bVal) return this.sortDirection === 'asc' ? -1 : 1;
        if (aVal > bVal) return this.sortDirection === 'asc' ? 1 : -1;
        return 0;
      });
    }

    this.filteredData = result;
    this.updatePagination();
  }

  sort(column: string): void {
    if (this.sortColumn === column) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortColumn = column;
      this.sortDirection = 'asc';
    }
    this.applyFilters();
  }

  updatePagination(): void {
    this.totalPages = Math.ceil(this.filteredData.length / this.itemsPerPage);
    if (this.currentPage > this.totalPages) {
      this.currentPage = Math.max(1, this.totalPages);
    }
  }

  get paginatedData(): any[] {
    const start = (this.currentPage - 1) * this.itemsPerPage;
    const end = start + this.itemsPerPage;
    return this.filteredData.slice(start, end);
  }

  get Math() {
    return Math;
  }

  onAction(action: string, item: any): void {
    this.actionClick.emit({ action, item });
  }

  onCreate(): void {
    this.createClick.emit();
  }

  onEdit(item: any): void {
    this.editClick.emit(item);
  }

  onDelete(item: any): void {
    this.deleteClick.emit(item);
  }

  previousPage(): void {
    if (this.currentPage > 1) {
      this.currentPage--;
    }
  }

  nextPage(): void {
    if (this.currentPage < this.totalPages) {
      this.currentPage++;
    }
  }

  goToPage(page: number): void {
    this.currentPage = page;
  }

  exportToPDF(): void {
    this.pdfHeaderFooter.getHeaderFooter().subscribe(({ header, footer }) => {
      const doc = new jsPDF();
      const startY = this.pdfHeaderFooter.addHeader(doc, header);
      const tableData: any[] = [];
      const headers = this.columns.map(col => col.label);

      this.filteredData.forEach(item => {
        const row = this.columns.map(col => item[col.key] || '');
        tableData.push(row);
      });

      doc.text(this.title, 14, startY);

      autoTable(doc, {
        head: [headers],
        body: tableData,
        theme: 'striped',
        styles: { fontSize: 9 },
        headStyles: { fillColor: [59, 130, 246] },
        startY: startY + 7
      });

      this.pdfHeaderFooter.addFooter(doc, footer);
      doc.save(`${this.title.replace(/\s+/g, '_')}_${new Date().getTime()}.pdf`);
    });
  }

  exportToExcel(): void {
    const worksheetData: any[] = [];
    
    // Add headers
    const headers = this.columns.map(col => col.label);
    worksheetData.push(headers);

    // Add data rows
    this.filteredData.forEach(item => {
      const row = this.columns.map(col => item[col.key] || '');
      worksheetData.push(row);
    });

    const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1');
    
    XLSX.writeFile(workbook, `${this.title.replace(/\s+/g, '_')}_${new Date().getTime()}.xlsx`);
  }
}
