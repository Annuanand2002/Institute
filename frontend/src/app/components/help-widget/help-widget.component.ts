import { Component } from '@angular/core';

export interface ModuleInfo {
  id: string;
  name: string;
  summary: string;
}

@Component({
  selector: 'app-help-widget',
  templateUrl: './help-widget.component.html',
  styleUrls: ['./help-widget.component.css']
})
export class HelpWidgetComponent {
  isOpen = false;
  step: 'intro' | 'modules' | 'summary' = 'intro';
  selectedModule: ModuleInfo | null = null;

  modules: ModuleInfo[] = [
    {
      id: 'dashboard',
      name: 'Dashboard',
      summary: `The Dashboard is your command centre—a single screen that gives you an at-a-glance overview of your entire institution.

At the top, stat cards display live counts: Total Students, Total Staff, Active Courses, Batches, Total Payments (incoming), Total Receipts (outgoing), and Net Balance (payments minus receipts).

The Period filter lets you narrow the view by time: This Week, This Month, Last 3 Months, Last 6 Months, This Year, or All Time. All stats and charts update based on your selection.

Analytics & Reports includes interactive charts: Students by Course (pie), Payments vs Receipts by month (bar), Revenue Overview (doughnut), and Student & Staff Count (line). Click any chart to open a larger view.

Recent Transactions shows the latest payments and receipts with date, reference, type, amount, and student or recipient. Use "View All Transactions" to jump to the full list.

The Refresh button reloads all dashboard data from the server—useful after adding new students, staff, or transactions.`
    },
    {
      id: 'students',
      name: 'Students',
      summary: `The Students module is your complete student management system.

Add new students with the "Add New" button. The form captures comprehensive details: personal info (name, date of birth, gender, religion, caste), contact details (phone, email), addresses (permanent and local), guardian information (name, relationship, occupation), course enrollment, fee details, class time, and remarks. You can also upload a profile photo that appears in the record and edit view.

Use the search box to find students by name, email, phone, registration number, or course. Sort any column by clicking the header. Pagination helps you browse large lists.

Edit or delete students from the action buttons. Deletion is soft delete—records remain in the database but are hidden from normal views.

Export student data to CSV, PDF, or Excel for reporting, backups, or use in other tools.`
    },
    {
      id: 'staff',
      name: 'Staff',
      summary: `The Staff module manages your teaching and administrative team.

Add staff members with full details: name, role, course assignment, contact numbers (personal and home), email, address, date of birth, gender, and remarks. Upload a profile image that displays consistently across the app.

Search and sort staff by any field. Edit or delete records as needed—deletions are soft deletes.

Assign staff to courses so you can see who teaches what and maintain clear organisational structure. The staff list shows course names and codes for quick reference.

Export staff data to CSV, PDF, or Excel for payroll, HR records, or institutional reports.`
    },
    {
      id: 'courses',
      name: 'Courses',
      summary: `The Courses module defines the academic programmes your institution offers.

Create a course by entering a course code (unique identifier), course name, description, duration (e.g., "6 months", "1 year"), and total fee. Link each course to a batch to organise intake periods.

Toggle "Active" to enable or disable a course without deleting it—useful when a programme is paused or phased out.

Edit or delete courses from the table. Deletion is soft delete.

Courses are referenced when adding students (enrollment) and staff (assignment), and in payment and receipt transactions. Keeping course data accurate ensures clean reports across the app.`
    },
    {
      id: 'batches',
      name: 'Batches',
      summary: `Batches group students and courses by intake or academic period.

Create batches with a batch code and batch name. For example: "B2024-1" and "January 2024 Intake" or "Y1-A" and "Year 1 Section A".

Batches help you organise students who started together, manage fee structures by intake, and run reports by cohort. They are linked to courses when you create or edit course records.

Edit or delete batches as needed. Deletion is soft delete.

A well-structured batch system makes it easier to track student progress, plan resources, and analyse performance over time.`
    },
    {
      id: 'payments',
      name: 'Payments',
      summary: `The Payments module records all incoming money—fees and admissions.

For each payment, you capture: transaction date, student (from your student list), amount, payment mode (e.g., Cash, Card, UPI, Bank Transfer), transaction type (Fee or Admission), reference number, and optional remarks.

Search and filter payments by date, reference, student, payment mode, or amount. Sort and paginate the list for easy browsing.

Edit or delete payments if corrections are needed. Deletion is soft delete.

Export the payment list to CSV, PDF, or Excel for accounting, auditing, fee reconciliation, or sharing with stakeholders. Payment data also feeds into the Dashboard and Profit & Loss reports.`
    },
    {
      id: 'receipts',
      name: 'Receipts',
      summary: `The Receipts module records all outgoing money—expenses, salary payments, and refunds.

For each receipt, you enter: transaction date, recipient (student or staff), amount, payment mode, transaction type (Expense, Salary, or Refund), reference number, and remarks.

Use receipts to track salary disbursements to staff, refunds to students, and general expenses. This data is essential for Profit & Loss calculations.

Search, sort, and paginate receipts. Edit or delete as needed—deletion is soft delete.

Export receipts to CSV, PDF, or Excel for expense tracking, payroll verification, and financial reporting. Receipt data also appears in the Dashboard and Profit & Loss module.`
    },
    {
      id: 'profit-loss',
      name: 'Profit & Loss',
      summary: `The Profit & Loss module gives you a clear financial snapshot: how much came in versus how much went out as salary.

Summary cards show: Amount (Payments In)—total of all Fee and Admission payments; Salary (Out)—total of all Salary receipts; and Profit or Loss—Amount minus Salary. Profit is shown in green, loss in red.

Use the Period filter (This Week, This Month, Last 3 Months, etc.) to analyse different time ranges.

A detailed table lists every payment and receipt with date, reference, type (Payment/Receipt), transaction type, student or recipient, and amount. Payments are shown with a plus sign, receipts with a minus sign.

Click the Analytics button to open charts: Amount vs Salary by Month (bar), Amount vs Salary split (doughnut), and Profit/Loss trend by month (line).

Export the report to PDF or Excel for financial reviews, board meetings, or audits.`
    },
    {
      id: 'organisation',
      name: 'Organisation',
      summary: `The Organisation module configures your institution's branding and contact details.

Enter or edit: organisation name, code, description, phone number, email, address, and website. Upload your logo, header image, footer image, and seal. These appear on documents, reports, and printed materials to maintain a professional, branded look.

Create multiple organisation records if you manage more than one institution (e.g., different branches or departments).

Edit or delete organisations as needed. Deletion is soft delete.

Keeping organisation details up to date ensures that all generated documents—invoices, receipts, reports—display the correct branding and contact information.`
    },
    {
      id: 'user-management',
      name: 'User Management',
      summary: `The User Management module controls who can access the system and with what permissions.

Create user accounts by setting a username and password. Assign a role (e.g., Admin, Staff) to define what the user can see and do. Admins typically have full access; other roles may have restricted access.

User profiles are used for login. Each user must have a unique username.

Edit user details or deactivate accounts when staff leave. Deletion is soft delete—you can restore access if needed.

This module is critical for security: only create accounts for authorised personnel and use strong passwords. Regularly review user list to remove or deactivate outdated accounts.`
    },
    {
      id: 'settings',
      name: 'Settings',
      summary: `The Settings module lets you manage your personal profile and preferences.

Update your profile photo by uploading an image. It appears in the app and can be used for identification.

Change your password to keep your account secure. You'll need to enter your current password and confirm the new one.

Toggle between Light and Dark theme. Light mode uses a white/light grey background; Dark mode uses a dark grey background that is easier on the eyes in low-light environments. Your choice is saved and persists across sessions.

All changes are saved immediately. Use Settings whenever you need to update your identity or how the app looks and feels for you.`
    }
  ];

  toggle(): void {
    this.isOpen = !this.isOpen;
    if (!this.isOpen) {
      this.reset();
    }
  }

  close(): void {
    this.isOpen = false;
    this.reset();
  }

  reset(): void {
    this.step = 'intro';
    this.selectedModule = null;
  }

  onYes(): void {
    this.step = 'modules';
  }

  onNo(): void {
    this.step = 'intro';
    this.close();
  }

  selectModule(module: ModuleInfo): void {
    this.selectedModule = module;
    this.step = 'summary';
  }

  backToModules(): void {
    this.selectedModule = null;
    this.step = 'modules';
  }

  backToIntro(): void {
    this.step = 'intro';
    this.selectedModule = null;
  }
}
