import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { trigger, state, style, transition, animate } from '@angular/animations';
import { ToastService } from '../services/toast.service';
import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css'],
  animations: [
    trigger('fadeInUp', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateY(30px)' }),
        animate('600ms ease-out', style({ opacity: 1, transform: 'translateY(0)' }))
      ])
    ]),
    trigger('slideIn', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateX(-20px)' }),
        animate('500ms ease-out', style({ opacity: 1, transform: 'translateX(0)' }))
      ])
    ]),
    trigger('fadeIn', [
      transition(':enter', [
        style({ opacity: 0 }),
        animate('800ms ease-out', style({ opacity: 1 }))
      ])
    ])
  ]
})
export class LoginComponent implements OnInit {
  loginForm!: FormGroup;
  showPassword: boolean = false;
  rememberMe: boolean = false;
  isLoading: boolean = false;

  constructor(
    private fb: FormBuilder,
    private router: Router,
    private toastService: ToastService,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    // If already authenticated, redirect to dashboard
    if (this.authService.isAuthenticated()) {
      this.router.navigate(['/dashboard']);
      return;
    }

    this.loginForm = this.fb.group({
      username: ['', [Validators.required]],
      password: ['', [Validators.required]]
    });
  }

  togglePasswordVisibility(): void {
    this.showPassword = !this.showPassword;
  }

  onRememberMeChange(event: any): void {
    this.rememberMe = event.target.checked;
  }

  onSubmit(): void {
    if (this.loginForm.valid) {
      this.isLoading = true;
      const { username, password } = this.loginForm.value;
      
      console.log('Attempting login with:', { username, password: '***' });
      
      this.authService.login(username, password).subscribe({
        next: (response) => {
          if (response.success) {
            this.isLoading = false;
            this.toastService.success(`Welcome, ${response.data.user.name}!`);
            this.router.navigate(['/dashboard']);
          } else {
            this.isLoading = false;
          }
        },
        error: (error) => {
          this.isLoading = false;
          console.error('Login error:', error);
          
          let errorMessage = 'Login failed. Please try again.';
          
          if (error.error) {
            errorMessage = error.error.error || error.error.message || errorMessage;
          } else if (error.message) {
            errorMessage = error.message;
          }
          
          // Check for network errors and API errors
          if (error.status === 0) {
            errorMessage = 'Cannot connect to server. Please make sure the backend is running on http://localhost:3000';
          } else if (error.status === 401) {
            errorMessage = error.error?.error || 'Invalid username or password';
          } else if (error.status === 403) {
            errorMessage = error.error?.error || 'Login is disabled for this account';
          } else if (error.status === 500) {
            errorMessage = 'Server error. Please check backend logs.';
          }
          
          this.toastService.error(errorMessage);
        }
      });
    } else {
      this.markFormGroupTouched();
    }
  }

  private markFormGroupTouched(): void {
    Object.keys(this.loginForm.controls).forEach(key => {
      const control = this.loginForm.get(key);
      control?.markAsTouched();
    });
  }

  get username() {
    return this.loginForm.get('username');
  }

  get password() {
    return this.loginForm.get('password');
  }
}
