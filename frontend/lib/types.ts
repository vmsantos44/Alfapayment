// Shared types for Alfa Payment System

export interface Interpreter {
  id: string;
  recordId?: string;
  lastName?: string;
  employeeId?: string;
  cloudbreakId?: string;
  languagelinkId?: string;
  propioId?: string;
  contactName: string;
  email?: string;
  language?: string;
  paymentFrequency?: string;
  serviceLocation?: string;
  ratePerMinute?: string;
  ratePerHour?: string;
}

export interface Client {
  id: string;
  name: string;
  idField: string;
  columnTemplate?: Record<string, string>;
}

export interface ClientRate {
  id: string;
  clientId: string;
  language: string;
  serviceLocation?: string;
  ratePerMinute?: number;
  ratePerHour?: number;
  rateType: 'minute' | 'hour';
  createdAt?: string;
  updatedAt?: string;
}

export interface Payment {
  clientName: string;
  clientInterpreterID: string;
  interpreterName: string;
  internalInterpreterName: string;
  internalInterpreterId: string | null;
  languagePair: string;
  period: string;
  clientRate: string;
  minutes: number;
  hours: number;
  clientCharge: string;
  interpreterPayment: string;
  profit: string;
  profitMargin: string;
  status: 'pending' | 'approved' | 'rejected';
  matchStatus: 'matched' | 'unmatched' | 'no_interpreter_rate';
  adjustment: number;
  notes: string;
}

export interface ColumnMapping {
  interpreterId?: string;
  interpreterName?: string;
  minutes?: string;
  hours?: string;
  date?: string;
  languagePair?: string;
  rate?: string;
}

export interface PaymentStats {
  totalRevenue: number;
  totalPayments: number;
  totalProfit: number;
  approved: number;
  pending: number;
  unmatched: number;
  noInterpreterRate: number;
}
