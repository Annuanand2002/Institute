import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { AuthService } from './auth.service';

export interface Batch {
  id?: number;
  batch_code: string;
  batch_name: string;
  created_by?: number;
  modified_by?: number;
}

@Injectable({
  providedIn: 'root'
})
export class BatchService {
  constructor(private api: ApiService, private authService: AuthService) {}

  private getUserId(): number | null {
    const user = this.authService.getUser();
    return user?.id ?? null;
  }

  getBatches(search?: string): Observable<{ success: boolean; data: Batch[] }> {
    return this.api.get<{ success: boolean; data: Batch[] }>('/batches', search ? { search } : undefined);
  }

  getBatchById(id: number): Observable<{ success: boolean; data: Batch }> {
    return this.api.get<{ success: boolean; data: Batch }>(`/batches/${id}`);
  }

  createBatch(batch: Batch): Observable<{ success: boolean; data: Batch }> {
    return this.api.post<{ success: boolean; data: Batch }>('/batches', {
      ...batch,
      created_by: this.getUserId()
    });
  }

  updateBatch(id: number, batch: Batch): Observable<{ success: boolean; data: Batch }> {
    return this.api.put<{ success: boolean; data: Batch }>('/batches', id, {
      ...batch,
      modified_by: this.getUserId()
    });
  }

  deleteBatch(id: number, deleted_by?: number): Observable<{ success: boolean; message: string }> {
    return this.api.delete<{ success: boolean; message: string }>('/batches', id, {
      deleted_by: deleted_by ?? this.getUserId()
    });
  }
}
