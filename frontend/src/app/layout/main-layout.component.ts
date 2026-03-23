import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { ShortcutService } from '../services/shortcut.service';
import { ToastService } from '../services/toast.service';
import { OrganisationService } from '../services/organisation.service';

@Component({
  selector: 'app-main-layout',
  templateUrl: './main-layout.component.html',
  styleUrls: ['./main-layout.component.css']
})
export class MainLayoutComponent implements OnInit {
  isSidebarOpen = true;
  orgName: string | null = null;
  orgLogo: string | null = null;
  /** Current user for sidebar (permissions + role) */
  get currentUser() {
    return this.authService.getUser();
  }

  constructor(
    private authService: AuthService,
    private shortcutService: ShortcutService,
    private router: Router,
    private toastService: ToastService,
    private organisationService: OrganisationService
  ) {}

  ngOnInit(): void {
    this.loadOrganisationForHeader();
    this.shortcutService.registerShortcut({
      key: 'd', ctrlKey: true, shiftKey: true,
      action: () => this.router.navigate(['/dashboard']),
      description: 'Go to Dashboard'
    });
    this.shortcutService.registerShortcut({
      key: '?',
      action: () => this.showShortcutsHelp(),
      description: 'Show keyboard shortcuts'
    });
  }

  private loadOrganisationForHeader(): void {
    this.organisationService.getAll().subscribe({
      next: (res) => {
        if (!res.success || !res.data || res.data.length === 0) return;
        const first = res.data[0];
        const id = first.id ?? (first as any).id;
        if (id == null) return;
        this.organisationService.getById(id).subscribe({
          next: (orgRes) => {
            if (!orgRes.success || !orgRes.data) return;
            const org = orgRes.data;
            this.orgName = org.org_name || null;
            this.orgLogo = org.logo || null;
            if (org.org_name) {
              document.title = org.org_name + ' - Institution Management';
            }
            if (org.logo && typeof org.logo === 'string') {
              const link = document.querySelector('link[rel="icon"]') as HTMLLinkElement;
              if (link) {
                if (org.logo.indexOf('svg') !== -1) link.type = 'image/svg+xml';
                else if (org.logo.indexOf('jpeg') !== -1 || org.logo.indexOf('jpg') !== -1) link.type = 'image/jpeg';
                else link.type = 'image/png';
                link.href = org.logo;
              }
            }
          }
        });
      }
    });
  }

  private showShortcutsHelp(): void {
    this.toastService.info('Shortcuts: Ctrl+Shift+D = Dashboard, Ctrl+S = Save (in forms), Esc = Close');
  }

  toggleSidebar(): void {
    this.isSidebarOpen = !this.isSidebarOpen;
  }

  logout(): void {
    this.authService.logout();
  }
}
