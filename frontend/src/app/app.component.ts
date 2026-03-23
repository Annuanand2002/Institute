import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from './services/auth.service';
import { ThemeService } from './services/theme.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent implements OnInit {
  title = 'angular-frontend';

  constructor(
    private authService: AuthService,
    private router: Router,
    private themeService: ThemeService // Initialize theme on app startup
  ) {}

  ngOnInit(): void {
    // Check if user is authenticated and token is valid on app initialization
    if (this.authService.isAuthenticated()) {
      // Verify token with backend
      this.authService.verifyToken().subscribe({
        next: (response) => {
          if (response.success) {
            // Token is valid, user can stay logged in
            console.log('Token verified successfully');
          }
        },
        error: (error) => {
          // Token invalid or expired, logout
          console.log('Token verification failed, logging out...');
          this.authService.logout();
        }
      });
    }
  }
}
