import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { ToastService } from '../../services/toast.service';
import { BatchService, Batch } from '../../services/batch.service';
import { LoadingService } from '../../services/loading.service';

@Component({
  selector: 'app-batch-form',
  templateUrl: './batch-form.component.html',
  styleUrls: ['./batch-form.component.css']
})
export class BatchFormComponent implements OnInit {
  batchForm!: FormGroup;
  isSubmitting = false;
  isEditMode = false;
  batchId: number | null = null;

  constructor(
    private fb: FormBuilder,
    private router: Router,
    private route: ActivatedRoute,
    private toastService: ToastService,
    private batchService: BatchService,
    private loadingService: LoadingService
  ) {}

  ngOnInit(): void {
    const url = this.router.url;
    this.isEditMode = url.includes('/edit');
    if (this.isEditMode) {
      const id = this.route.snapshot.paramMap.get('id');
      this.batchId = id ? parseInt(id, 10) : null;
    }
    this.initializeForm();
    if (this.isEditMode && this.batchId) {
      this.loadExistingData();
    }
  }

  private initializeForm(): void {
    this.batchForm = this.fb.group({
      batch_code: ['', [Validators.required, Validators.minLength(2)]],
      batch_name: ['', [Validators.required, Validators.minLength(2)]]
    });
  }

  private loadExistingData(): void {
    if (!this.batchId) return;
    this.loadingService.show();
    this.batchService.getBatchById(this.batchId).subscribe({
      next: (response) => {
        if (response.success && response.data) {
          this.batchForm.patchValue({
            batch_code: response.data.batch_code,
            batch_name: response.data.batch_name
          });
        }
        this.loadingService.hide();
      },
      error: () => {
        this.toastService.error('Failed to load batch');
        this.loadingService.hide();
      }
    });
  }

  onSubmit(): void {
    if (this.batchForm.invalid) {
      this.markFormGroupTouched();
      this.toastService.error('Please fill all required fields correctly');
      return;
    }
    this.isSubmitting = true;
    const formValue = this.batchForm.getRawValue();

    if (this.isEditMode && this.batchId) {
      this.batchService.updateBatch(this.batchId, formValue).subscribe({
        next: (response) => {
          this.isSubmitting = false;
          if (response.success) {
            this.toastService.success('Batch updated successfully!');
            this.router.navigate(['/dashboard/staff/batch']);
          }
        },
        error: (err) => {
          this.isSubmitting = false;
          this.toastService.error(err?.error?.error || 'Failed to update batch');
        }
      });
    } else {
      this.batchService.createBatch(formValue).subscribe({
        next: (response) => {
          this.isSubmitting = false;
          if (response.success) {
            this.toastService.success('Batch created successfully!');
            this.router.navigate(['/dashboard/staff/batch']);
          }
        },
        error: (err) => {
          this.isSubmitting = false;
          this.toastService.error(err?.error?.error || 'Failed to create batch');
        }
      });
    }
  }

  onCancel(): void {
    this.router.navigate(['/dashboard/staff/batch']);
  }

  private markFormGroupTouched(): void {
    Object.keys(this.batchForm.controls).forEach(key => {
      this.batchForm.get(key)?.markAsTouched();
    });
  }

  get batch_code() { return this.batchForm.get('batch_code'); }
  get batch_name() { return this.batchForm.get('batch_name'); }
}
