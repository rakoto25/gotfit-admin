export type AccountStatus = "approved" | "pending" | "rejected" | "suspended";
export type AnnouncementStatus = "brouillon" | "en_attente" | "valide" | "refuse";

export type Role = {
  id?: number;
  name?: string;
  slug?: string;
};

export type AdminUser = {
  id: number;
  name?: string;
  email?: string;
  phone?: string;
  address?: string;
  bio?: string;
  coach_title?: string | null;
  coach_speciality?: string | null;
  coach_experience_years?: number | null;
  photo?: string | null;
  photo_url?: string | null;
  roles?: Role[];
  account_status?: AccountStatus | string;
  status?: string;
  rejection_reason?: string | null;
  siret?: string | null;
  siret_verified_at?: string | null;
  stripe_account_id?: string | null;
  stripe_onboarding_completed?: boolean;
  last_login_at?: string | null;
  created_at?: string;
};

export type Announcement = {
  id: number;
  titre?: string;
  title?: string;
  contenu?: string;
  description?: string;
  status?: AnnouncementStatus | string;
  announcement_type?: "coach_service" | "client_request" | string;
  category?: string | null;
  type_prestation?: string | null;
  price?: number | string | null;
  duration?: number | null;
  is_online?: boolean;
  city?: string | null;
  location?: string | null;
  address?: string | null;
  image?: string | null;
  is_boosted?: boolean;
  created_at?: string;
  user?: AdminUser;
};

export type Payment = {
  id: number;
  reservation_id?: number;
  amount?: number | string;
  service_fee?: number | string;
  commission?: number | string;
  intervenant_amount?: number | string;
  net_amount?: number | string;
  currency?: string;
  status?: string;
  payout_status?: string;
  payment_intent_id?: string | null;
  stripe_transfer_id?: string | null;
  transferred_at?: string | null;
  created_at?: string;
  client?: AdminUser;
  intervenant?: AdminUser;
  reservation?: Reservation;
};

export type Reservation = {
  id: number;
  reservation_date?: string;
  reservation_time?: string;
  guests?: number;
  note?: string | null;
  price?: number | string;
  total_client_amount?: number | string;
  service_fee_amount?: number | string;
  commission_amount?: number | string;
  intervenant_amount?: number | string;
  currency?: string;
  status?: string;
  is_paid?: boolean;
  payment_status?: string;
  prestation_status?: string;
  payout_status?: string;
  dispute_reason?: string | null;
  resolution_note?: string | null;
  payment_intent_id?: string | null;
  stripe_transfer_id?: string | null;
  created_at?: string;
  client?: AdminUser;
  intervenant?: AdminUser;
  annonce?: Announcement;
  payement?: Payment | null;
};

export type CredentialDocument = {
  id: number;
  name?: string;
  document_type?: string | null;
  document_number?: string | null;
  issuing_organization?: string | null;
  issued_at?: string | null;
  expires_at?: string | null;
  status?: string;
  file_path?: string | null;
  file_url?: string | null;
  is_expired?: boolean;
  rejection_reason?: string | null;
  created_at?: string;
  user?: AdminUser;
};

export type DashboardStats = {
  utilisateurs?: number;
  clients?: number;
  intervenants?: number;
  admins?: number;
  structures?: number;
  intervenants_valides?: number;
  structures_validees?: number;
  annonces?: number;
  annonces_publiees?: number;
  reservations?: number;
  reservations_payees?: number;
  avis_en_attente?: number;
  chiffre_affaires?: number | string;
  commissions_gotfit?: number | string;
  revenus_intervenants?: number | string;
  boosts_vendus?: number;
};

export type PaymentSummary = {
  total: number;
  totalServiceFee: number;
  totalCommission: number;
  totalGotfit: number;
  totalIntervenant: number;
};

export type BusinessSetting = {
  id?: number;
  key: string;
  value: string | number;
  description?: string | null;
};
