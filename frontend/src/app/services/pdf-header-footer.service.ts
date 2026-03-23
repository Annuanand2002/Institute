import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';
import { jsPDF } from 'jspdf';
import { OrganisationService } from './organisation.service';

export interface PdfHeaderFooter {
  header: string | null;
  footer: string | null;
}

/** Default content start Y when no header */
const DEFAULT_START_Y = 15;
/** Header image max height (mm) */
const HEADER_HEIGHT = 22;
/** Footer image max height (mm) */
const FOOTER_HEIGHT = 18;
/** Page width A4 minus margins */
const PAGE_CONTENT_WIDTH = 182;
/** Bottom margin for footer */
const FOOTER_BOTTOM_MARGIN = 10;

@Injectable({
  providedIn: 'root'
})
export class PdfHeaderFooterService {
  constructor(private organisationService: OrganisationService) {}

  /**
   * Get organisation header and footer image data URLs for PDF (current/first org).
   */
  getHeaderFooter(): Observable<PdfHeaderFooter> {
    return this.organisationService.getAll().pipe(
      switchMap(res => {
        if (!res.success || !res.data || res.data.length === 0) {
          return of(null);
        }
        const first = res.data[0];
        const id = first.id ?? (first as any).id;
        if (id == null) return of(null);
        return this.organisationService.getById(id);
      }),
      map(res => {
        if (!res?.success || !res.data) {
          return { header: null, footer: null };
        }
        const org = res.data;
        return {
          header: org.header || null,
          footer: org.footer || null
        };
      })
    );
  }

  /**
   * Add header image at top of first page. Returns Y position to start content.
   */
  addHeader(doc: jsPDF, headerDataUrl: string | null): number {
    if (!headerDataUrl || typeof headerDataUrl !== 'string') {
      return DEFAULT_START_Y;
    }
    try {
      const format = headerDataUrl.indexOf('jpeg') !== -1 || headerDataUrl.indexOf('jpg') !== -1 ? 'JPEG' : 'PNG';
      doc.addImage(headerDataUrl, format, 14, 5, PAGE_CONTENT_WIDTH, HEADER_HEIGHT);
      return 5 + HEADER_HEIGHT + 5; // below header + small gap
    } catch {
      return DEFAULT_START_Y;
    }
  }

  /**
   * Add footer image at bottom of every page.
   */
  addFooter(doc: jsPDF, footerDataUrl: string | null): void {
    if (!footerDataUrl || typeof footerDataUrl !== 'string') {
      return;
    }
    try {
      const format = footerDataUrl.indexOf('jpeg') !== -1 || footerDataUrl.indexOf('jpg') !== -1 ? 'JPEG' : 'PNG';
      const pageCount = doc.getNumberOfPages();
      const pageHeight = doc.internal.pageSize.getHeight();
      const footerY = pageHeight - FOOTER_HEIGHT - FOOTER_BOTTOM_MARGIN;
      for (let p = 1; p <= pageCount; p++) {
        doc.setPage(p);
        doc.addImage(footerDataUrl, format, 14, footerY, PAGE_CONTENT_WIDTH, FOOTER_HEIGHT);
      }
    } catch {
      // ignore
    }
  }
}
