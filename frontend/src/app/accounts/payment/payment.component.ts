import { Component, OnInit, OnDestroy, HostListener } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { ToastService } from '../../services/toast.service';
import { TransactionService, Transaction } from '../../services/transaction.service';
import { UserService, User } from '../../services/user.service';
import { PaymentTableComponent } from './payment-table/payment-table.component';

interface StudentOption {
  id: number;
  regNo: string;
  name: string;
  role?: string; // 'Student' | 'Staff' for display
}

@Component({
  selector: 'app-payment',
  templateUrl: './payment.component.html',
  styleUrls: ['./payment.component.css']
})
export class PaymentComponent implements OnInit, OnDestroy {
  paymentForm!: FormGroup;
  isSubmitting = false;
  isCreateMode = false;
  isEditMode = false;
  paymentId: number | null = null;
  students: StudentOption[] = [];
  filteredStudents: StudentOption[] = [];
  studentSearchQuery = '';
  selectedStudentName = '';
  showStudentDropdown = false;

  constructor(
    private fb: FormBuilder,
    private toastService: ToastService,
    private router: Router,
    private route: ActivatedRoute,
    private transactionService: TransactionService,
    private userService: UserService
  ) {}

  ngOnInit(): void {
    document.addEventListener('click', this.handleDocumentClick.bind(this));
    this.route.url.subscribe(() => this.updateModeFromRoute());
    this.updateModeFromRoute();
  }

  private updateModeFromRoute(): void {
    const url = this.router.url;
    if (url.includes('/create')) {
      this.isCreateMode = true;
      this.isEditMode = false;
      this.loadStudents();
      this.initializeForm();
      this.generateReferenceNumber();
    } else if (url.includes('/edit/')) {
      this.isCreateMode = false;
      this.isEditMode = true;
      this.paymentId = +(this.route.snapshot.paramMap.get('id') || 0);
      this.loadStudents();
      this.initializeForm();
      if (this.paymentId) this.loadPaymentData(this.paymentId);
    } else {
      this.isCreateMode = false;
      this.isEditMode = false;
    }
  }

  ngOnDestroy(): void {
    document.removeEventListener('click', this.handleDocumentClick.bind(this));
  }

