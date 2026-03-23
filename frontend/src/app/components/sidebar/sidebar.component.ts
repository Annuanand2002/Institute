import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges, OnInit, ViewChild, ElementRef } from '@angular/core';
import { Router } from '@angular/router';
import { User } from '../../services/auth.service';

interface NavItem {
  label: string;
  icon: string;
  route: string;
  category: string;
  module?: string;
  /** Permission key on user (e.g. is_dashboard). If not set, item is shown when module is shown. */
  permission?: keyof User;
}

interface NavModule {
  name: string;
  items: NavItem[];
  /** If set, only admins see this module (no permission flag). */
  adminOnly?: boolean;
}

@Component({
  selector: 'app-sidebar',
  templateUrl: './sidebar.component.html',
  styleUrls: ['./sidebar.component.css']
})
export class SidebarComponent implements OnInit, OnChanges {
  @Input() collapsed = false;
  @Input() orgName: string | null = null;
  @Input() orgLogo: string | null = null;
  /** Current user (role + permissions). Admin sees all; others see modules where permission is true. */
  @Input() user: User | null = null;
  @Output() toggleSidebar = new EventEmitter<void>();
  @Output() logout = new EventEmitter<void>();

  @ViewChild('navMenu') navMenu?: ElementRef<HTMLDivElement>;

  searchQuery = '';

  navModules: NavModule[] = [
    {
      name: 'Dashboard',
      items: [
        { label: 'Dashboard', icon: 'dashboard', route: '/dashboard', category: 'main', permission: 'is_dashboard' }
      ]
    },
    {
      name: 'Administration Module',
      adminOnly: true,
      items: [
        { label: 'Organisation', icon: 'business', route: '/dashboard/administration/organisation', category: 'administration', module: 'Administration Module' },
        { label: 'User Management', icon: 'people', route: '/dashboard/administration/user-management', category: 'administration', module: 'Administration Module' }
      ]
    },
    {
      name: 'Staff Module',
      items: [
        { label: 'Batch', icon: 'groups', route: '/dashboard/staff/batch', category: 'staff', module: 'Staff Module', permission: 'is_batch' },
        { label: 'Course', icon: 'book', route: '/dashboard/staff/course', category: 'staff', module: 'Staff Module', permission: 'is_course' },
        { label: 'Staff', icon: 'person', route: '/dashboard/staff/staff', category: 'staff', module: 'Staff Module', permission: 'is_staff' }
      ]
    },
    {
      name: 'Student Module',
      items: [
        { label: 'Student', icon: 'school', route: '/dashboard/student/student', category: 'student', module: 'Student Module', permission: 'is_student' },
        { label: 'Report', icon: 'assessment', route: '/dashboard/student/report', category: 'student', module: 'Student Module', permission: 'is_student' }
      ]
    },
    {
      name: 'Accounts Module',
      items: [
        { label: 'Payment', icon: 'payment', route: '/dashboard/accounts/payment', category: 'accounts', module: 'Accounts Module', permission: 'is_payment' },
        { label: 'Receipt', icon: 'receipt', route: '/dashboard/accounts/receipt', category: 'accounts', module: 'Accounts Module', permission: 'is_receipt' },
        { label: 'Profit & Loss', icon: 'assessment', route: '/dashboard/accounts/profit-loss', category: 'accounts', module: 'Accounts Module', permission: 'is_proftloss' }
      ]
    },
    {
      name: 'Settings',
      items: [
        { label: 'Settings', icon: 'settings', route: '/dashboard/settings', category: 'settings', module: 'Settings' }
      ]
    }
  ];

  filteredModules: NavModule[] = [];

  constructor(private router: Router) {}

  ngOnInit(): void {
    this.applyFilters();
  }

