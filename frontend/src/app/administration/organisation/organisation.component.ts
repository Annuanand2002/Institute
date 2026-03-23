import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { ToastService } from '../../services/toast.service';
import { OrganisationService, Organisation } from '../../services/organisation.service';
import { LoadingService } from '../../services/loading.service';

@Component({
  selector: 'app-organisation',
  templateUrl: './organisation.component.html',
  styleUrls: ['./organisation.component.css']
})
export class OrganisationComponent implements OnInit {
  organisationForm!: FormGroup;
  isSubmitting = false;
  isCreateMode = false;
  isEditMode = false;
  organisationId: number | null = null;

  logoPreview: string | ArrayBuffer | null = null;
  headerPreview: string | ArrayBuffer | null = null;
  footerPreview: string | ArrayBuffer | null = null;
  sealPreview: string | ArrayBuffer | null = null;

  latitude: number | null = null;
  longitude: number | null = null;
  locationError: string | null = null;
  isGettingLocation = false;

  constructor(
    private fb: FormBuilder,
    private router: Router,
    private route: ActivatedRoute,
    private toastService: ToastService,
    private organisationService: OrganisationService,
    private loadingService: LoadingService
  ) {}

  ngOnInit(): void {
    const url = this.router.url;
    this.isCreateMode = url.includes('/create');
    this.isEditMode = url.includes('/edit');

    if (this.isEditMode) {
      const id = this.route.snapshot.paramMap.get('id');
      this.organisationId = id ? parseInt(id, 10) : null;
    }

    this.initializeForm();
    if (this.isEditMode && this.organisationId) {
      this.loadExistingData();
    }
  }

  private initializeForm(): void {
    this.organisationForm = this.fb.group({
      org_code: [''],
      org_name: ['', [Validators.required, Validators.minLength(3)]],
      address: ['', [Validators.required]],
      phone_number: ['', [Validators.required, Validators.pattern(/^[0-9]{10}$/)]],
      email: ['', [Validators.required, Validators.email]],
      website: ['', [Validators.pattern(/^$|^(https?:\/\/)?([\da-z\.-]+)\.([a-z\.]{2,6})([\/\w \.-]*)*\/?$/)]],
      location: ['', [Validators.required]],
      description: [''],
      logo: [null],
      header: [null],
      footer: [null],
      seal: [null]
    });
  }

  private loadExistingData(): void {
    if (!this.organisationId) return;
    this.loadingService.show();
    this.organisationService.getById(this.organisationId).subscribe({
      next: (response) => {
        if (response.success) {
          const org = response.data;
          this.organisationForm.patchValue({
            org_code: org.org_code,
            org_name: org.org_name,
            address: org.address,
            phone_number: org.phone_number,
            email: org.email,
            website: org.website,
            location: org.address || '',
            description: org.description || ''
          });
          if (org.logo) this.logoPreview = org.logo;
          if (org.header) this.headerPreview = org.header;
          if (org.footer) this.footerPreview = org.footer;
          if (org.seal) this.sealPreview = org.seal;
        }
        this.loadingService.hide();
      },
      error: () => {
        this.toastService.error('Failed to load organisation');
        this.loadingService.hide();
      }
    });
  }