  private handleDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (!target.closest('.searchable-dropdown')) {
      this.showStudentDropdown = false;
    }
  }

  private initializeForm(): void {
    this.paymentForm = this.fb.group({
      transaction_date: [new Date().toISOString().split('T')[0], [Validators.required]],
      reference_number: [{ value: '', disabled: true }, []],
      payment_mode: ['Cash', [Validators.required]],
      amount: ['', [Validators.required, Validators.min(0.01)]],
      transtype: ['Fee'],
      remarks: [''],
      user_id: [null, Validators.required]
    });
  }

  private loadStudents(): void {
    const students: StudentOption[] = [];
    const staff: StudentOption[] = [];
    let done = 0;
    const checkDone = () => {
      done++;
      if (done >= 2) {
        this.students = [...students, ...staff].sort((a, b) => a.name.localeCompare(b.name));
        this.filteredStudents = [...this.students];
      }
    };

    this.userService.getUsers({ role: 'Student', is_active: true }).subscribe({
      next: (response) => {
        if (response.success && response.data) {
          response.data
            .filter((u: User) => u.id != null)
            .forEach((u: User) => students.push({
              id: u.id!,
              regNo: u.registration_no || `STU${u.id}`,
              name: u.name || '',
              role: 'Student'
            }));
        }
        checkDone();
      },
      error: () => checkDone()
    });

    this.userService.getUsers({ role: 'Staff', is_active: true }).subscribe({
      next: (response) => {
        if (response.success && response.data) {
          response.data
            .filter((u: User) => u.id != null)
            .forEach((u: User) => staff.push({
              id: u.id!,
              regNo: u.registration_no || `STF${u.id}`,
              name: u.name || '',
              role: 'Staff'
            }));
        }
        checkDone();
      },
      error: () => checkDone()
    });
  }

  onStudentSearch(): void {
    if (!this.studentSearchQuery.trim()) {
      this.filteredStudents = [...this.students];
      return;
    }
    const query = this.studentSearchQuery.toLowerCase();
    this.filteredStudents = this.students.filter(s =>
      s.regNo.toLowerCase().includes(query) || s.name.toLowerCase().includes(query)
    );
  }

  selectStudent(student: StudentOption): void {
    this.paymentForm.patchValue({ user_id: student.id });
    const roleLabel = student.role ? ` (${student.role})` : '';
    this.selectedStudentName = `${student.regNo} - ${student.name}${roleLabel}`;
    this.showStudentDropdown = false;
    this.filteredStudents = [...this.students];
    this.studentSearchQuery = '';
  }

  clearStudentSelection(): void {
    this.paymentForm.patchValue({ user_id: null });
    this.studentSearchQuery = '';
    this.selectedStudentName = '';
    this.filteredStudents = [...this.students];
    this.showStudentDropdown = false;
  }

  getSelectedStudentName(): string {
    if (this.selectedStudentName) return this.selectedStudentName;
    const uid = this.paymentForm.get('user_id')?.value;
    if (!uid) return '';
    const s = this.students.find(x => x.id === uid);
    if (s) {
      const roleLabel = s.role ? ` (${s.role})` : '';
      this.selectedStudentName = `${s.regNo} - ${s.name}${roleLabel}`;
      return this.selectedStudentName;
    }
    return '';
  }

  private generateReferenceNumber(): void {
    this.transactionService.getTransactions({ transtypes: 'Fee,Admission' }).subscribe({
      next: (response) => {
        const count = (response.success && response.data ? response.data.length : 0) + 1;
        const ref = 'P' + String(count).padStart(5, '0'); // P00001, P00002, ...
        this.paymentForm.patchValue({ reference_number: ref });
      },
      error: () => {
        this.paymentForm.patchValue({ reference_number: 'P00001' });
      }
    });
  }

  private loadPaymentData(id: number): void {
    this.transactionService.getTransactionById(id).subscribe({
      next: (response) => {
        if (response.success && response.data) {
          const p = response.data;
          this.paymentForm.patchValue({
            transaction_date: p.transaction_date ? p.transaction_date.toString().substring(0, 10) : '',
            reference_number: p.reference_number || '',
            payment_mode: p.payment_mode || 'Cash',
            amount: p.amount,
            transtype: p.transtype || 'Fee',
            remarks: p.remarks || '',
            user_id: p.user_id
          });
          const s = this.students.find(x => x.id === p.user_id);
          if (s) {
            const roleLabel = s.role ? ` (${s.role})` : '';
            this.selectedStudentName = `${s.regNo} - ${s.name}${roleLabel}`;
          }
        }
      },
      error: () => this.toastService.error('Failed to load payment')
    });
  }

  onSubmit(): void {
    if (this.paymentForm.invalid) {
      this.markFormGroupTouched(this.paymentForm);
      this.toastService.error('Please fill all required fields correctly');
      return;
    }
    const uid = this.paymentForm.get('user_id')?.value;
    if (!uid) {
      this.toastService.error('Please select a student or staff');
      return;
    }

    this.isSubmitting = true;
    const formValue = this.paymentForm.getRawValue();
    const data: Partial<Transaction> = {
      user_id: uid,
      transaction_date: formValue.transaction_date || new Date().toISOString().split('T')[0],
      payment_mode: formValue.payment_mode || 'Cash',
      amount: parseFloat(formValue.amount),
      transtype: formValue.transtype || 'Fee',
      reference_number: formValue.reference_number || `REF${Date.now()}`,
      remarks: formValue.remarks || undefined
    };

    if (this.isEditMode && this.paymentId) {
      this.transactionService.updateTransaction(this.paymentId, data).subscribe({
        next: (response) => {
          this.isSubmitting = false;
          if (response.success) {
            this.toastService.success('Payment updated successfully!');
            this.router.navigate(['/dashboard/accounts/payment']);
          }
        },
        error: (err) => {
          this.isSubmitting = false;
          this.toastService.error(err?.error?.error || 'Failed to update payment');
        }
      });
    } else {
      this.transactionService.createTransaction(data).subscribe({
        next: (response) => {
          this.isSubmitting = false;
          if (response.success) {
            this.toastService.success('Payment recorded successfully!');
            this.router.navigate(['/dashboard/accounts/payment']);
          }
        },
        error: (err) => {
          this.isSubmitting = false;
          this.toastService.error(err?.error?.error || 'Failed to create payment');
        }
      });
    }
  }

  onCancel(): void {
    this.router.navigate(['/dashboard/accounts/payment']);
  }

  private markFormGroupTouched(formGroup: FormGroup): void {
    Object.values(formGroup.controls).forEach(control => {
      control.markAsTouched();
      if (control instanceof FormGroup) this.markFormGroupTouched(control);
    });
  }

  get date() { return this.paymentForm.get('transaction_date'); }
  get amount() { return this.paymentForm.get('amount'); }
  get userId() { return this.paymentForm.get('user_id'); }
}
