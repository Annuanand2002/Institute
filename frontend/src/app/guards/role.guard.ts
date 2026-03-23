import { Injectable } from '@angular/core';
import { Router, CanActivate, ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { AuthService } from '../services/auth.service';

/** Route to permission flag (user table booleans). Admin bypasses checks. */
const ROUTE_PERMISSIONS: { path: string; permission: keyof import('../services/auth.service').User }[] = [
  { path: '/dashboard', permission: 'is_dashboard' },
  { path: '/dashboard/staff/batch', permission: 'is_batch' },
  { path: '/dashboard/staff/course', permission: 'is_course' },
  { path: '/dashboard/staff/staff', permission: 'is_staff' },
  { path: '/dashboard/student/student', permission: 'is_student' },
  { path: '/dashboard/accounts/payment', permission: 'is_payment' },
  { path: '/dashboard/accounts/receipt', permission: 'is_receipt' },
  { path: '/dashboard/accounts/profit-loss', permission: 'is_proftloss' }
];

/** First allowed dashboard route for redirect when no permission (order matters). */
const FIRST_ALLOWED_ROUTES = [
  '/dashboard',
  '/dashboard/staff/batch',
  '/dashboard/staff/course',
  '/dashboard/staff/staff',
  '/dashboard/student/student',
  '/dashboard/accounts/payment',
  '/dashboard/accounts/receipt',
  '/dashboard/accounts/profit-loss',
  '/dashboard/settings'
];

@Injectable({
  providedIn: 'root'
})
export class RoleGuard implements CanActivate {
  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  canActivate(
    _route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot
  ): boolean {
    const user = this.authService.getUser();
    const role = (user?.roleName || '').toLowerCase();
    const url = state.url.split('?')[0];

    if (role === 'admin') {
      return true;
    }

    // Administration: admin only
    if (url.startsWith('/dashboard/administration')) {
      this.redirectToFirstAllowed(user);
      return false;
    }

    // Dashboard root
    if (url === '/dashboard' || url === '/dashboard/') {
      const allowed = !!user?.is_dashboard;
      if (!allowed) {
        this.redirectToFirstAllowed(user);
        return false;
      }
      return true;
    }

    // Settings: allow for any logged-in user
    if (url.startsWith('/dashboard/settings')) {
      return true;
    }

    // Check permission for known paths (truthy allows both boolean true and numeric 1 from API)
    for (const { path, permission } of ROUTE_PERMISSIONS) {
      if (path === '/dashboard') continue;
      if (url === path || url.startsWith(path + '/')) {
        const val = (user as unknown as Record<string, unknown>)?.[permission];
        if (!val) {
          this.redirectToFirstAllowed(user);
          return false;
        }
        return true;
      }
    }

    // Child routes (e.g. create, edit) inherit parent permission
    if (url.startsWith('/dashboard/staff/batch')) {
      if (!user?.is_batch) {
        this.redirectToFirstAllowed(user);
        return false;
      }
      return true;
    }
    if (url.startsWith('/dashboard/staff/course')) {
      if (!user?.is_course) {
        this.redirectToFirstAllowed(user);
        return false;
      }
      return true;
    }
    if (url.startsWith('/dashboard/staff/staff')) {
      if (!user?.is_staff) {
        this.redirectToFirstAllowed(user);
        return false;
      }
      return true;
    }
    if (url.startsWith('/dashboard/student/student')) {
      if (!user?.is_student) {
        this.redirectToFirstAllowed(user);
        return false;
      }
      return true;
    }
    if (url.startsWith('/dashboard/accounts/payment')) {
      if (!user?.is_payment) {
        this.redirectToFirstAllowed(user);
        return false;
      }
      return true;
    }
    if (url.startsWith('/dashboard/accounts/receipt')) {
      if (!user?.is_receipt) {
        this.redirectToFirstAllowed(user);
        return false;
      }
      return true;
    }
    if (url.startsWith('/dashboard/accounts/profit-loss')) {
      if (!user?.is_proftloss) {
        this.redirectToFirstAllowed(user);
        return false;
      }
      return true;
    }

    return true;
  }

  private redirectToFirstAllowed(user: import('../services/auth.service').User | null | undefined): void {
    const has = (key: string) => !!((user as unknown as Record<string, unknown>)?.[key]);
    let target = '/dashboard/settings';
    if (has('is_dashboard')) target = '/dashboard';
    else if (has('is_batch')) target = '/dashboard/staff/batch';
    else if (has('is_course')) target = '/dashboard/staff/course';
    else if (has('is_staff')) target = '/dashboard/staff/staff';
    else if (has('is_student')) target = '/dashboard/student/student';
    else if (has('is_payment')) target = '/dashboard/accounts/payment';
    else if (has('is_receipt')) target = '/dashboard/accounts/receipt';
    else if (has('is_proftloss')) target = '/dashboard/accounts/profit-loss';
    this.router.navigate([target]);
  }
}
