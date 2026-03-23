import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { ToastService } from '../../services/toast.service';
import { CourseService, Course } from '../../services/course.service';
import { BatchService, Batch } from '../../services/batch.service';
import { LoadingService } from '../../services/loading.service';

@Component({
  selector: 'app-course-form',
  templateUrl: './course-form.component.html',
  styleUrls: ['./course-form.component.css']
})
export class CourseFormComponent implements OnInit {
  courseForm!: FormGroup;
  batches: Batch[] = [];
  isSubmitting = false;
  isEditMode = false;
  courseId: number | null = null;

  constructor(
    private fb: FormBuilder,
    private router: Router,
    private route: ActivatedRoute,
    private toastService: ToastService,
    private courseService: CourseService,
    private batchService: BatchService,
    private loadingService: LoadingService
  ) {}

  ngOnInit(): void {
    const url = this.router.url;
    this.isEditMode = url.includes('/edit');
    if (this.isEditMode) {
      const id = this.route.snapshot.paramMap.get('id');
      this.courseId = id ? parseInt(id, 10) : null;
    }
    this.initializeForm();
    this.loadBatches();
    if (this.isEditMode && this.courseId) {
      this.loadExistingData();
    }
  }

  private initializeForm(): void {
    this.courseForm = this.fb.group({
      course_code: [''],
      course_name: ['', [Validators.required, Validators.minLength(2)]],
      description: [''],
      duration: [''],
      total_fee: [null as number | null],
      batch_id: [null as number | null],
      is_active: [true]
    });
  }

  private loadBatches(): void {
    this.batchService.getBatches().subscribe({
      next: (response) => {
        if (response.success) this.batches = response.data;
      }
    });
  }

  private loadExistingData(): void {
    if (!this.courseId) return;
    this.loadingService.show();
    this.courseService.getCourseById(this.courseId).subscribe({
      next: (response) => {
        if (response.success && response.data) {
          const c = response.data;
          this.courseForm.patchValue({
            course_code: c.course_code || '',
            course_name: c.course_name || '',
            description: c.description || '',
            duration: c.duration || '',
            total_fee: c.total_fee ?? null,
            batch_id: c.batch_id ?? null,
            is_active: c.is_active !== false
          });
        }
        this.loadingService.hide();
      },
      error: () => {
        this.toastService.error('Failed to load course');
        this.loadingService.hide();
      }
    });
  }

  onSubmit(): void {
    if (this.courseForm.invalid) {
      this.markFormGroupTouched();
      this.toastService.error('Please fill all required fields correctly');
      return;
    }
    this.isSubmitting = true;
    const formValue = this.courseForm.getRawValue();
    const courseData: Partial<Course> = {
      course_code: formValue.course_code || undefined,
      course_name: formValue.course_name,
      description: formValue.description || undefined,
      duration: formValue.duration || undefined,
      total_fee: formValue.total_fee != null && formValue.total_fee !== '' ? parseFloat(formValue.total_fee) : undefined,
      batch_id: formValue.batch_id != null && formValue.batch_id !== '' ? parseInt(formValue.batch_id, 10) : undefined,
      is_active: formValue.is_active
    };

    if (this.isEditMode && this.courseId) {
      this.courseService.updateCourse(this.courseId, courseData).subscribe({
        next: (response) => {
          this.isSubmitting = false;
          if (response.success) {
            this.toastService.success('Course updated successfully!');
            this.router.navigate(['/dashboard/staff/course']);
          }
        },
        error: (err) => {
          this.isSubmitting = false;
          this.toastService.error(err?.error?.error || 'Failed to update course');
        }
      });
    } else {
      this.courseService.createCourse(courseData).subscribe({
        next: (response) => {
          this.isSubmitting = false;
          if (response.success) {
            this.toastService.success('Course created successfully!');
            this.router.navigate(['/dashboard/staff/course']);
          }
        },
        error: (err) => {
          this.isSubmitting = false;
          this.toastService.error(err?.error?.error || 'Failed to create course');
        }
      });
    }
  }

  onCancel(): void {
    this.router.navigate(['/dashboard/staff/course']);
  }

  private markFormGroupTouched(): void {
    Object.keys(this.courseForm.controls).forEach(key => {
      this.courseForm.get(key)?.markAsTouched();
    });
  }

  get course_code() { return this.courseForm.get('course_code'); }
  get course_name() { return this.courseForm.get('course_name'); }
}
