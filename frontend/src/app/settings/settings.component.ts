import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Subscription } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { UserService, User } from '../services/user.service';
import { ToastService } from '../services/toast.service';
import { LoadingService } from '../services/loading.service';
import { ThemeService, ThemeMode } from '../services/theme.service';

@Component({
  selector: 'app-settings',
  templateUrl: './settings.component.html',
  styleUrls: ['./settings.component.css']
})
export class SettingsComponent implements OnInit, OnDestroy {
  title = 'Settings';
  profile: User | null = null;
  profileForm!: FormGroup;
  isSaving = false;
  profileImageDataUrl: string | null = null;
  isLoadingProfile = true;
  currentTheme: ThemeMode = 'light';
  private pendingProfileImage: string | null = null;
  private themeSub?: Subscription;

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private userService: UserService,
    private toastService: ToastService,
    private loadingService: LoadingService,
    private themeService: ThemeService
  ) {}

  ngOnInit(): void {
    this.profileForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(2)]],
      email: [''],
      personal_number: ['']
    });
    this.loadProfile();
    this.themeSub = this.themeService.theme$.subscribe(theme => {
      this.currentTheme = theme;
    });
  }

  ngOnDestroy(): void {
    this.themeSub?.unsubscribe();
  }

  toggleTheme(): void {
    this.themeService.toggleTheme();
  }

  setTheme(mode: ThemeMode): void {
    this.themeService.setTheme(mode);
  }

  private loadProfile(): void {
    const currentUser = this.authService.getUser();
    if (!currentUser?.id) {
      this.toastService.error('Not logged in');
      return;
    }
    this.loadingService.show();
    this.isLoadingProfile = true;
    this.userService.getUserById(currentUser.id).subscribe({
      next: (res) => {
        this.loadingService.hide();
        this.isLoadingProfile = false;
        if (res.success && res.data) {
          this.profile = res.data;
          this.profileImageDataUrl = res.data.profile_image || null;
          this.profileForm.patchValue({
            name: res.data.name || '',
            email: res.data.email || '',
            personal_number: res.data.personal_number || ''
          });
        }
      },
      error: () => {
        this.loadingService.hide();
        this.isLoadingProfile = false;
        this.toastService.error('Failed to load profile');
      }
    });
  }

  get displayUsername(): string {
    return this.authService.getUser()?.username || '—';
  }

  get displayRole(): string {
    return this.authService.getUser()?.roleName || this.profile?.role_name || '—';
  }

  get displayRegistrationNo(): string {
    return this.profile?.registration_no || '—';
  }

  onProfileImageChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file || !file.type.startsWith('image/')) {
      this.toastService.error('Please select an image file (JPEG, PNG, etc.)');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      this.profileImageDataUrl = dataUrl;
      this.pendingProfileImage = dataUrl;
    };
    reader.readAsDataURL(file);
    input.value = '';
  }

  saveProfile(): void {
    if (this.profileForm.invalid || !this.profile?.id) {
      this.profileForm.markAllAsTouched();
      return;
    }
    const value = this.profileForm.getRawValue();
    const payload: any = {
      name: value.name,
      email: value.email || undefined,
      personal_number: value.personal_number || undefined
    };
    if (this.pendingProfileImage) {
      payload.profile_image = this.pendingProfileImage;
    }
    this.isSaving = true;
    this.userService.updateUser(this.profile.id, payload).subscribe({
      next: (res) => {
        this.isSaving = false;
        if (res.success && res.data) {
          this.profile = res.data;
          this.profileImageDataUrl = res.data.profile_image || null;
          this.pendingProfileImage = null;
          this.toastService.success('Profile updated successfully');
        }
      },
      error: () => {
        this.isSaving = false;
        this.toastService.error('Failed to update profile');
      }
    });
  }
}
