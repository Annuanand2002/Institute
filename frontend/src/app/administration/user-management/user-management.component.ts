import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormBuilder, FormGroup, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { ToastService } from '../../services/toast.service';
import { UserProfileService } from '../../services/user-profile.service';
import { UserService } from '../../services/user.service';
import { LoadingService } from '../../services/loading.service';
import { ShortcutService } from '../../services/shortcut.service';

@Component({
  selector: 'app-user-management',
  templateUrl: './user-management.component.html',
  styleUrls: ['./user-management.component.css']
})
export class UserManagementComponent implements OnInit, OnDestroy {
  userForm!: FormGroup;
  staffList: any[] = [];
  isSubmitting = false;
  isCreateMode = false;
  isEditMode = false;
  profileId: number | null = null;
  private destroy$ = new Subject<void>();

  constructor(
    private fb: FormBuilder,
    private router: Router,
    private route: ActivatedRoute,
    private toastService: ToastService,
    private userProfileService: UserProfileService,
    private userService: UserService,
    private loadingService: LoadingService,
    private shortcutService: ShortcutService
  ) {}

  ngOnInit(): void {
    this.shortcutService.saveRequested$.pipe(takeUntil(this.destroy$)).subscribe(() => this.onSubmit());
    const url = this.router.url;
    this.isCreateMode = url.includes('/create');
    this.isEditMode = url.includes('/edit');

    if (this.isEditMode) {
      const id = this.route.snapshot.paramMap.get('id');
      this.profileId = id ? parseInt(id, 10) : null;
    }

    this.initializeForm();
    this.loadStaff();

    if (this.isCreateMode) {
      this.generateUserId();
    } else if (this.isEditMode && this.profileId) {
      this.loadExistingData();
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private loadStaff(): void {
    if (this.isCreateMode) {
      this.loadStaffListForCreate();
    }
  }

  /** For edit mode: load staff list including current profile's staff and staff without a profile */
  private loadStaffForEdit(currentStaffId: number): void {
    this.userService.getUsers({ role: 'Staff', is_active: true }).subscribe({
      next: (usersRes) => {
        if (usersRes.success) {
          this.userProfileService.getAll().subscribe({
            next: (profilesRes) => {
              if (profilesRes.success) {
                const staffIdsWithProfile = new Set((profilesRes.data || []).map(p => p.staff_id));
                const excludeRole1And5 = (u: any) => u.user_role_id !== 1 && u.user_role_id !== 5 && (u.role_name || '').toLowerCase() !== 'admin';
                this.staffList = (usersRes.data || []).filter(
                  u => u.id != null && excludeRole1And5(u) && (!staffIdsWithProfile.has(u.id) || u.id === currentStaffId)
                );
              } else {
                this.staffList = (usersRes.data || []).filter(u => u.id != null && u.user_role_id !== 1 && u.user_role_id !== 5 && (u.role_name || '').toLowerCase() !== 'admin');
              }
            },
            error: () => {
              this.staffList = (usersRes.data || []).filter(u => u.id != null && u.user_role_id !== 1 && u.user_role_id !== 5 && (u.role_name || '').toLowerCase() !== 'admin');
            }
          });
        }
      },
      error: () => this.toastService.error('Failed to load staff list')
    });
  }

  private loadStaffListForCreate(): void {
    this.userService.getUsers({ role: 'Staff', is_active: true }).subscribe({
      next: (usersRes) => {
        if (usersRes.success) {
          this.userProfileService.getAll().subscribe({
            next: (profilesRes) => {
              if (profilesRes.success) {
                const staffIdsWithProfile = new Set((profilesRes.data || []).map(p => p.staff_id));
                const excludeRole1And5 = (u: any) => u.user_role_id !== 1 && u.user_role_id !== 5 && (u.role_name || '').toLowerCase() !== 'admin';
                this.staffList = (usersRes.data || [])
                  .filter(u => u.id != null && excludeRole1And5(u) && !staffIdsWithProfile.has(u.id));
              } else {
                this.staffList = (usersRes.data || []).filter(u => u.id != null && u.user_role_id !== 1 && u.user_role_id !== 5 && (u.role_name || '').toLowerCase() !== 'admin');
              }
            },
            error: () => {
              this.staffList = (usersRes.data || []).filter(u => u.id != null && u.user_role_id !== 1 && u.user_role_id !== 5 && (u.role_name || '').toLowerCase() !== 'admin');
            }
          });
        }
      },
      error: () => this.toastService.error('Failed to load staff list')
    });
  }

  private generateUserId(): void {
    this.userProfileService.getAll().subscribe({
      next: (response) => {
        if (response.success && response.data.length > 0) {
          const maxId = Math.max(...response.data.map(u => u.id || 0));
          this.userForm.patchValue({ userId: `USR${String(maxId + 1).padStart(4, '0')}` });
        } else {
          this.userForm.patchValue({ userId: 'USR0001' });
        }
      },
      error: () => this.userForm.patchValue({ userId: 'USR0001' })
    });
  }

  private loadExistingData(): void {
    if (!this.profileId) return;
    this.loadingService.show();
    this.userProfileService.getById(this.profileId).subscribe({
      next: (response) => {
        if (response.success) {
          const p = response.data;
          this.loadStaffForEdit(p.staff_id);
          this.userForm.patchValue({
            staff: String(p.staff_id),
            username: p.username ?? '',
            canLogin: p.can_login !== false,
            is_batch: !!p.is_batch,
            is_course: !!p.is_course,
            is_staff: !!p.is_staff,
            is_student: !!p.is_student,
            is_payment: !!p.is_payment,
            is_receipt: !!p.is_receipt,
            is_proftloss: !!p.is_proftloss
          });
          const userIdCtrl = this.userForm.get('userId');
          if (userIdCtrl) {
            userIdCtrl.setValue(`USR${String(p.id).padStart(4, '0')}`);
          }
        }
        this.loadingService.hide();
      },
      error: () => {
        this.toastService.error('Failed to load user');
        this.loadingService.hide();
      }
    });
  }

  private initializeForm(): void {
    this.userForm = this.fb.group({
      staff: ['', [Validators.required]],
      userId: [{ value: '', disabled: true }],
      username: ['', [Validators.required, Validators.minLength(3)]],
      password: [''],
      confirmPassword: [''],
      canLogin: [true],
      is_batch: [false],
      is_course: [false],
      is_staff: [false],
      is_student: [false],
      is_payment: [false],
      is_receipt: [false],
      is_proftloss: [false]
    }, {
      validators: this.isCreateMode ? this.passwordMatchValidator : []
    });

    if (!this.isCreateMode) {
      this.userForm.get('password')?.clearValidators();
      this.userForm.get('confirmPassword')?.clearValidators();
    } else {
      this.userForm.get('password')?.setValidators([Validators.required, Validators.minLength(6)]);
      this.userForm.get('confirmPassword')?.setValidators([Validators.required]);
    }
  }

  private passwordMatchValidator(control: AbstractControl): ValidationErrors | null {
    const password = control.get('password');
    const confirmPassword = control.get('confirmPassword');
    if (password && confirmPassword && password.value && password.value !== confirmPassword.value) {
      return { passwordMismatch: true };
    }
    return null;
  }

  onStaffChange(): void {
    const staffId = this.userForm.get('staff')?.value;
    if (staffId && !this.userForm.get('username')?.value) {
      const staff = this.staffList.find(s => s.id === parseInt(staffId, 10));
      if (staff?.name) {
        const username = staff.name.toLowerCase().replace(/\s+/g, '.').replace(/[^a-z0-9.]/g, '');
        this.userForm.patchValue({ username });
      }
    }
  }

  onSubmit(): void {
    if (this.userForm.invalid) {
      this.markFormGroupTouched();
      this.toastService.error('Please fill all required fields correctly');
      return;
    }

    const formValue = this.userForm.getRawValue();

    if (this.isCreateMode) {
      if (!formValue.staff) {
        this.toastService.error('Please select a staff member');
        return;
      }
      this.isSubmitting = true;
      this.userProfileService.create({
        user_id: parseInt(formValue.staff, 10),
        username: formValue.username,
        password: formValue.password,
        role: 'Staff',
        can_login: formValue.canLogin,
        is_batch: formValue.is_batch,
        is_course: formValue.is_course,
        is_staff: formValue.is_staff,
        is_student: formValue.is_student,
        is_payment: formValue.is_payment,
        is_receipt: formValue.is_receipt,
        is_proftloss: formValue.is_proftloss
      }).subscribe({
        next: (response) => {
          this.isSubmitting = false;
          if (response.success) {
            this.toastService.success('User created successfully!');
            this.router.navigate(['/dashboard/administration/user-management']);
          }
        },
        error: (err) => {
          this.isSubmitting = false;
          this.toastService.error(err.error?.error || 'Failed to create user');
        }
      });
    } else if (this.profileId) {
      if (formValue.password && formValue.password.length < 6) {
        this.toastService.error('Password must be at least 6 characters');
        return;
      }
      this.isSubmitting = true;
      const updateData: any = {
        can_login: formValue.canLogin,
        is_batch: formValue.is_batch,
        is_course: formValue.is_course,
        is_staff: formValue.is_staff,
        is_student: formValue.is_student,
        is_payment: formValue.is_payment,
        is_receipt: formValue.is_receipt,
        is_proftloss: formValue.is_proftloss
      };
      if (formValue.username) updateData.username = formValue.username;
      if (formValue.password && formValue.password.trim()) updateData.password = formValue.password;
      if (formValue.staff) updateData.staff_id = parseInt(formValue.staff, 10);

      this.userProfileService.update(this.profileId, updateData).subscribe({
        next: (response) => {
          this.isSubmitting = false;
          if (response.success) {
            this.toastService.success('User updated successfully!');
            this.router.navigate(['/dashboard/administration/user-management']);
          }
        },
        error: (err) => {
          this.isSubmitting = false;
          this.toastService.error(err.error?.error || 'Failed to update user');
        }
      });
    }
  }

  onCancel(): void {
    this.router.navigate(['/dashboard/administration/user-management']);
  }

  private markFormGroupTouched(): void {
    Object.keys(this.userForm.controls).forEach(key => {
      this.userForm.get(key)?.markAsTouched();
    });
  }

  get staff() { return this.userForm.get('staff'); }
  get userId() { return this.userForm.get('userId'); }
  get username() { return this.userForm.get('username'); }
  get password() { return this.userForm.get('password'); }
  get confirmPassword() { return this.userForm.get('confirmPassword'); }
}
