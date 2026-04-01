import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { AuthService } from './auth.service';

export interface User {
  id?: number;
  course_id?: number;
  user_role_id: number;
  registration_no?: string;
  application_date?: string;
  name: string;
  guardian_name?: string;
  relationship_with_guardian?: string;
  occupation_of_guardian?: string;
  permanent_address?: string;
  local_address?: string;
  personal_number?: string;
  home_number?: string;
  date_of_birth?: string;
  gender?: string;
  marital_status?: string;
  religion?: string;
  caste?: string;
  educational_qualification?: string;
  email?: string;
  class_time?: string;
  course_fee?: number;
  fee_details?: string;
  admitted_by?: number;
  remarks?: string;
  profile_image_id?: number;
  is_active?: boolean;
  payment_mode?: 'monthly' | 'one-time' | '' | null;
  adjustment_amount?: number | null;
  total_payable?: number | null;
  paid_amount?: number | null;
  due_amount?: number | null;
  /** Report: amount to pay for the current month (monthly students with no payment that month) */
  amount_to_pay_this_month?: number | null;
  report_month?: string | null;
  /** Report API returns student_id instead of id */
  student_id?: number;
  role_name?: string;
  course_name?: string;
  course_code?: string;
  batch_name?: string;
  batch_code?: string;
  created_by?: number;
  modified_by?: number;
  /** Data URL for profile image (from API when present) */
  profile_image?: string | null;
}

export interface StudentMonthlyDueMonth {
  month: string; // YYYY-MM
  paid_amount: number;
  due_amount: number;
  status: 'Paid' | 'Pending';
}

export interface StudentMonthlyDueResponse {
  student_id: number;
  registration_no?: string;
  name: string;
  course_name?: string;
  course_code?: string;
  monthly_amount: number;
  months: StudentMonthlyDueMonth[];
  note?: string;
}

@Injectable({
  providedIn: 'root'
})
export class UserService {
  constructor(private api: ApiService, private authService: AuthService) {}

  private getUserId(): number | null {
    const user = this.authService.getUser();
    return user?.id ?? null;
  }

  getUsers(params?: { role?: string; course_id?: number; is_active?: boolean; search?: string }): Observable<{ success: boolean; data: User[] }> {
    return this.api.get<{ success: boolean; data: User[] }>('/users', params);
  }

  getUserById(id: number): Observable<{ success: boolean; data: User }> {
    return this.api.get<{ success: boolean; data: User }>(`/users/${id}`);
  }

  createUser(user: Partial<User>): Observable<{ success: boolean; data: User }> {
    return this.api.post<{ success: boolean; data: User }>('/users', {
      ...user,
      created_by: this.getUserId()
    });
  }

  updateUser(id: number, user: Partial<User>): Observable<{ success: boolean; data: User }> {
    return this.api.put<{ success: boolean; data: User }>('/users', id, {
      ...user,
      modified_by: this.getUserId()
    });
  }

  deleteUser(id: number, deleted_by?: number): Observable<{ success: boolean; message: string }> {
    return this.api.delete<{ success: boolean; message: string }>('/users', id, {
      deleted_by: deleted_by ?? this.getUserId()
    });
  }

  getStudentReport(params?: { month_from?: string; month_to?: string }): Observable<{ success: boolean; data: User[] }> {
    const q: { month_from?: string; month_to?: string } = {};
    if (params?.month_from) q.month_from = params.month_from;
    if (params?.month_to) q.month_to = params.month_to;
    const query = q.month_from && q.month_to ? q : undefined;
    return this.api.get<{ success: boolean; data: User[] }>('/users/report', query);
  }

  getStudentMonthlyDue(studentId: number): Observable<{ success: boolean; data: StudentMonthlyDueResponse }> {
    return this.api.get<{ success: boolean; data: StudentMonthlyDueResponse }>(`/users/report/${studentId}/monthly-due`);
  }
}
