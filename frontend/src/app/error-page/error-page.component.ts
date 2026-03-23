import { Component, OnInit } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';

@Component({
  selector: 'app-error-page',
  templateUrl: './error-page.component.html',
  styleUrls: ['./error-page.component.css']
})
export class ErrorPageComponent implements OnInit {
  title = 'Something went wrong';
  message = 'We couldn\'t complete your request. This might be due to a connection issue or a temporary problem.';
  isOffline = false;
  code = '';

  constructor(
    private router: Router,
    private route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    const reason = this.route.snapshot.queryParamMap.get('reason') || this.route.snapshot.data['reason'];
    const msg = this.route.snapshot.queryParamMap.get('message');
    if (reason === 'offline' || reason === 'network') {
      this.isOffline = true;
      this.title = 'No internet connection';
      this.message = 'Please check your network and try again.';
      this.code = 'OFFLINE';
    } else if (reason === '404') {
      this.title = 'Page not found';
      this.message = 'The page you\'re looking for doesn\'t exist or has been moved.';
      this.code = '404';
    } else if (msg) {
      this.message = decodeURIComponent(msg);
    }
    if (!this.code) this.code = 'ERROR';
  }

  retry(): void {
    if (this.isOffline && typeof navigator !== 'undefined' && !navigator.onLine) {
      return;
    }
    window.location.reload();
  }

  goHome(): void {
    this.router.navigate(['/login']);
  }

  goDashboard(): void {
    this.router.navigate(['/dashboard']);
  }
}
