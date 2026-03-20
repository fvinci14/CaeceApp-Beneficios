export interface Place {
  id: string;
  name: string;
  logo: string;
  discount: string;
  categories: string[];
  description: string;
  address: string;
  location?: {
    lat: number;
    lng: number;
  };
  schedule: string;
  instagram: string;
  whatsapp: string;
  isActive: boolean;
  frequency: number;
  createdAt: Date;
  updatedAt: Date;
  subBenefits?: SubBenefit[];
}

export interface SubBenefit {
  id: string;
  discount: string;
  description?: string;
  isActive: boolean;
}

export interface ICategory {
  uid: string;
  name: string;
  icon: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