  onFileSelected(event: Event, type: 'logo' | 'header' | 'footer' | 'seal'): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      const file = input.files[0];
      if (!file.type.match(/image\/(jpeg|jpg|png|gif|webp)/)) {
        this.toastService.error('Please select a valid image file (JPG, PNG, GIF, or WEBP)');
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        this.toastService.error('File size must be less than 5MB');
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        switch (type) {
          case 'logo': this.logoPreview = result; this.organisationForm.patchValue({ logo: result }); break;
          case 'header': this.headerPreview = result; this.organisationForm.patchValue({ header: result }); break;
          case 'footer': this.footerPreview = result; this.organisationForm.patchValue({ footer: result }); break;
          case 'seal': this.sealPreview = result; this.organisationForm.patchValue({ seal: result }); break;
        }
      };
      reader.readAsDataURL(file);
    }
  }

  removeImage(type: 'logo' | 'header' | 'footer' | 'seal'): void {
    switch (type) {
      case 'logo': this.logoPreview = null; this.organisationForm.patchValue({ logo: null }); break;
      case 'header': this.headerPreview = null; this.organisationForm.patchValue({ header: null }); break;
      case 'footer': this.footerPreview = null; this.organisationForm.patchValue({ footer: null }); break;
      case 'seal': this.sealPreview = null; this.organisationForm.patchValue({ seal: null }); break;
    }
  }

  getCurrentLocation(): void {
    if (!navigator.geolocation) {
      this.toastService.error('Geolocation is not supported by your browser');
      return;
    }
    this.isGettingLocation = true;
    this.locationError = null;
    navigator.geolocation.getCurrentPosition(
      (position) => {
        this.latitude = position.coords.latitude;
        this.longitude = position.coords.longitude;
        this.isGettingLocation = false;
        this.toastService.success('Location captured successfully!');
      },
      (error) => {
        this.isGettingLocation = false;
        switch (error.code) {
          case error.PERMISSION_DENIED: this.locationError = 'Location access denied'; break;
          case error.POSITION_UNAVAILABLE: this.locationError = 'Location unavailable'; break;
          case error.TIMEOUT: this.locationError = 'Location request timed out'; break;
          default: this.locationError = 'Failed to get location';
        }
        this.toastService.error(this.locationError);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  }

  openInMaps(): void {
    if (this.latitude && this.longitude) {
      window.open(`https://www.google.com/maps?q=${this.latitude},${this.longitude}`, '_blank');
    }
  }

  onSubmit(): void {
    if (this.organisationForm.invalid) {
      this.markFormGroupTouched();
      this.toastService.error('Please fill all required fields correctly');
      return;
    }
    this.isSubmitting = true;
    const formValue = this.organisationForm.getRawValue();
    let description = formValue.description || '';
    if (formValue.location && formValue.location !== formValue.address) {
      description = (description ? description + '\n' : '') + `Location: ${formValue.location}`;
    }
    if (this.latitude && this.longitude) {
      description = (description ? description + '\n' : '') + `Coordinates: ${this.latitude}, ${this.longitude}`;
    }
    const orgData: Partial<Organisation> = {
      org_code: formValue.org_code || `ORG${Date.now()}`,
      org_name: formValue.org_name,
      address: formValue.address,
      phone_number: formValue.phone_number,
      email: formValue.email,
      website: formValue.website || '',
      description: description || undefined,
      logo: formValue.logo,
      header: formValue.header,
      footer: formValue.footer,
      seal: formValue.seal
    };

    if (this.isEditMode && this.organisationId) {
      this.organisationService.update(this.organisationId, orgData).subscribe({
        next: (response) => {
          this.isSubmitting = false;
          if (response.success) {
            this.toastService.success('Organisation updated successfully!');
            this.router.navigate(['/dashboard/administration/organisation']);
          }
        },
        error: (err) => {
          this.isSubmitting = false;
          const msg = err?.error?.error || err?.error?.message || err?.message || 'Failed to update organisation';
          this.toastService.error(msg);
        }
      });
    } else {
      this.organisationService.create(orgData).subscribe({
        next: (response) => {
          this.isSubmitting = false;
          if (response.success) {
            this.toastService.success('Organisation created successfully!');
            this.router.navigate(['/dashboard/administration/organisation']);
          }
        },
        error: (err) => {
          this.isSubmitting = false;
          const msg = err?.error?.error || err?.error?.message || err?.message || 'Failed to create organisation';
          this.toastService.error(msg);
        }
      });
    }
  }

  onCancel(): void {
    this.router.navigate(['/dashboard/administration/organisation']);
  }

  private markFormGroupTouched(): void {
    Object.keys(this.organisationForm.controls).forEach(key => {
      this.organisationForm.get(key)?.markAsTouched();
    });
  }

  get org_name() { return this.organisationForm.get('org_name'); }
  get address() { return this.organisationForm.get('address'); }
  get phone_number() { return this.organisationForm.get('phone_number'); }
  get email() { return this.organisationForm.get('email'); }
  get website() { return this.organisationForm.get('website'); }
  get location() { return this.organisationForm.get('location'); }
}
