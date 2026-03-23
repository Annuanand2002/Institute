import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, BehaviorSubject } from 'rxjs';
import { tap } from 'rxjs/operators';
import { environment } from '../../environments/environment';

export interface LoginResponse {
  success: boolean;
  data: {
    token: string;
    user: {
      id: number;
      username: string;
      name: string;
      email: string;
      roleId: number;
      roleName: string;
    };
  };
}

export interface User {
  id: number;
  username: string;
  name: string;
  email: string;
  roleId: number;
  roleName: string;
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
export class AuthService {
  private readonly TOKEN_KEY = 'auth_token';
  private readonly USER_KEY = 'auth_user';
  private readonly TOKEN_EXPIRY_KEY = 'auth_token_expiry';
  private apiUrl = environment.apiUrl || 'http://localhost:3000/api';
  private currentUserSubject = new BehaviorSubject<User | null>(this.getStoredUser());
  public currentUser$ = this.currentUserSubject.asObservable();

  constructor(
    private http: HttpClient,
    private router: Router
  ) {
    // Check token expiration on service initialization
    this.checkTokenExpiration();
    
    // Check token expiration every 5 minutes
    setInterval(() => {
      this.checkTokenExpiration();
    }, 5 * 60 * 1000); // 5 minutes
  }

  login(username: string, password: string): Observable<LoginResponse> {
    const headers = new HttpHeaders({ 'Content-Type': 'application/json' });
    return this.http.post<LoginResponse>(
      `${this.apiUrl}/auth/login`,
      { username, password },
      { headers }
    ).pipe(
      tap(response => {
        if (response.success) {
          this.setToken(response.data.token);
          this.setUser(response.data.user);
          this.currentUserSubject.next(response.data.user);
        }
      })
    );
  }

  logout(): void {
    this.removeToken();
    this.removeUser();
    this.removeTokenExpiry();
    this.currentUserSubject.next(null);
    this.router.navigate(['/login']);
  }

  getToken(): string | null {
    const token = localStorage.getItem(this.TOKEN_KEY);
    if (token && this.isTokenExpired()) {
      // Token expired, clear it
      this.logout();
      return null;
    }
    return token;
  }

  setToken(token: string): void {
    localStorage.setItem(this.TOKEN_KEY, token);
    // Decode token to get expiration time
    const expiry = this.getTokenExpiration(token);
    if (expiry) {
      localStorage.setItem(this.TOKEN_EXPIRY_KEY, expiry.toString());
    }
  }

  removeToken(): void {
    localStorage.removeItem(this.TOKEN_KEY);
    this.removeTokenExpiry();
  }

  private getTokenExpiration(token: string): number | null {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      // JWT exp is in seconds, convert to milliseconds
      return payload.exp ? payload.exp * 1000 : null;
    } catch (error) {
      console.error('Error decoding token:', error);
      return null;
    }
  }

  private isTokenExpired(): boolean {
    const expiryStr = localStorage.getItem(this.TOKEN_EXPIRY_KEY);
    if (!expiryStr) {
      return true; // No expiry stored, consider expired
    }
    const expiry = parseInt(expiryStr, 10);
    return Date.now() >= expiry;
  }

  private checkTokenExpiration(): void {
    if (this.isTokenExpired() && this.getToken()) {
      // Token expired, logout user
      console.log('Token expired, logging out...');
      this.logout();
    }
  }

  private removeTokenExpiry(): void {
    localStorage.removeItem(this.TOKEN_EXPIRY_KEY);
  }

  getUser(): User | null {
    return this.getStoredUser();
  }

  private setUser(user: User): void {
    localStorage.setItem(this.USER_KEY, JSON.stringify(user));
  }

  private getStoredUser(): User | null {
    const userStr = localStorage.getItem(this.USER_KEY);
    return userStr ? JSON.parse(userStr) : null;
  }

  private removeUser(): void {
    localStorage.removeItem(this.USER_KEY);
  }

  isAuthenticated(): boolean {
    const token = this.getToken();
    if (!token) {
      return false;
    }
    // Double check expiration
    if (this.isTokenExpired()) {
      this.logout();
      return false;
    }
    return true;
  }

  verifyToken(): Observable<{ success: boolean; data: { user: User } }> {
    const token = this.getToken();
    const headers = new HttpHeaders({
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    });
    return this.http.get<{ success: boolean; data: { user: User } }>(
      `${this.apiUrl}/auth/verify`,
      { headers }
    ).pipe(
      tap(response => {
        if (response.success && response.data?.user) {
          this.setUser(response.data.user);
          this.currentUserSubject.next(response.data.user);
        }
      })
    );
  }
}
