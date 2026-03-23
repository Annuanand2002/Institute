import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { LoginComponent } from './login/login.component';
import { MainLayoutComponent } from './layout/main-layout.component';
import { DashboardComponent } from './dashboard/dashboard.component';
import { StudentTableComponent } from './student/student-table/student-table.component';
import { StudentReportComponent } from './student/student-report/student-report.component';
import { StudentFormComponent } from './student/student-form/student-form.component';
import { StaffTableComponent } from './staff/staff-table/staff-table.component';
import { StaffFormComponent } from './staff/staff-form/staff-form.component';
import { CourseTableComponent } from './staff/course-table/course-table.component';
import { CourseFormComponent } from './staff/course-form/course-form.component';
import { TransactionsComponent } from './transactions/transactions.component';
import { OrganisationComponent } from './administration/organisation/organisation.component';
import { OrganisationTableComponent } from './administration/organisation-table/organisation-table.component';
import { UserManagementComponent } from './administration/user-management/user-management.component';
import { UserManagementTableComponent } from './administration/user-management-table/user-management-table.component';
import { BatchTableComponent } from './staff/batch-table/batch-table.component';
import { BatchFormComponent } from './staff/batch-form/batch-form.component';
import { PaymentComponent } from './accounts/payment/payment.component';
import { ReceiptComponent } from './accounts/receipt/receipt.component';
import { ProfitLossComponent } from './accounts/profit-loss/profit-loss.component';
import { SettingsComponent } from './settings/settings.component';
import { AuthGuard } from './guards/auth.guard';
import { RoleGuard } from './guards/role.guard';
import { ErrorPageComponent } from './error-page/error-page.component';

const routes: Routes = [
  { path: '', redirectTo: '/login', pathMatch: 'full' },
  { path: 'login', component: LoginComponent },
  { path: 'error', component: ErrorPageComponent },
  {
    path: 'dashboard',
    component: MainLayoutComponent,
    canActivate: [AuthGuard, RoleGuard],
    children: [
      { path: '', component: DashboardComponent },
      { path: 'administration/organisation', component: OrganisationTableComponent },
      { path: 'administration/organisation/create', component: OrganisationComponent },
      { path: 'administration/organisation/edit/:id', component: OrganisationComponent },
      { path: 'administration/user-management', component: UserManagementTableComponent },
      { path: 'administration/user-management/create', component: UserManagementComponent },
      { path: 'administration/user-management/edit/:id', component: UserManagementComponent },
      { path: 'staff/batch', component: BatchTableComponent },
      { path: 'staff/batch/create', component: BatchFormComponent },
      { path: 'staff/batch/edit/:id', component: BatchFormComponent },
      { path: 'staff/course', component: CourseTableComponent },
      { path: 'staff/course/create', component: CourseFormComponent },
      { path: 'staff/course/edit/:id', component: CourseFormComponent },
      { path: 'staff/staff', component: StaffTableComponent },
      { path: 'staff/staff/create', component: StaffFormComponent },
      { path: 'staff/staff/edit/:id', component: StaffFormComponent },
      { path: 'student/student', component: StudentTableComponent },
      { path: 'student/student/create', component: StudentFormComponent },
      { path: 'student/student/edit/:id', component: StudentFormComponent },
      { path: 'student/report', component: StudentReportComponent },
      { path: 'accounts/payment', component: PaymentComponent },
      { path: 'accounts/payment/create', component: PaymentComponent },
      { path: 'accounts/payment/edit/:id', component: PaymentComponent },
      { path: 'accounts/receipt', component: ReceiptComponent },
      { path: 'accounts/receipt/create', component: ReceiptComponent },
      { path: 'accounts/receipt/edit/:id', component: ReceiptComponent },
      { path: 'accounts/profit-loss', component: ProfitLossComponent },
      { path: 'settings', component: SettingsComponent },
      // Legacy routes for backward compatibility
      { path: 'students', redirectTo: 'student/student', pathMatch: 'full' },
      { path: 'student', redirectTo: 'student/student', pathMatch: 'full' },
      { path: 'tutors', redirectTo: 'staff/staff', pathMatch: 'full' },
      { path: 'courses', redirectTo: 'staff/course', pathMatch: 'full' },
      { path: 'transactions', redirectTo: 'accounts/payment', pathMatch: 'full' }
    ]
  },
  { path: '404', component: ErrorPageComponent, data: { reason: '404' } },
  { path: '**', component: ErrorPageComponent, data: { reason: '404' } }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
