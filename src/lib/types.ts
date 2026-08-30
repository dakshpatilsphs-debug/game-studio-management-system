// ===== Core domain types =====

export type StationType = "PC" | "PS5" | "PS4" | "VR" | "Nintendo Switch" | "Racing";
export type StationStatus = "available" | "rented" | "maintenance";
export type SessionStatus = "active" | "completed";
export type PaymentMethod = "Cash" | "UPI" | "Card";

export interface Station {
  id: string;
  name: string;
  type: StationType;
  hourlyRate: number;
  status: StationStatus;
  specs?: string;
}

export interface GameSession {
  id: string;
  customerName: string;
  customerId?: string;
  customerPhone?: string;
  stationId: string;
  stationName: string;
  type: StationType;
  startTime: number; // epoch ms
  endTime: number | null;
  hourlyRate: number;
  status: SessionStatus;
  baseAmount?: number; // time-based charge
  extrasAmount?: number; // snacks etc.
  extras?: ExtraItem[];
  paymentMethod?: PaymentMethod | null;
  totalCost: number; // final cost when completed (= base + extras)
  note?: string;
}

export type ExpenseCategory =
  | "Rent"
  | "Electricity"
  | "Maintenance"
  | "Equipment"
  | "Salary"
  | "Snacks & Drinks"
  | "Internet"
  | "Marketing"
  | "Other";

export interface Expense {
  id: string;
  description: string;
  category: ExpenseCategory;
  amount: number;
  date: number; // epoch ms
  note?: string;
}

export interface BillItem {
  description: string;
  qty: number;
  price: number;
}

export interface Bill {
  id: string;
  billNumber: string;
  customerName: string;
  items: BillItem[];
  subtotal: number;
  taxRate: number; // percentage
  taxAmount: number;
  discount: number;
  total: number;
  paymentMethod: string;
  createdAt: number;
  note?: string;
  fromSession?: boolean; // generated from a session billing
  sessionId?: string;
  // Client + dates (for formal invoices)
  clientCompany?: string;
  clientAddress?: string;
  dueDate?: number;
}

export interface ExtraItem {
  name: string;
  qty: number;
  price: number;
}

export type RateConfig = {
  pricePerHour: number;
  happyHourPrice: number | null;
  happyHourStart: string; // "HH:MM"
  happyHourEnd: string; // "HH:MM"
};

export interface Customer {
  id: string;
  name: string;
  phone: string;
  prepaidBalance: number;
  totalVisits: number;
  createdAt: number;
}

export interface Settings {
  studioName: string;
  currency: string;
  taxRate: number;
  logo?: string; // base64 data URL of the studio logo
  rates: Record<StationType, RateConfig>;
  snacks: ExtraItem[]; // snack catalog
  // Business identity (shown on invoices)
  businessEmail?: string;
  businessPhone?: string;
  businessAddress?: string;
  // Payment details (shown on invoice footer)
  upiId?: string;
  bankName?: string;
  bankAccount?: string;
  bankIfsc?: string;
  swift?: string; // SWIFT/BIC for international wire
  beneficiary?: string; // account holder name for bank wire
  paypal?: string;
  paymentTerms?: string;
  // Billing
  billingRoundOffMinutes?: number; // round up to nearest N minutes, e.g. 1,5,10,15,30
  prebookDepositPercent?: number; // % of rent to pay upfront for prebookings, editable
}

export const EXPENSE_CATEGORIES: ExpenseCategory[] = [
  "Rent",
  "Electricity",
  "Maintenance",
  "Equipment",
  "Salary",
  "Snacks & Drinks",
  "Internet",
  "Marketing",
  "Other",
];

export type PrebookStatus = "pending" | "confirmed" | "cancelled" | "converted";

export interface Prebook {
  id: string;
  customerName: string;
  customerPhone?: string;
  customerId?: string;
  stationId: string;
  stationName: string;
  type: StationType;
  date: number; // day start ms (00:00 of booking date)
  startTime: number; // epoch ms
  endTime: number; // epoch ms
  durationMinutes: number;
  hourlyRate: number;
  totalRent: number;
  depositPercent: number;
  depositAmount: number;
  remainingAmount: number;
  status: PrebookStatus;
  paymentMethod?: string;
  note?: string;
  createdAt: number;
  // link owner
  studioId?: string;
}

export const STATION_TYPES: StationType[] = [
  "PC",
  "PS5",
  "PS4",
  "VR",
  "Nintendo Switch",
  "Racing",
];
