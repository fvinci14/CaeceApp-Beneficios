export interface BenefitRequestSucursal {
  suffix: string;
  address: string;
  location: { lat: number; lng: number } | null;
}

export interface BenefitRequestSubBenefit {
  discount: string;
  description: string;
  isActive: boolean;
}

export interface SubmitBenefitRequestInput {
  name: string;
  logoBase64: string;
  discount: string;
  categories: string[];
  description?: string;
  schedule?: string;
  instagram?: string;
  whatsapp?: string;
  subBenefits?: BenefitRequestSubBenefit[];
  sucursales: BenefitRequestSucursal[];
  contactName: string;
  contactLastName: string;
  contactDni: string;
  contactEmail: string;
  contactPhone: string;
  recaptchaToken: string;
}
