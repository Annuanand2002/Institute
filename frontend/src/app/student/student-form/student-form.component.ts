import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { ToastService } from '../../services/toast.service';
import { UserService, User } from '../../services/user.service';
import { CourseService, Course } from '../../services/course.service';
import { LoadingService } from '../../services/loading.service';

const STUDENT_ROLE_ID = 2; // Student role in user_role table

@Component({
  selector: 'app-student-form',
  templateUrl: './student-form.component.html',
  styleUrls: ['./student-form.component.css']
})
export class StudentFormComponent implements OnInit, OnDestroy {
  studentForm!: FormGroup;
  courses: Course[] = [];
  existingStudent: User | null = null;
  isSubmitting = false;
  isEditMode = false;
  studentId: number | null = null;
  profileImageDataUrl: string | null = null;
  private pendingProfileImage: string | null = null;
  private destroy$ = new Subject<void>();

  constructor(
    private fb: FormBuilder,
    private router: Router,
    private route: ActivatedRoute,
    private toastService: ToastService,
    private userService: UserService,
    private courseService: CourseService,
    private loadingService: LoadingService
  ) {}

  ngOnInit(): void {
    const url = this.router.url;
    this.isEditMode = url.includes('/edit');
    this.initializeForm();
    this.loadCourses();
    if (this.isEditMode) {
      this.route.paramMap.pipe(takeUntil(this.destroy$)).subscribe(params => {
        const id = params.get('id');
        this.studentId = id ? parseInt(id, 10) : null;
        if (this.studentId) {
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
    this.studentForm = this.fb.group({
      registration_no: [''],
      name: ['', [Validators.required, Validators.minLength(2)]],
      email: ['', Validators.email],
      personal_number: [''],
      course_id: [null],
      date_of_birth: [''],
      gender: [''],
      permanent_address: [''],
      local_address: [''],
      guardian_name: [''],
      relationship_with_guardian: [''],
      occupation_of_guardian: [''],
      is_active: [true],
      payment_mode: [''],
      adjustment_amount: ['']
    });
  }

  private loadCourses(): void {
    this.courseService.getCourses({ is_active: true }).subscribe({
      next: (response) => {
        if (response.success) this.courses = response.data || [];
      },
      error: () => {}
    });
  }

  private loadExistingData(): void {
    if (!this.studentId) return;
    this.profileImageDataUrl = null;
    this.pendingProfileImage = null;
    this.loadingService.show();
    this.userService.getUserById(this.studentId).subscribe({
      next: (response) => {
        if (response.success && response.data) {
          this.existingStudent = response.data;
          const u = response.data;
          this.profileImageDataUrl = (u as any).profile_image ?? null;
          this.studentForm.patchValue({
            registration_no: u.registration_no || '',
            name: u.name || '',
            email: u.email || '',
            personal_number: u.personal_number || '',
            course_id: u.course_id ?? null,
            date_of_birth: u.date_of_birth ? u.date_of_birth.toString().substring(0, 10) : '',
            gender: u.gender || '',
            permanent_address: u.permanent_address || '',
            local_address: u.local_address || '',
            guardian_name: u.guardian_name || '',
            relationship_with_guardian: u.relationship_with_guardian || '',
            occupation_of_guardian: u.occupation_of_guardian || '',
            is_active: u.is_active !== false,
            payment_mode: (u as any).payment_mode || '',
            adjustment_amount: (u as any).adjustment_amount ?? ''
          });
        }
        this.loadingService.hide();
      },
      error: () => {
        this.toastService.error('Failed to load student');
        this.loadingService.hide();
      }
    });
  }

  onSubmit(): void {
    if (this.studentForm.invalid) {
      this.markFormGroupTouched();
      this.toastService.error('Please fill all required fields correctly');
      return;
    }
    this.isSubmitting = true;
    const formValue = this.studentForm.getRawValue();

    const payment_mode = (formValue.payment_mode || '').toString() || undefined;
    const numericAdjustment = Number(formValue.adjustment_amount);

    const studentData: Partial<User> = {
      registration_no: formValue.registration_no || undefined,
      name: formValue.name,
      profile_image: this.pendingProfileImage || undefined,
      email: formValue.email || undefined,
      personal_number: formValue.personal_number || undefined,
      course_id: formValue.course_id ?? undefined,
      date_of_birth: formValue.date_of_birth || undefined,
      gender: formValue.gender || undefined,
      permanent_address: formValue.permanent_address || undefined,
      local_address: formValue.local_address || undefined,
      guardian_name: formValue.guardian_name || undefined,
      relationship_with_guardian: formValue.relationship_with_guardian || undefined,
      occupation_of_guardian: formValue.occupation_of_guardian || undefined,
      is_active: formValue.is_active,
      payment_mode,
      adjustment_amount: formValue.adjustment_amount === '' || Number.isNaN(numericAdjustment) ? undefined : numericAdjustment,
      user_role_id: STUDENT_ROLE_ID,
      application_date: this.isEditMode ? undefined : (new Date().toISOString().split('T')[0])
    };

    if (this.isEditMode && this.studentId && this.existingStudent) {
      const updateData: Partial<User> = {
        ...this.existingStudent,
        ...studentData,
        user_role_id: this.existingStudent.user_role_id || STUDENT_ROLE_ID
      };
      if (this.pendingProfileImage) updateData.profile_image = this.pendingProfileImage;
      this.userService.updateUser(this.studentId, updateData).subscribe({
        next: (response) => {
          this.isSubmitting = false;
          if (response.success) {
            this.toastService.success('Student updated successfully!');
            this.router.navigate(['/dashboard/student/student']);
          }
        },
        error: (err) => {
          this.isSubmitting = false;
          this.toastService.error(err?.error?.error || 'Failed to update student');
        }
      });
    } else {
      this.userService.createUser(studentData).subscribe({
        next: (response) => {
          this.isSubmitting = false;
          if (response.success) {
            this.toastService.success('Student created successfully!');
            this.router.navigate(['/dashboard/student/student']);
          }
        },
        error: (err) => {
          this.isSubmitting = false;
          this.toastService.error(err?.error?.error || 'Failed to create student');
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
    };
    reader.readAsDataURL(file);
    input.value = '';
  }

  onCancel(): void {
    this.router.navigate(['/dashboard/student/student']);
  }

  private markFormGroupTouched(): void {
    Object.keys(this.studentForm.controls).forEach(key => {
      this.studentForm.get(key)?.markAsTouched();
    });
  }

  get name() { return this.studentForm.get('name'); }
}
