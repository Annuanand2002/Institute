import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { AuthService } from './auth.service';

export interface UserProfile {
  id?: number;
  staff_id: number;
  username: string;
  can_login?: boolean;
  is_active?: boolean;
  staff_name?: string;
  staff_reg_no?: string;
  role_name?: string;
  created_date?: string;
  modified_date?: string;
  userId?: string;
  tutorName?: string;
  tutorRegNo?: string;
  tutorId?: number;
  is_dashboard?: boolean;
  is_batch?: boolean;
  is_course?: boolean;
  is_staff?: boolean;
  is_student?: boolean;
  is_payment?: boolean;
  is_receipt?: boolean;
  is_proftloss?: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class UserProfileService {
  constructor(
    private api: ApiService,
    private authService: AuthService
  ) {}

  private getUserId(): number | null {
    const user = this.authService.getUser();
    return user?.id ?? null;
  }

  getAll(search?: string): Observable<{ success: boolean; data: UserProfile[] }> {
    return this.api.get<{ success: boolean; data: UserProfile[] }>(
      '/user-profiles',
      search ? { search } : undefined
    );
  }

  getById(id: number): Observable<{ success: boolean; data: UserProfile }> {
    return this.api.get<{ success: boolean; data: UserProfile }>(`/user-profiles/${id}`);
  }

  create(data: {
    user_id: number; username: string; password: string; role: string; can_login?: boolean;
    is_dashboard?: boolean; is_batch?: boolean; is_course?: boolean; is_staff?: boolean;
    is_student?: boolean; is_payment?: boolean; is_receipt?: boolean; is_proftloss?: boolean;
  }): Observable<{ success: boolean; data: any }> {
    const body: any = {
      user_id: data.user_id,
      username: data.username,
      password: data.password,
      role: data.role || 'Staff',
      can_login: data.can_login !== false,
      created_by: this.getUserId()
    };
    if (data.is_dashboard !== undefined) body.is_dashboard = data.is_dashboard;
    if (data.is_batch !== undefined) body.is_batch = data.is_batch;
    if (data.is_course !== undefined) body.is_course = data.is_course;
    if (data.is_staff !== undefined) body.is_staff = data.is_staff;
    if (data.is_student !== undefined) body.is_student = data.is_student;
    if (data.is_payment !== undefined) body.is_payment = data.is_payment;
    if (data.is_receipt !== undefined) body.is_receipt = data.is_receipt;
    if (data.is_proftloss !== undefined) body.is_proftloss = data.is_proftloss;
    return this.api.post<{ success: boolean; data: any }>('/auth/create-profile', body);
  }

  update(id: number, data: {
    username?: string; password?: string; can_login?: boolean; staff_id?: number;
    is_dashboard?: boolean; is_batch?: boolean; is_course?: boolean; is_staff?: boolean;
    is_student?: boolean; is_payment?: boolean; is_receipt?: boolean; is_proftloss?: boolean;
  }): Observable<{ success: boolean; data: UserProfile }> {
    return this.api.put<{ success: boolean; data: UserProfile }>('/user-profiles', id, {
      ...data,
      modified_by: this.getUserId()
    });
  }

  delete(id: number): Observable<{ success: boolean; message: string }> {
    return this.api.delete<{ success: boolean; message: string }>('/user-profiles', id, {
      deleted_by: this.getUserId()
    });
  }
}
