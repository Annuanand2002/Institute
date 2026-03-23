import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ToastService } from '../services/toast.service';
import { LoadingService } from '../services/loading.service';
import { TransactionService, Transaction } from '../services/transaction.service';
import { UserService } from '../services/user.service';
import { TableColumn, TableAction } from '../components/shared-table/shared-table.component';

@Component({
  selector: 'app-transactions',
  templateUrl: './transactions.component.html',
  styleUrls: ['./transactions.component.css']
})
export class TransactionsComponent implements OnInit {
  transactions: any[] = [];
  students: any[] = [];

  columns: TableColumn[] = [
    { key: 'id', label: 'ID', sortable: true },
    { key: 'registration_no', label: 'Student ID', sortable: true },
    { key: 'user_name', label: 'Student', sortable: true },
    { key: 'course_name', label: 'Course', sortable: true },
    { key: 'amount', label: 'Amount', sortable: true },
    { key: 'transaction_date', label: 'Date', sortable: true },
    { key: 'payment_mode', label: 'Payment Method', sortable: true },
    { key: 'transtype', label: 'Type', sortable: true }
  ];

  actions: TableAction[] = [];
  showModal: boolean = false;
  isEditMode: boolean = false;
  selectedTransaction: any = null;
  transactionForm!: FormGroup;

  constructor(
    private fb: FormBuilder,
    private toastService: ToastService,
    private loadingService: LoadingService,
    private transactionService: TransactionService,
    private userService: UserService
  ) {}

  ngOnInit(): void {
    this.initForm();
    this.loadTransactions();
    this.loadStudents();
  }

  loadTransactions(): void {
    this.loadingService.show();
    this.transactionService.getTransactions().subscribe({
      next: (response) => {
        if (response.success) {
          this.transactions = response.data;
        }
        this.loadingService.hide();
      },
      error: (error) => {
        console.error('Error loading transactions:', error);
        this.toastService.error('Failed to load transactions');
        this.loadingService.hide();
      }
    });
  }

  loadStudents(): void {
    this.userService.getUsers({ role: 'Student', is_active: true }).subscribe({
      next: (response) => {
        if (response.success) {
          this.students = response.data;
        }
      },
      error: (error) => {
        console.error('Error loading students:', error);
      }
    });
  }

  initForm(): void {
    this.transactionForm = this.fb.group({
      user_id: ['', Validators.required],
      transaction_date: ['', Validators.required],
      payment_mode: ['', Validators.required],
      amount: ['', Validators.required],
      transtype: [''],
      reference_number: [''],
      remarks: ['']
    });
  }

  onCreate(): void {
    this.isEditMode = false;
    this.selectedTransaction = null;
    this.transactionForm.reset({ status: 'Pending' });
    this.showModal = true;
  }

  onEdit(transaction: any): void {
    this.isEditMode = true;
    this.selectedTransaction = transaction;
    this.transactionForm.patchValue(transaction);
    this.showModal = true;
  }

  onDelete(transaction: any): void {
    if (confirm(`Are you sure you want to delete this transaction?`)) {
      this.transactionService.deleteTransaction(transaction.id).subscribe({
        next: (response) => {
          if (response.success) {
            this.toastService.success('Transaction deleted successfully');
            this.loadTransactions();
          }
        },
        error: (error) => {
          console.error('Error deleting transaction:', error);
          this.toastService.error('Failed to delete transaction');
        }
      });
    }
  }

  onAction(event: { action: string; item: any }): void {}

  saveTransaction(): void {
    if (this.transactionForm.valid) {
      const formValue = this.transactionForm.value;
      const transactionData: Transaction = {
        ...formValue,
        amount: parseFloat(formValue.amount),
        transaction_date: formValue.transaction_date || new Date().toISOString().split('T')[0]
      };

      if (this.isEditMode) {
        this.transactionService.updateTransaction(this.selectedTransaction.id, {
          ...transactionData,
          modified_by: 1 // TODO: Get from auth service
        }).subscribe({
          next: (response) => {
            if (response.success) {
              this.toastService.success('Transaction updated successfully');
              this.loadTransactions();
              this.closeModal();
            }
          },
          error: (error) => {
            console.error('Error updating transaction:', error);
            this.toastService.error('Failed to update transaction');
          }
        });
      } else {
        this.transactionService.createTransaction({
          ...transactionData,
          created_by: 1 // TODO: Get from auth service
        }).subscribe({
          next: (response) => {
            if (response.success) {
              this.toastService.success('Transaction created successfully');
              this.loadTransactions();
              this.closeModal();
            }
          },
          error: (error) => {
            console.error('Error creating transaction:', error);
            this.toastService.error('Failed to create transaction');
          }
        });
      }
    } else {
      this.toastService.error('Please fill all required fields');
    }
  }

  closeModal(): void {
    this.showModal = false;
    this.transactionForm.reset({ status: 'Pending' });
  }
}
