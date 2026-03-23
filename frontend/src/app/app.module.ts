import { NgModule } from '@angular/core';
import { environment } from '../environments/environment';
import { BrowserModule } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { ServiceWorkerModule } from '@angular/service-worker';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { HttpClientModule, HTTP_INTERCEPTORS } from '@angular/common/http';
import { NgChartsModule } from 'ng2-charts';
import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { LoginComponent } from './login/login.component';
import { ToastComponent } from './components/toast/toast.component';
import { DashboardComponent } from './dashboard/dashboard.component';
import { StudentTableComponent } from './student/student-table/student-table.component';
import { StudentReportComponent } from './student/student-report/student-report.component';
import { StudentFormComponent } from './student/student-form/student-form.component';
import { StaffTableComponent } from './staff/staff-table/staff-table.component';
import { StaffFormComponent } from './staff/staff-form/staff-form.component';
import { CourseTableComponent } from './staff/course-table/course-table.component';
import { CourseFormComponent } from './staff/course-form/course-form.component';
import { TransactionsComponent } from './transactions/transactions.component';
import { SharedTableComponent } from './components/shared-table/shared-table.component';
import { SidebarComponent } from './components/sidebar/sidebar.component';
import { MainLayoutComponent } from './layout/main-layout.component';
import { LoaderComponent } from './components/loader/loader.component';
import { SkeletonComponent } from './components/skeleton/skeleton.component';
import { OrganisationComponent } from './administration/organisation/organisation.component';
import { OrganisationTableComponent } from './administration/organisation-table/organisation-table.component';
import { UserManagementComponent } from './administration/user-management/user-management.component';
import { UserManagementTableComponent } from './administration/user-management-table/user-management-table.component';
import { BatchTableComponent } from './staff/batch-table/batch-table.component';
import { BatchFormComponent } from './staff/batch-form/batch-form.component';
import { PaymentComponent } from './accounts/payment/payment.component';
import { PaymentTableComponent } from './accounts/payment/payment-table/payment-table.component';
import { ReceiptComponent } from './accounts/receipt/receipt.component';
import { ReceiptTableComponent } from './accounts/receipt/receipt-table/receipt-table.component';
import { ProfitLossComponent } from './accounts/profit-loss/profit-loss.component';
import { SettingsComponent } from './settings/settings.component';
import { HelpWidgetComponent } from './components/help-widget/help-widget.component';
import { ErrorPageComponent } from './error-page/error-page.component';
import { NetworkErrorInterceptor } from './interceptors/network-error.interceptor';

@NgModule({
  declarations: [
    AppComponent,
    LoginComponent,
    ToastComponent,
    DashboardComponent,
    StudentTableComponent,
    StudentReportComponent,
    StudentFormComponent,
    StaffTableComponent,
    StaffFormComponent,
    CourseTableComponent,
    CourseFormComponent,
    TransactionsComponent,
    SharedTableComponent,
    SidebarComponent,
    MainLayoutComponent,
    LoaderComponent,
    SkeletonComponent,
    OrganisationComponent,
    OrganisationTableComponent,
    UserManagementComponent,
    UserManagementTableComponent,
    BatchTableComponent,
    BatchFormComponent,
    PaymentComponent,
    PaymentTableComponent,
    ReceiptComponent,
    ReceiptTableComponent,
    ProfitLossComponent,
    SettingsComponent,
    HelpWidgetComponent,
    ErrorPageComponent
  ],
  imports: [
    BrowserModule,
    BrowserAnimationsModule,
    FormsModule,
    ReactiveFormsModule,
    HttpClientModule,
    NgChartsModule,
    AppRoutingModule,
    ServiceWorkerModule.register('ngsw-worker.js', { enabled: environment.production, registrationStrategy: 'registerWhenStable:30000' })
  ],
  providers: [
    { provide: HTTP_INTERCEPTORS, useClass: NetworkErrorInterceptor, multi: true }
  ],
  bootstrap: [AppComponent]
})
export class AppModule { }
