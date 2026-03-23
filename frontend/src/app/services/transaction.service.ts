import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { AuthService } from './auth.service';

export interface Transaction {
  id?: number;
  user_id: number;
  transaction_date: string;
  payment_mode: string;
  amount: number;
  transtype?: string;
  reference_number?: string;
  remarks?: string;
  user_name?: string;
  registration_no?: string;
  course_name?: string;
  course_code?: string;
  created_by?: number;
  modified_by?: number;
}

@Injectable({
  providedIn: 'root'
})
export class TransactionService {
  constructor(private api: ApiService, private authService: AuthService) {}

  private getUserId(): number | null {
    const user = this.authService.getUser();
    return user?.id ?? null;
  }

  getTransactions(params?: {
    user_id?: number;
    transtype?: string;
    transtypes?: string;
    start_date?: string;
    end_date?: string;
    search?: string;
  }): Observable<{ success: boolean; data: Transaction[] }> {
    return this.api.get<{ success: boolean; data: Transaction[] }>('/transactions', params);
  }

  getTransactionById(id: number): Observable<{ success: boolean; data: Transaction }> {
    return this.api.get<{ success: boolean; data: Transaction }>(`/transactions/${id}`);
  }

  createTransaction(transaction: Partial<Transaction>): Observable<{ success: boolean; data: Transaction }> {
    return this.api.post<{ success: boolean; data: Transaction }>('/transactions', {
      ...transaction,
      created_by: this.getUserId()
    });
  }

  updateTransaction(id: number, transaction: Partial<Transaction>): Observable<{ success: boolean; data: Transaction }> {
    return this.api.put<{ success: boolean; data: Transaction }>('/transactions', id, {
      ...transaction,
      modified_by: this.getUserId()
    });
  }

  deleteTransaction(id: number, deleted_by?: number): Observable<{ success: boolean; message: string }> {
    return this.api.delete<{ success: boolean; message: string }>('/transactions', id, {
      deleted_by: deleted_by ?? this.getUserId()
    });
  }
}
