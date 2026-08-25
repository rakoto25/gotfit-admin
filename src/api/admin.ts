import axios from "axios";
import api from "./axios";
import type {
  AdminUser,
  Announcement,
  BusinessSetting,
  CredentialDocument,
  DashboardStats,
  Payment,
  PaymentSummary,
  Reservation,
} from "../types/admin";

type ApiRecord = Record<string, unknown>;

const asRecord = (value: unknown): ApiRecord =>
  typeof value === "object" && value !== null ? (value as ApiRecord) : {};

const asNumber = (value: unknown) => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

const listFrom = <T>(payload: unknown, keys: string[]): T[] => {
  if (Array.isArray(payload)) return payload as T[];
  const root = asRecord(payload);

  for (const key of keys) {
    if (Array.isArray(root[key])) return root[key] as T[];
  }

  const nested = asRecord(root.data);
  for (const key of keys) {
    if (Array.isArray(nested[key])) return nested[key] as T[];
  }

  return Array.isArray(root.data) ? (root.data as T[]) : [];
};

export const getApiError = (error: unknown, fallback: string) => {
  if (!axios.isAxiosError(error)) return fallback;

  const payload = asRecord(error.response?.data);
  const errors = asRecord(payload.errors);
  const firstValidation = Object.values(errors).flatMap((value) =>
    Array.isArray(value) ? value : []
  )[0];

  if (typeof firstValidation === "string") return firstValidation;
  if (typeof payload.message === "string") return payload.message;
  if (typeof payload.error === "string") return payload.error;
  return fallback;
};

export const adminApi = {
  async dashboard(): Promise<DashboardStats> {
    const { data } = await api.get("/admin/dashboard");
    return asRecord(asRecord(data).stats) as DashboardStats;
  },

  async users(): Promise<AdminUser[]> {
    const { data } = await api.get("/users");
    return listFrom<AdminUser>(data, ["users"]);
  },

  async createUser(payload: ApiRecord): Promise<AdminUser> {
    const { data } = await api.post("/users", payload);
    return asRecord(data).user as AdminUser;
  },

  async updateUser(id: number, payload: ApiRecord): Promise<AdminUser> {
    const { data } = await api.put(`/users/${id}`, payload);
    return asRecord(data).user as AdminUser;
  },

  async validateUser(id: number, status: string, rejectionReason?: string): Promise<AdminUser> {
    const { data } = await api.put(`/users/${id}/validate`, {
      status,
      rejection_reason: rejectionReason || null,
    });
    return asRecord(data).user as AdminUser;
  },

  async verifySiret(id: number, verified: boolean): Promise<AdminUser> {
    const { data } = await api.put(`/users/${id}/siret/verify`, { verified });
    return asRecord(data).user as AdminUser;
  },

  async deleteUser(id: number): Promise<void> {
    await api.delete(`/users/${id}`);
  },

  async announcements(): Promise<Announcement[]> {
    const { data } = await api.get("/getAllAnnonce");
    return listFrom<Announcement>(data, ["annonces"]);
  },

  async approveAnnouncement(id: number): Promise<Announcement> {
    const { data } = await api.put(`/annonces/${id}/valide`, { status: "valide" });
    return asRecord(data).annonce as Announcement;
  },

  async rejectAnnouncement(id: number): Promise<Announcement> {
    const { data } = await api.put(`/annonces/${id}/refuser`);
    return asRecord(data).annonce as Announcement;
  },

  async deleteAnnouncement(id: number): Promise<void> {
    await api.delete(`/annonces/${id}`);
  },

  async documents(): Promise<CredentialDocument[]> {
    const { data } = await api.get("/documents");
    return listFrom<CredentialDocument>(data, ["documents"]);
  },

  async approveDocument(id: number): Promise<CredentialDocument> {
    const { data } = await api.put(`/documents/${id}/valider`);
    return asRecord(data).document as CredentialDocument;
  },

  async rejectDocument(id: number, rejectionReason: string): Promise<CredentialDocument> {
    const { data } = await api.put(`/documents/${id}/refuser`, {
      rejection_reason: rejectionReason,
    });
    return asRecord(data).document as CredentialDocument;
  },

  async deleteDocument(id: number): Promise<void> {
    await api.delete(`/documents/${id}`);
  },

  async reservations(): Promise<Reservation[]> {
    const { data } = await api.get("/reservation/all");
    return listFrom<Reservation>(data, ["reservations"]);
  },

  async payments(): Promise<{ payments: Payment[]; summary: PaymentSummary }> {
    const { data } = await api.get("/admin/payments");
    const record = asRecord(data);
    return {
      payments: listFrom<Payment>(data, ["payments", "payements"]),
      summary: {
        total: asNumber(record.total),
        totalServiceFee: asNumber(record.totalServiceFee),
        totalCommission: asNumber(record.totalCommission),
        totalGotfit: asNumber(record.totalGotfit),
        totalIntervenant: asNumber(record.totalIntervenant),
      },
    };
  },

  async businessSettings(): Promise<BusinessSetting[]> {
    const { data } = await api.get("/admin/business-settings");
    return listFrom<BusinessSetting>(data, ["settings"]);
  },

  async updateBusinessSettings(settings: Record<string, number>): Promise<BusinessSetting[]> {
    const { data } = await api.put("/admin/business-settings", { settings });
    return listFrom<BusinessSetting>(data, ["settings"]);
  },

  async validatePrestation(id: number): Promise<Reservation> {
    const { data } = await api.post(`/reservation/${id}/validate-prestation`);
    return asRecord(data).reservation as Reservation;
  },

  async transferToCoach(id: number): Promise<Reservation> {
    const { data } = await api.post(`/reservation/${id}/transfer-to-coach`);
    return asRecord(data).reservation as Reservation;
  },

  async refundReservation(id: number, payload: ApiRecord): Promise<Reservation> {
    const { data } = await api.post(`/reservation/${id}/refund`, payload);
    return asRecord(data).reservation as Reservation;
  },

  async resolveDispute(id: number, decision: "validate" | "refund" | "cancel", note: string): Promise<Reservation> {
    const { data } = await api.post(`/reservation/${id}/resolve-dispute`, {
      decision,
      admin_note: note || null,
    });
    return asRecord(data).reservation as Reservation;
  },
};