  /** Modules visible for current user: Admin = all; others = by permission flags. */
  get visibleNavModules(): NavModule[] {
    const u = this.user;
    const isAdmin = (u?.roleName || '').toLowerCase() === 'admin';

    if (isAdmin) return this.navModules;

    const out: NavModule[] = [];
    for (const mod of this.navModules) {
      if (mod.adminOnly) continue;
      const filteredItems = mod.items.filter(item => {
        if (!item.permission) return true;
        const val = u?.[item.permission];
        return val === true || val === 1;
      });
      if (filteredItems.length > 0) {
        out.push({ ...mod, items: filteredItems });
      }
    }
    // Settings: show for everyone when not admin
    const settingsMod = this.navModules.find(m => m.name === 'Settings');
    if (settingsMod && !out.some(m => m.name === 'Settings')) {
      out.push(settingsMod);
    }
    return out;
  }

  private applyFilters(): void {
    const base = this.visibleNavModules;
    if (!this.searchQuery.trim()) {
      this.filteredModules = base.map(m => ({ ...m, items: [...m.items] }));
      return;
    }
    const query = this.searchQuery.toLowerCase();
    this.filteredModules = base.map(module => ({
      ...module,
      items: module.items.filter(item =>
        item.label.toLowerCase().includes(query) ||
        item.category.toLowerCase().includes(query) ||
        (item.module?.toLowerCase().includes(query) ?? false)
      )
    })).filter(module => module.items.length > 0);
  }

  ngOnChanges(_changes: SimpleChanges): void {
    this.applyFilters();
  }

  onSearchChange(): void {
    this.applyFilters();
  }

  navigateTo(route: string): void {
    const currentScroll = this.navMenu?.nativeElement.scrollTop ?? 0;
    this.router.navigate([route]).then(() => {
      // Restore sidebar scroll so it doesn't jump back to top after routing
      if (this.navMenu) {
        this.navMenu.nativeElement.scrollTop = currentScroll;
      }
    });
  }

  isActive(route: string): boolean {
    const currentUrl = this.router.url;
    if (route === '/dashboard') {
      return currentUrl === '/dashboard';
    }
    return currentUrl.startsWith(route);
  }

