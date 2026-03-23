import { Injectable } from '@angular/core';
import { HttpRequest, HttpHandler, HttpEvent, HttpInterceptor, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { Router } from '@angular/router';

@Injectable()
export class NetworkErrorInterceptor implements HttpInterceptor {
  constructor(private router: Router) {}

  intercept(request: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    return next.handle(request).pipe(
      catchError((error: HttpErrorResponse) => {
        const isNetworkError =
          error.status === 0 ||
          (error.error instanceof ProgressEvent && (error.error.type === 'error' || error.error.type === 'abort')) ||
          (error.message && (error.message.toLowerCase().includes('network') || error.message.toLowerCase().includes('failed to fetch')));

        if (isNetworkError && !this.router.url.startsWith('/error')) {
          this.router.navigate(['/error'], { queryParams: { reason: 'offline' } });
        }
        return throwError(() => error);
      })
    );
  }
}
