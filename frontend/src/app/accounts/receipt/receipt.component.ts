import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { ToastService } from '../../services/toast.service';
import { TransactionService, Transaction } from '../../services/transaction.service';
import { UserService, User } from '../../services/user.service';
import { ReceiptTableComponent } from './receipt-table/receipt-table.component';

interface RecipientOption {
  id: number;
  regNo: string;
  name: string;
}

@Component({
  selector: 'app-receipt',
  templateUrl: './receipt.component.html',
  styleUrls: ['./receipt.component.css']
})
export class ReceiptComponent implements OnInit, OnDestroy {
  receiptForm!: FormGroup;
  isSubmitting = false;
  isCreateMode = false;
  isEditMode = false;
  receiptId: number | null = null;
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

  ngOnDestroy(): void {
    document.removeEventListener('click', this.handleDocumentClick.bind(this));
  }

  private handleDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (!target.closest('.searchable-dropdown')) this.showRecipientDropdown = false;
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
      this.receiptId = +(this.route.snapshot.paramMap.get('id') || 0);
      this.loadRecipients();
      this.initializeForm();
      if (this.receiptId) this.loadReceiptData(this.receiptId);
    } else {
      this.isCreateMode = false;
      this.isEditMode = false;
    }
  }

  private initializeForm(): void {
    this.receiptForm = this.fb.group({
      transaction_date: [new Date().toISOString().split('T')[0], [Validators.required]],
      reference_number: [{ value: '', disabled: true }, []],
      payment_mode: ['Cash', [Validators.required]],
      amount: ['', [Validators.required, Validators.min(0.01)]],
      transtype: ['Fee'],
      remarks: [''],
      user_id: [null, Validators.required]
    });
  }

  private loadRecipients(): void {
    this.userService.getUsers({ role: 'Student', is_active: true }).subscribe({
      next: (sr) => {
        this.userService.getUsers({ role: 'Staff', is_active: true }).subscribe({
          next: (st) => {
            const students = (sr.success ? sr.data || [] : []).filter((u: User) => u.id != null).map((u: User) => ({
              id: u.id!,
              regNo: u.registration_no || `STU${u.id}`,
              name: u.name || ''
            }));
            const staff = (st.success ? st.data || [] : []).filter((u: User) => u.id != null).map((u: User) => ({
              id: u.id!,
              regNo: u.registration_no || `STF${u.id}`,
              name: u.name || ''
            }));
            this.recipients = [...students, ...staff];
            this.filteredRecipients = [...this.recipients];
          }
        });
      }
    });
  }

  onRecipientSearch(): void {
    if (!this.recipientSearchQuery.trim()) {
      this.filteredRecipients = [...this.recipients];
      return;
    }
    const query = this.recipientSearchQuery.toLowerCase();
    this.filteredRecipients = this.recipients.filter(r =>
      r.regNo.toLowerCase().includes(query) || r.name.toLowerCase().includes(query)
    );
  }

  selectRecipient(r: RecipientOption): void {
    this.receiptForm.patchValue({ user_id: r.id });
    this.selectedRecipientName = `${r.regNo} - ${r.name}`;
    this.showRecipientDropdown = false;
    this.filteredRecipients = [...this.recipients];
    this.recipientSearchQuery = '';
  }

  clearRecipientSelection(): void {
    this.receiptForm.patchValue({ user_id: null });
    this.recipientSearchQuery = '';
    this.selectedRecipientName = '';
    this.filteredRecipients = [...this.recipients];
    this.showRecipientDropdown = false;
  }

  getSelectedRecipientName(): string {
    if (this.selectedRecipientName) return this.selectedRecipientName;
    const uid = this.receiptForm.get('user_id')?.value;
    if (!uid) return '';
    const r = this.recipients.find(x => x.id === uid);
    if (r) {
      this.selectedRecipientName = `${r.regNo} - ${r.name}`;
      return this.selectedRecipientName;
    }
    return '';
  }

  private generateReferenceNumber(): void {
    this.transactionService.getTransactions({ transtypes: 'Fee,Admission' }).subscribe({
      next: (response) => {
        const count = (response.success && response.data ? response.data.length : 0) + 1;
        const ref = 'P' + String(count).padStart(5, '0'); // P00001, P00002, ...
        this.receiptForm.patchValue({ reference_number: ref });
      },
      error: () => {
        this.receiptForm.patchValue({ reference_number: 'P00001' });
      }
    });
  }

  private loadReceiptData(id: number): void {
    this.transactionService.getTransactionById(id).subscribe({
      next: (response) => {
        if (response.success && response.data) {
          const p = response.data;
          this.receiptForm.patchValue({
            transaction_date: p.transaction_date ? p.transaction_date.toString().substring(0, 10) : '',
            reference_number: p.reference_number || '',
            payment_mode: p.payment_mode || 'Cash',
            amount: p.amount,
            transtype: p.transtype || 'Fee',
            remarks: p.remarks || '',
            user_id: p.user_id
          });
          const r = this.recipients.find(x => x.id === p.user_id);
          if (r) this.selectedRecipientName = `${r.regNo} - ${r.name}`;
        }
      },
      error: () => this.toastService.error('Failed to load payment')
    });
  }

  onSubmit(): void {
    if (this.receiptForm.invalid) {
      this.markFormGroupTouched(this.receiptForm);
      this.toastService.error('Please fill all required fields correctly');
      return;
    }
    const uid = this.receiptForm.get('user_id')?.value;
    if (!uid) {
      this.toastService.error('Please select a student or staff');
      return;
    }

    this.isSubmitting = true;
    const formValue = this.receiptForm.getRawValue();
    const data: Partial<Transaction> = {
      user_id: uid,
      transaction_date: formValue.transaction_date || new Date().toISOString().split('T')[0],
      payment_mode: formValue.payment_mode || 'Cash',
      amount: parseFloat(formValue.amount),
      transtype: formValue.transtype || 'Fee',
      reference_number: formValue.reference_number || 'P00001',
      remarks: formValue.remarks || undefined
    };

    if (this.isEditMode && this.receiptId) {
      this.transactionService.updateTransaction(this.receiptId, data).subscribe({
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

  get date() { return this.receiptForm.get('transaction_date'); }
  get amount() { return this.receiptForm.get('amount'); }
  get userId() { return this.receiptForm.get('user_id'); }
}