  getIconPath(icon: string): string {
    const icons: { [key: string]: string } = {
      dashboard: 'M3 13H11V3H3V13ZM3 21H11V15H3V21ZM13 21H21V11H13V21ZM13 3V9H21V3H13Z',
      business: 'M12 7V3H2V21H22V7H12ZM6 19H4V17H6V19ZM6 15H4V13H6V15ZM6 11H4V9H6V11ZM6 7H4V5H6V7ZM10 19H8V17H10V19ZM10 15H8V13H10V15ZM10 11H8V9H10V11ZM10 7H8V5H10V7ZM20 19H12V17H14V15H12V13H14V11H12V9H20V19ZM18 11H16V13H18V11ZM18 15H16V17H18V15Z',
      people: 'M16 7C16 9.20914 14.2091 11 12 11C9.79086 11 8 9.20914 8 7C8 4.79086 9.79086 3 12 3C14.2091 3 16 4.79086 16 7ZM12 14C16.4183 14 20 15.7909 20 18V20H4V18C4 15.7909 7.58172 14 12 14ZM20.5 14.5C22.9853 14.5 25 15.5147 25 17V20H22V17C22 16.1101 21.2341 15.5 20.5 15.5ZM3.5 14.5C2.76586 15.5 2 16.1101 2 17V20H-1V17C-1 15.5147 1.01472 14.5 3.5 14.5ZM6.5 14.5C8.98528 14.5 11 15.5147 11 17V20H2V17C2 15.5147 4.01472 14.5 6.5 14.5ZM17.5 14.5C19.9853 14.5 22 15.5147 22 17V20H13V17C13 15.5147 15.0147 14.5 17.5 14.5Z',
      groups: 'M12 12C14.21 12 16 10.21 16 8C16 5.79 14.21 4 12 4C9.79 4 8 5.79 8 8C8 10.21 9.79 12 12 12ZM12 14C9.33 14 4 15.34 4 18V20H20V18C20 15.34 14.67 14 12 14ZM16.5 12.5C18.43 12.5 20 11.43 20 10C20 8.57 18.43 7.5 16.5 7.5C15.56 7.5 14.73 7.95 14.22 8.62C14.4 8.42 14.5 8.22 14.5 8C14.5 6.9 13.6 6 12.5 6C11.4 6 10.5 6.9 10.5 8C10.5 8.22 10.6 8.42 10.78 8.62C10.27 7.95 9.44 7.5 8.5 7.5C6.57 7.5 5 8.57 5 10C5 11.43 6.57 12.5 8.5 12.5C9.44 12.5 10.27 12.05 10.78 11.38C10.6 11.58 10.5 11.78 10.5 12C10.5 13.1 11.4 14 12.5 14C13.6 14 14.5 13.1 14.5 12C14.5 11.78 14.4 11.58 14.22 11.38C14.73 12.05 15.56 12.5 16.5 12.5Z',
      person: 'M12 12C14.21 12 16 10.21 16 8C16 5.79 14.21 4 12 4C9.79 4 8 5.79 8 8C8 10.21 9.79 12 12 12ZM12 14C9.33 14 4 15.34 4 18V20H20V18C20 15.34 14.67 14 12 14Z',
      school: 'M5 13.18V17L12 21L19 17V13.18L12 17L5 13.18ZM12 3L1 9L12 15L23 9L12 3Z',
      book: 'M18 2H6C4.9 2 4 2.9 4 4V20C4 21.1 4.9 22 6 22H18C19.1 22 20 21.1 20 20V4C20 2.9 19.1 2 18 2ZM6 4H11V12L8.5 10.5L6 12V4Z',
      payment: 'M20 4H4C2.89 4 2.01 4.89 2.01 6L2 18C2 19.11 2.89 20 4 20H20C21.11 20 22 19.11 22 18V6C22 4.89 21.11 4 20 4ZM20 18H4V8H20V18ZM20 6H4V6H20Z',
      receipt: 'M19 3H5C3.9 3 3 3.9 3 5V19L7 17L11 19L15 17L19 19V5C19 3.9 18.1 3 17 3H19ZM7 7H17V9H7V7ZM7 11H17V13H7V11ZM7 15H13V17H7V15Z',
      assessment: 'M19 3H5C3.9 3 3 3.9 3 5V19C3 20.1 3.9 21 5 21H19C20.1 21 21 20.1 21 19V5C21 3.9 20.1 3 19 3ZM9 17H7V10H9V17ZM13 17H11V7H13V17ZM17 17H15V13H17V17Z',
      settings: 'M19.14 12.94C19.18 12.64 19.2 12.33 19.2 12C19.2 11.67 19.18 11.36 19.14 11.06L21.16 9.48C21.34 9.33 21.38 9.07 21.24 8.87L19.24 6.13C19.1 5.93 18.84 5.88 18.64 6.01L16.35 7.5C15.85 7.1 15.28 6.78 14.66 6.56L14.36 4.1C14.33 3.88 14.15 3.72 13.93 3.72H10.07C9.85 3.72 9.67 3.88 9.64 4.1L9.34 6.56C8.72 6.78 8.15 7.1 7.65 7.5L5.36 6.01C5.16 5.88 4.9 5.93 4.76 6.13L2.76 8.87C2.62 9.07 2.66 9.33 2.84 9.48L4.86 11.06C4.82 11.36 4.8 11.67 4.8 12C4.8 12.33 4.82 12.64 4.86 12.94L2.84 14.52C2.66 14.67 2.62 14.93 2.76 15.13L4.76 17.87C4.9 18.07 5.16 18.12 5.36 17.99L7.65 16.5C8.15 16.9 8.72 17.22 9.34 17.44L9.64 19.9C9.67 20.12 9.85 20.28 10.07 20.28H13.93C14.15 20.28 14.33 20.12 14.36 19.9L14.66 17.44C15.28 17.22 15.85 16.9 16.35 16.5L18.64 17.99C18.84 18.12 19.1 18.07 19.24 17.87L21.24 15.13C21.38 14.93 21.34 14.67 21.16 14.52L19.14 12.94ZM12 15.6C10.02 15.6 8.4 13.98 8.4 12C8.4 10.02 10.02 8.4 12 8.4C13.98 8.4 15.6 10.02 15.6 12C15.6 13.98 13.98 15.6 12 15.6Z'
    };
    return icons[icon] || icons['person'];
  }
}
