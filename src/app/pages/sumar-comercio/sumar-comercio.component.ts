import {
  Component,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  NgZone,
  OnInit,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { FirestoreService } from '../../services/firestore.service';
import { FunctionsService } from '../../services/functions.service';
import { ICategory } from '../../interfaces/benefit.interface';
import {
  BenefitRequestSucursal,
  BenefitRequestSubBenefit,
  SubmitBenefitRequestInput,
} from '../../interfaces/benefit-request.interface';

declare const grecaptcha: any;
declare const google: any;

const URL_PATTERN = '^https?://.*';
const IMAGE_MAX_SIZE_KB = 500;
const IMAGE_MIN_WIDTH = 600;
const IMAGE_MIN_HEIGHT = 400;
const IMAGE_ASPECT_RATIO = 1.5;

@Component({
  selector: 'app-sumar-comercio',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule, FormsModule],
  templateUrl: './sumar-comercio.component.html',
  styleUrls: ['./sumar-comercio.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SumarComercioComponent implements OnInit {
  private fb = inject(FormBuilder);
  private firestoreService = inject(FirestoreService);
  private functionsService = inject(FunctionsService);
  private cdr = inject(ChangeDetectorRef);
  private ngZone = inject(NgZone);

  form!: FormGroup;
  categories: ICategory[] = [];
  selectedCategories: Set<string> = new Set();
  sucursales: BenefitRequestSucursal[] = [];
  subBenefits: BenefitRequestSubBenefit[] = [];
  logoBase64: string | null = null;
  logoPreview: string | null = null;

  loading = false;
  submitted = false;
  error: string | null = null;
  fileError: string | null = null;

  // Sucursal modal
  showSucursalModal = false;
  editingSucursalIndex: number | null = null;
  sucursalSuffix = '';
  sucursalAddress = '';
  sucursalLocation: { lat: number; lng: number } | null = null;

  // Sub-benefit modal
  showSubBenefitModal = false;
  editingSubBenefitIndex: number | null = null;
  subBenefitDiscount = '';
  subBenefitDescription = '';

  ngOnInit() {
    this.createForm();
    this.loadCategories();
  }

  private createForm() {
    this.form = this.fb.group({
      name: ['', [Validators.required, Validators.maxLength(100)]],
      schedule: ['', Validators.maxLength(100)],
      description: ['', Validators.maxLength(500)],
      instagram: ['', [Validators.pattern(URL_PATTERN), Validators.maxLength(200)]],
      whatsapp: ['', [Validators.pattern(URL_PATTERN), Validators.maxLength(200)]],
      contactName: ['', Validators.required],
      contactLastName: ['', Validators.required],
      contactDni: ['', [Validators.required, Validators.pattern(/^\d{7,8}$/)]],
      contactEmail: ['', [Validators.required, Validators.email]],
      contactPhone: ['', [Validators.required, Validators.pattern(/^\d+$/)]],
    });
  }

  private async loadCategories() {
    try {
      const all = await this.firestoreService.getCollection<ICategory>('categories');
      this.categories = all.filter((c) => c.isActive);
      this.cdr.markForCheck();
    } catch (err) {
      console.error('Error cargando categorias:', err);
    }
  }

  // ===================== Categorías =====================

  toggleCategory(uid: string) {
    if (this.selectedCategories.has(uid)) {
      this.selectedCategories.delete(uid);
    } else {
      this.selectedCategories.add(uid);
    }
  }

  // ===================== Logo =====================

  async onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    this.fileError = null;

    // Validar tipo
    if (!['image/jpeg', 'image/jpg'].includes(file.type)) {
      this.fileError = 'Solo se permiten imágenes JPG/JPEG.';
      return;
    }

    // Validar tamaño
    if (file.size > IMAGE_MAX_SIZE_KB * 1024) {
      this.fileError = `La imagen no debe superar los ${IMAGE_MAX_SIZE_KB}KB.`;
      return;
    }

    // Validar dimensiones
    const img = await this.loadImage(file);
    if (img.width < IMAGE_MIN_WIDTH || img.height < IMAGE_MIN_HEIGHT) {
      this.fileError = `La imagen debe ser de al menos ${IMAGE_MIN_WIDTH}x${IMAGE_MIN_HEIGHT}px.`;
      return;
    }

    const ratio = img.width / img.height;
    if (Math.abs(ratio - IMAGE_ASPECT_RATIO) > 0.15) {
      this.fileError = 'La imagen debe tener una relación de aspecto 3:2.';
      return;
    }

    // Convertir a base64
    const reader = new FileReader();
    reader.onload = () => {
      this.logoBase64 = reader.result as string;
      this.logoPreview = this.logoBase64;
      this.cdr.markForCheck();
    };
    reader.readAsDataURL(file);
  }

  private loadImage(file: File): Promise<HTMLImageElement> {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.src = URL.createObjectURL(file);
    });
  }

  removeLogo() {
    this.logoBase64 = null;
    this.logoPreview = null;
    this.fileError = null;
  }

  // ===================== Sucursales =====================

  openSucursalModal(index?: number) {
    if (index !== undefined) {
      const s = this.sucursales[index];
      this.sucursalSuffix = s.suffix;
      this.sucursalAddress = s.address;
      this.sucursalLocation = s.location;
      this.editingSucursalIndex = index;
    } else {
      this.sucursalSuffix = '';
      this.sucursalAddress = '';
      this.sucursalLocation = null;
      this.editingSucursalIndex = null;
    }
    this.autocompleteInstance = null;
    this.showSucursalModal = true;
  }

  saveSucursal() {
    if (!this.sucursalAddress.trim()) return;

    const sucursal: BenefitRequestSucursal = {
      suffix: this.sucursalSuffix.trim(),
      address: this.sucursalAddress.trim(),
      location: this.sucursalLocation,
    };

    if (this.editingSucursalIndex !== null) {
      this.sucursales[this.editingSucursalIndex] = sucursal;
    } else {
      this.sucursales.push(sucursal);
    }

    this.showSucursalModal = false;
  }

  removeSucursal(index: number) {
    this.sucursales.splice(index, 1);
  }

  private autocompleteInstance: any = null;

  initAutocomplete(inputElement: HTMLInputElement) {
    if (this.autocompleteInstance) return;
    if (typeof google === 'undefined' || !google.maps?.places) {
      setTimeout(() => this.initAutocomplete(inputElement), 400);
      return;
    }

    this.autocompleteInstance = new google.maps.places.Autocomplete(inputElement, {
      types: ['address'],
      componentRestrictions: { country: 'ar' },
      fields: ['formatted_address', 'geometry'],
    });

    this.autocompleteInstance.addListener('place_changed', () => {
      const place = this.autocompleteInstance.getPlace();
      this.ngZone.run(() => {
        if (place.formatted_address) {
          this.sucursalAddress = place.formatted_address;
        }
        if (place.geometry?.location) {
          this.sucursalLocation = {
            lat: place.geometry.location.lat(),
            lng: place.geometry.location.lng(),
          };
        }
        this.cdr.markForCheck();
      });
    });
  }

  // ===================== Sub-beneficios =====================

  openSubBenefitModal(index?: number) {
    if (index !== undefined) {
      const sb = this.subBenefits[index];
      this.subBenefitDiscount = sb.discount;
      this.subBenefitDescription = sb.description;
      this.editingSubBenefitIndex = index;
    } else {
      this.subBenefitDiscount = '';
      this.subBenefitDescription = '';
      this.editingSubBenefitIndex = null;
    }
    this.showSubBenefitModal = true;
  }

  saveSubBenefit() {
    if (!this.subBenefitDiscount.trim()) return;

    const sb: BenefitRequestSubBenefit = {
      discount: this.subBenefitDiscount.trim(),
      description: this.subBenefitDescription.trim(),
      isActive: true,
    };

    if (this.editingSubBenefitIndex !== null) {
      this.subBenefits[this.editingSubBenefitIndex] = sb;
    } else {
      this.subBenefits.push(sb);
    }

    this.showSubBenefitModal = false;
  }

  removeSubBenefit(index: number) {
    this.subBenefits.splice(index, 1);
  }

  // ===================== Submit =====================

  async onSubmit() {
    this.error = null;

    // Validar form
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    if (this.selectedCategories.size === 0) {
      this.error = 'Seleccioná al menos una categoría.';
      return;
    }

    if (!this.logoBase64) {
      this.error = 'La imagen del comercio es requerida.';
      return;
    }

    if (this.subBenefits.length === 0) {
      this.error = 'Agregá al menos un beneficio.';
      return;
    }

    if (this.sucursales.length === 0) {
      this.error = 'Agregá al menos una sucursal.';
      return;
    }

    // Validar que todas las sucursales tengan ubicación
    const missingLocation = this.sucursales.some((s) => !s.location);
    if (missingLocation) {
      this.error = 'Todas las sucursales deben tener una ubicación seleccionada del mapa.';
      return;
    }

    this.loading = true;
    this.cdr.markForCheck();

    try {
      const recaptchaToken = await this.getRecaptchaToken();

      const formValues = this.form.getRawValue();

      const isSingleBenefit = this.subBenefits.length === 1;
      const discount = isSingleBenefit ? this.subBenefits[0].discount : 'Múltiples beneficios';
      const subBenefitsPayload = isSingleBenefit ? undefined : this.subBenefits;

      const payload: SubmitBenefitRequestInput = {
        name: formValues.name,
        logoBase64: this.logoBase64,
        discount,
        categories: Array.from(this.selectedCategories),
        description: formValues.description || undefined,
        schedule: formValues.schedule || undefined,
        instagram: formValues.instagram || undefined,
        whatsapp: formValues.whatsapp || undefined,
        subBenefits: subBenefitsPayload,
        sucursales: this.sucursales as any,
        contactName: formValues.contactName,
        contactLastName: formValues.contactLastName,
        contactDni: formValues.contactDni,
        contactEmail: formValues.contactEmail,
        contactPhone: formValues.contactPhone,
        recaptchaToken,
      };

      await this.functionsService.callFunction('submitBenefitRequestV2', payload);
      this.submitted = true;
    } catch (err: any) {
      console.error('Error enviando solicitud:', err);
      this.error = err?.message || 'Ocurrió un error al enviar la solicitud. Intentá nuevamente.';
    } finally {
      this.loading = false;
      this.cdr.markForCheck();
    }
  }

  // ===================== Helpers =====================

  isFieldInvalid(name: string): boolean {
    const control = this.form.get(name);
    return !!(control?.invalid && control?.touched);
  }

  private getRecaptchaToken(): Promise<string> {
    return new Promise((resolve, reject) => {
      const siteKey = (window as any).__RECAPTCHA_SITE_KEY__;
      if (typeof grecaptcha === 'undefined' || !siteKey) {
        reject(new Error('No se pudo cargar la verificación de seguridad. Recargá la página e intentá nuevamente.'));
        return;
      }
      grecaptcha.ready(() => {
        grecaptcha
          .execute(siteKey, { action: 'submit_benefit_request' })
          .then((token: string) => resolve(token))
          .catch((err: any) => reject(err));
      });
    });
  }
}
