import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  private apiUrl = environment.apiUrl || 'http://localhost:3000/api';

  constructor(
    private http: HttpClient,
    private authService: AuthService
  ) {}

  private getHeaders(): HttpHeaders {
    const headers: { [key: string]: string } = {
      'Content-Type': 'application/json'
    };

    const token = this.authService.getToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    return new HttpHeaders(headers);
  }

  // Generic GET request
  get<T>(endpoint: string, params?: any): Observable<T> {
    const queryString = params ? '?' + new URLSearchParams(params).toString() : '';
    return this.http.get<T>(`${this.apiUrl}${endpoint}${queryString}`, {
      headers: this.getHeaders()
    });
  }

  // Generic POST request
  post<T>(endpoint: string, data: any): Observable<T> {
    return this.http.post<T>(`${this.apiUrl}${endpoint}`, data, {
      headers: this.getHeaders()
    });
  }

  // Generic PUT request
  put<T>(endpoint: string, id: number | string, data: any): Observable<T> {
    return this.http.put<T>(`${this.apiUrl}${endpoint}/${id}`, data, {
      headers: this.getHeaders()
    });
  }

  // Generic DELETE request
  delete<T>(endpoint: string, id: number | string, data?: any): Observable<T> {
    return this.http.delete<T>(`${this.apiUrl}${endpoint}/${id}`, {
      headers: this.getHeaders(),
      body: data
    });
  }
}
