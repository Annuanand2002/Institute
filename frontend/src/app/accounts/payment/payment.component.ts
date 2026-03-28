import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { ToastService } from '../../services/toast.service';
import { TransactionService, Transaction } from '../../services/transaction.service';
import { UserService, User } from '../../services/user.service';

interface RecipientOption {
  id: number;
  regNo: string;
  name: string;
  roleLabel: 'Student' | 'Staff';
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
  recipients: RecipientOption[] = [];
  filteredRecipients: RecipientOption[] = [];
  recipientSearchQuery = '';
  selectedRecipientName = '';
  showRecipientDropdown = false;

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
      this.loadRecipients();
      this.initializeForm();
      this.generateReferenceNumber();
    } else if (url.includes('/edit/')) {
      this.isCreateMode = false;
      this.isEditMode = true;
      this.paymentId = +(this.route.snapshot.paramMap.get('id') || 0);
      this.loadRecipients();
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
      this.showRecipientDropdown = false;
    }
  }

  private initializeForm(): void {
    this.paymentForm = this.fb.group({
      transaction_date: [new Date().toISOString().split('T')[0], [Validators.required]],
      reference_number: [{ value: '', disabled: true }, []],
      payment_mode: ['Cash', [Validators.required]],
      amount: ['', [Validators.required, Validators.min(0.01)]],
      transtype: ['Expense'],
      remarks: [''],
      user_id: [null, Validators.required]
    });
  }

  private loadRecipients(): void {
    const students: RecipientOption[] = [];
    const staff: RecipientOption[] = [];
    let done = 0;
    const checkDone = () => {
      done++;
      if (done >= 2) {
        this.recipients = [...students, ...staff].sort((a, b) => a.name.localeCompare(b.name));
        this.filteredRecipients = [...this.recipients];
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
              roleLabel: 'Student'
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
              roleLabel: 'Staff'
            }));
        }
        checkDone();
      },
      error: () => checkDone()
    });
  }

  onRecipientSearch(): void {
    if (!this.recipientSearchQuery.trim()) {
      this.filteredRecipients = [...this.recipients];
      return;
    }
    const query = this.recipientSearchQuery.toLowerCase();
    this.filteredRecipients = this.recipients.filter(r =>
      r.regNo.toLowerCase().includes(query) ||
      r.name.toLowerCase().includes(query) ||
      r.roleLabel.toLowerCase().includes(query)
    );
  }

  selectRecipient(r: RecipientOption): void {
    this.paymentForm.patchValue({ user_id: r.id });
    this.selectedRecipientName = this.formatRecipientLabel(r);
    this.showRecipientDropdown = false;
    this.filteredRecipients = [...this.recipients];
    this.recipientSearchQuery = '';
  }

  clearRecipientSelection(): void {
    this.paymentForm.patchValue({ user_id: null });
    this.recipientSearchQuery = '';
    this.selectedRecipientName = '';
    this.filteredRecipients = [...this.recipients];
    this.showRecipientDropdown = false;
  }

  getSelectedRecipientName(): string {
    if (this.selectedRecipientName) return this.selectedRecipientName;
    const uid = this.paymentForm.get('user_id')?.value;
    if (!uid) return '';
    const r = this.recipients.find(x => x.id === uid);
    if (r) {
      this.selectedRecipientName = this.formatRecipientLabel(r);
      return this.selectedRecipientName;
    }
    return '';
  }

  private formatRecipientLabel(r: RecipientOption): string {
    return `${r.regNo} - ${r.name} (${r.roleLabel})`;
  }

  private generateReferenceNumber(): void {
    this.transactionService.getTransactions({ transtypes: 'Expense,Salary,Refund' }).subscribe({
      next: (response) => {
        const count = (response.success && response.data ? response.data.length : 0) + 1;
        const ref = 'R' + String(count).padStart(5, '0'); // R00001, R00002, ...
        this.paymentForm.patchValue({ reference_number: ref });
      },
      error: () => {
        this.paymentForm.patchValue({ reference_number: 'R00001' });
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
            transtype: p.transtype || 'Expense',
            remarks: p.remarks || '',
            user_id: p.user_id
          });
          const r = this.recipients.find(x => x.id === p.user_id);
          if (r) this.selectedRecipientName = this.formatRecipientLabel(r);
        }
      },
      error: () => this.toastService.error('Failed to load receipt')
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
      this.toastService.error('Please select a recipient');
      return;
    }

    this.isSubmitting = true;
    const formValue = this.paymentForm.getRawValue();
    const data: Partial<Transaction> = {
      user_id: uid,
      transaction_date: formValue.transaction_date || new Date().toISOString().split('T')[0],
      payment_mode: formValue.payment_mode || 'Cash',
      amount: parseFloat(formValue.amount),
      transtype: formValue.transtype || 'Expense',
      reference_number: formValue.reference_number || `REF${Date.now()}`,
      remarks: formValue.remarks || undefined
    };

    if (this.isEditMode && this.paymentId) {
      this.transactionService.updateTransaction(this.paymentId, data).subscribe({
        next: (response) => {
          this.isSubmitting = false;
          if (response.success) {
            this.toastService.success('Receipt updated successfully!');
            this.router.navigate(['/dashboard/accounts/receipt']);
          }
        },
        error: (err) => {
          this.isSubmitting = false;
          this.toastService.error(err?.error?.error || 'Failed to update receipt');
        }
      });
    } else {
      this.transactionService.createTransaction(data).subscribe({
        next: (response) => {
          this.isSubmitting = false;
          if (response.success) {
            this.toastService.success('Receipt recorded successfully!');
            this.router.navigate(['/dashboard/accounts/receipt']);
          }
        },
        error: (err) => {
          this.isSubmitting = false;
          this.toastService.error(err?.error?.error || 'Failed to create receipt');
        }
      });
    }
  }

  onCancel(): void {
    this.router.navigate(['/dashboard/accounts/receipt']);
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
