import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { AuthService } from './auth.service';

export interface Organisation {
  id?: number;
  org_code?: string;
  org_name: string;
  description?: string;
  phone_number?: string;
  email?: string;
  address?: string;
  website?: string;
  logo?: string | null;
  header?: string | null;
  footer?: string | null;
  seal?: string | null;
  created_date?: string;
  modified_date?: string;
}

@Injectable({
  providedIn: 'root'
})
export class OrganisationService {
  constructor(
    private api: ApiService,
    private authService: AuthService
  ) {}

  private getUserId(): number | null {
    const user = this.authService.getUser();
    return user?.id ?? null;
  }

  getAll(search?: string): Observable<{ success: boolean; data: Organisation[] }> {
    return this.api.get<{ success: boolean; data: Organisation[] }>(
      '/organisations',
      search ? { search } : undefined
    );
  }

  getById(id: number): Observable<{ success: boolean; data: Organisation }> {
    return this.api.get<{ success: boolean; data: Organisation }>(`/organisations/${id}`);
  }

  create(org: Partial<Organisation>): Observable<{ success: boolean; data: Organisation }> {
    return this.api.post<{ success: boolean; data: Organisation }>('/organisations', {
      org_code: org.org_code,
      org_name: org.org_name,
      description: org.description,
      phone_number: org.phone_number,
      email: org.email,
      address: org.address,
      website: org.website,
      logo: org.logo,
      header: org.header,
      footer: org.footer,
      seal: org.seal,
      created_by: this.getUserId()
    });
  }

  update(id: number, org: Partial<Organisation>): Observable<{ success: boolean; data: Organisation }> {
    return this.api.put<{ success: boolean; data: Organisation }>('/organisations', id, {
      org_code: org.org_code,
      org_name: org.org_name,
      description: org.description,
      phone_number: org.phone_number,
      email: org.email,
      address: org.address,
      website: org.website,
      logo: org.logo,
      header: org.header,
      footer: org.footer,
      seal: org.seal,
      modified_by: this.getUserId()
    });
  }

  delete(id: number): Observable<{ success: boolean; message: string }> {
    return this.api.delete<{ success: boolean; message: string }>('/organisations', id, { deleted_by: this.getUserId() });
  }
}
