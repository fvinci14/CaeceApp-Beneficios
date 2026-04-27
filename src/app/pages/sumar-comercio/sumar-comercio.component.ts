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
import { SiteHeaderComponent } from '../../shared/site-header/site-header.component';
import { SiteFooterComponent } from '../../shared/site-footer/site-footer.component';

declare const grecaptcha: any;
declare const google: any;

const URL_PATTERN = '^https?://.*';

@Component({
  selector: 'app-sumar-comercio',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule, FormsModule, SiteHeaderComponent, SiteFooterComponent],
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

    if (!file.type.startsWith('image/')) {
      this.fileError = 'El archivo debe ser una imagen.';
      input.value = '';
      return;
    }

    try {
      const processed = await this.processLogo(file);
      this.logoBase64 = processed;
      this.logoPreview = processed;
    } catch (err) {
      console.error('Error procesando logo:', err);
      this.fileError = 'No se pudo procesar la imagen. Probá con otro formato.';
    } finally {
      input.value = '';
      this.cdr.markForCheck();
    }
  }

  private async processLogo(file: File): Promise<string> {
    const TARGET_W = 600;
    const TARGET_H = 400;

    const img = await this.loadImage(file);

    const sourceCanvas = document.createElement('canvas');
    sourceCanvas.width = img.width;
    sourceCanvas.height = img.height;
    const sourceCtx = sourceCanvas.getContext('2d');
    if (!sourceCtx) throw new Error('Canvas 2D context no disponible');
    sourceCtx.drawImage(img, 0, 0);

    const bgColor = this.detectBgColor(sourceCtx, img.width, img.height);

    const scale = Math.min(TARGET_W / img.width, TARGET_H / img.height);
    const drawW = img.width * scale;
    const drawH = img.height * scale;
    const drawX = (TARGET_W - drawW) / 2;
    const drawY = (TARGET_H - drawH) / 2;

    const canvas = document.createElement('canvas');
    canvas.width = TARGET_W;
    canvas.height = TARGET_H;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D context no disponible');
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, TARGET_W, TARGET_H);
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, drawX, drawY, drawW, drawH);

    return canvas.toDataURL('image/jpeg', 0.9);
  }

  private detectBgColor(ctx: CanvasRenderingContext2D, width: number, height: number): string {
    const corners: [number, number][] = [
      [0, 0],
      [width - 1, 0],
      [0, height - 1],
      [width - 1, height - 1],
    ];
    let r = 0, g = 0, b = 0, count = 0;
    for (const [x, y] of corners) {
      const px = ctx.getImageData(x, y, 1, 1).data;
      if (px[3] < 128) continue;
      r += px[0];
      g += px[1];
      b += px[2];
      count++;
    }
    if (count === 0) return '#ffffff';
    return `rgb(${Math.round(r / count)}, ${Math.round(g / count)}, ${Math.round(b / count)})`;
  }

  private loadImage(file: File): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(url);
        resolve(img);
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('No se pudo decodificar la imagen'));
      };
      img.src = url;
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
      this.sucursalAddress = s.address;
      this.sucursalLocation = s.location;
      this.editingSucursalIndex = index;
    } else {
      this.sucursalAddress = '';
      this.sucursalLocation = null;
      this.editingSucursalIndex = null;
    }
    this.autocompleteInstance = null;
    this.showSucursalModal = true;
  }

  saveSucursal() {
    if (!this.sucursalAddress.trim()) return;

    const address = this.sucursalAddress.trim();
    const sucursal: BenefitRequestSucursal = {
      suffix: this.deriveSucursalSuffix(address),
      address,
      location: this.sucursalLocation,
    };

    if (this.editingSucursalIndex !== null) {
      this.sucursales[this.editingSucursalIndex] = sucursal;
    } else {
      this.sucursales.push(sucursal);
    }

    this.showSucursalModal = false;
  }

  private deriveSucursalSuffix(address: string): string {
    if (!address) return '';
    const firstPart = address.split(',')[0].trim();
    const stripped = firstPart.replace(/\s+\d+\s*[a-zA-Z]?\s*$/, '').trim();
    if (!stripped) return '';
    return `Suc. ${stripped}`;
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

    const mdpBounds = new google.maps.LatLngBounds(
      new google.maps.LatLng(-38.20, -57.70),
      new google.maps.LatLng(-37.85, -57.40),
    );

    this.autocompleteInstance = new google.maps.places.Autocomplete(inputElement, {
      types: ['address'],
      componentRestrictions: { country: 'ar' },
      fields: ['formatted_address', 'geometry'],
      bounds: mdpBounds,
      strictBounds: false,
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

  onNumericInput(event: Event, fieldName: string) {
    const input = event.target as HTMLInputElement;
    const numericValue = input.value.replace(/\D/g, '');
    if (input.value !== numericValue) {
      input.value = numericValue;
      this.form.get(fieldName)?.setValue(numericValue, { emitEvent: false });
    }
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
