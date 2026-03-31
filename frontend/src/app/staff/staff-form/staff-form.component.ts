import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { ToastService } from '../../services/toast.service';
import { UserService, User } from '../../services/user.service';
import { LoadingService } from '../../services/loading.service';

const STAFF_ROLE_ID = 3; // Staff role in user_role table

@Component({
  selector: 'app-staff-form',
  templateUrl: './staff-form.component.html',
  styleUrls: ['./staff-form.component.css']
})
export class StaffFormComponent implements OnInit, OnDestroy {
  staffForm!: FormGroup;
  existingStaff: User | null = null;
  isSubmitting = false;
  isEditMode = false;
  staffId: number | null = null;
  profileImageDataUrl: string | null = null;
  showProfileImageError = false;
  private pendingProfileImage: string | null = null;
  private destroy$ = new Subject<void>();

  constructor(
    private fb: FormBuilder,
    private router: Router,
    private route: ActivatedRoute,
    private toastService: ToastService,
    private userService: UserService,
    private loadingService: LoadingService
  ) {}

  ngOnInit(): void {
    const url = this.router.url;
    this.isEditMode = url.includes('/edit');
    this.initializeForm();
    if (this.isEditMode) {
      this.route.paramMap.pipe(
        takeUntil(this.destroy$)
      ).subscribe(params => {
        const id = params.get('id');
        this.staffId = id ? parseInt(id, 10) : null;
        if (this.staffId) {
          this.loadExistingData();
        }
      });
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private initializeForm(): void {
    this.staffForm = this.fb.group({
      registration_no: ['', [Validators.required]],
      name: ['', [Validators.required, Validators.minLength(2)]],
      email: ['', Validators.email],
      personal_number: [''],
      educational_qualification: [''],
      permanent_address: [''],
      local_address: [''],
      date_of_birth: ['', [Validators.required]],
      gender: ['', [Validators.required]],
      is_active: [null as boolean | null, [Validators.required]]
    });
  }

  private loadExistingData(): void {
    if (!this.staffId) return;
    this.profileImageDataUrl = null;
    this.pendingProfileImage = null;
    this.loadingService.show();
    this.userService.getUserById(this.staffId).subscribe({
      next: (response) => {
        if (response.success && response.data) {
          this.existingStaff = response.data;
          const u = response.data;
          this.profileImageDataUrl = (u as any).profile_image ?? null;
          this.staffForm.patchValue({
            name: u.name || '',
            email: u.email || '',
            personal_number: u.personal_number || '',
            educational_qualification: u.educational_qualification || '',
            permanent_address: u.permanent_address || '',
            local_address: u.local_address || '',
            date_of_birth: u.date_of_birth ? u.date_of_birth.toString().substring(0, 10) : '',
            gender: u.gender || '',
            is_active: u.is_active !== false
          });
        }
        this.loadingService.hide();
      },
      error: () => {
        this.toastService.error('Failed to load staff');
        this.loadingService.hide();
      }
    });
  }

  onSubmit(): void {
    if (!this.profileImageDataUrl && !this.pendingProfileImage) {
      this.showProfileImageError = true;
      this.toastService.error('Profile image is required');
      return;
    }

    if (this.staffForm.invalid) {
      this.markFormGroupTouched();
      this.toastService.error('Please fill all required fields correctly');
      return;
    }
    this.isSubmitting = true;
    const formValue = this.staffForm.getRawValue();
    const staffData: Partial<User> = {
      registration_no: formValue.registration_no || undefined,
      name: formValue.name,
      profile_image: this.pendingProfileImage || undefined,
      email: formValue.email || undefined,
      personal_number: formValue.personal_number || undefined,
      educational_qualification: formValue.educational_qualification || undefined,
      permanent_address: formValue.permanent_address || undefined,
      local_address: formValue.local_address || undefined,
      date_of_birth: formValue.date_of_birth || undefined,
      gender: formValue.gender || undefined,
      is_active: formValue.is_active,
      user_role_id: STAFF_ROLE_ID
    };

    if (this.isEditMode && this.staffId && this.existingStaff) {
      const updateData: Partial<User> = {
        ...this.existingStaff,
        ...staffData,
        user_role_id: this.existingStaff.user_role_id || STAFF_ROLE_ID
      };
      this.userService.updateUser(this.staffId, updateData).subscribe({
        next: (response) => {
          this.isSubmitting = false;
          if (response.success) {
            this.toastService.success('Staff updated successfully!');
            this.router.navigate(['/dashboard/staff/staff']);
          }
        },
        error: (err) => {
          this.isSubmitting = false;
          this.toastService.error(err?.error?.error || 'Failed to update staff');
        }
      });
    } else {
      this.userService.createUser(staffData).subscribe({
        next: (response) => {
          this.isSubmitting = false;
          if (response.success) {
            this.toastService.success('Staff created successfully!');
            this.router.navigate(['/dashboard/staff/staff']);
          }
        },
        error: (err) => {
          this.isSubmitting = false;
          this.toastService.error(err?.error?.error || 'Failed to create staff');
        }
      });
    }
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
      this.showProfileImageError = false;
    };
    reader.readAsDataURL(file);
    input.value = '';
  }

  onCancel(): void {
    this.router.navigate(['/dashboard/staff/staff']);
  }

  private markFormGroupTouched(): void {
    Object.keys(this.staffForm.controls).forEach(key => {
      this.staffForm.get(key)?.markAsTouched();
    });
  }

  get name() { return this.staffForm.get('name'); }
  get registrationNo() { return this.staffForm.get('registration_no'); }
  get dateOfBirth() { return this.staffForm.get('date_of_birth'); }
  get gender() { return this.staffForm.get('gender'); }
  get isActive() { return this.staffForm.get('is_active'); }
}
