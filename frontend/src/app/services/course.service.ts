import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { AuthService } from './auth.service';

export interface Course {
  id?: number;
  course_code?: string;
  course_name: string;
  description?: string;
  duration?: string;
  total_fee?: number;
  batch_id?: number;
  is_active?: boolean;
  batch_name?: string;
  batch_code?: string;
  created_by?: number;
  modified_by?: number;
}

@Injectable({
  providedIn: 'root'
})
export class CourseService {
  constructor(private api: ApiService, private authService: AuthService) {}

  private getUserId(): number | null {
    const user = this.authService.getUser();
    return user?.id ?? null;
  }

  getCourses(params?: { batch_id?: number; is_active?: boolean; search?: string }): Observable<{ success: boolean; data: Course[] }> {
    return this.api.get<{ success: boolean; data: Course[] }>('/courses', params);
  }

  getCourseById(id: number): Observable<{ success: boolean; data: Course }> {
    return this.api.get<{ success: boolean; data: Course }>(`/courses/${id}`);
  }

  createCourse(course: Partial<Course>): Observable<{ success: boolean; data: Course }> {
    return this.api.post<{ success: boolean; data: Course }>('/courses', {
      ...course,
      created_by: this.getUserId()
    });
  }

  updateCourse(id: number, course: Partial<Course>): Observable<{ success: boolean; data: Course }> {
    return this.api.put<{ success: boolean; data: Course }>('/courses', id, {
      ...course,
      modified_by: this.getUserId()
    });
  }

  deleteCourse(id: number, deleted_by?: number): Observable<{ success: boolean; message: string }> {
    return this.api.delete<{ success: boolean; message: string }>('/courses', id, {
      deleted_by: deleted_by ?? this.getUserId()
    });
  }
}
