import { useState, useCallback } from 'react';
import { Payment, Client } from '@/lib/types';
import { paymentsAPI } from '@/lib/api';

export const usePayments = (clients: Client[]) => {
  const [dbPayments, setDbPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const loadPayments = useCallback(async () => {
    try {
      setLoading(true);
      const response = await paymentsAPI.getAll();
      // Backend returns { data: [...] }, extract the array
      const data = Array.isArray(response) ? response : (response.data || []);
      setDbPayments(data);
    } catch (error) {
      console.error('Error loading payments:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);

  const updatePayment = useCallback(async (paymentId: string, data: any) => {
    try {
      await paymentsAPI.update(paymentId, data);
      setDbPayments(prev => prev.map(p => p.id === paymentId ? { ...p, ...data } : p));
    } catch (error) {
      console.error('Error updating payment:', error);
      throw error;
    }
  }, []);

  const approvePayment = useCallback(async (index: number, calculatedPayments: Payment[]) => {
    if (calculatedPayments.length > 0) {
      // Working with import workflow payments - just update the array
      return { ...calculatedPayments[index], status: 'approved' as const };
    } else {
      // Working with database payments
      const payment = dbPayments[index];
      if (!payment.id) return null;

      try {
        await paymentsAPI.update(payment.id, { status: 'approved' });
        const updated = { ...payment, status: 'approved' };
        setDbPayments(prev => prev.map((p, i) => i === index ? updated : p));
        return updated;
      } catch (error) {
        console.error('Error approving payment:', error);
        throw error;
      }
    }
  }, [dbPayments]);

  const rejectPayment = useCallback(async (index: number, calculatedPayments: Payment[]) => {
    if (calculatedPayments.length > 0) {
      // Working with import workflow payments
      return { ...calculatedPayments[index], status: 'rejected' as const };
    } else {
      // Working with database payments
      const payment = dbPayments[index];
      if (!payment.id) return null;

      try {
        await paymentsAPI.update(payment.id, { status: 'rejected' });
        const updated = { ...payment, status: 'rejected' };
        setDbPayments(prev => prev.map((p, i) => i === index ? updated : p));
        return updated;
      } catch (error) {
        console.error('Error rejecting payment:', error);
        throw error;
      }
    }
  }, [dbPayments]);

  const addAdjustment = useCallback(async (
    index: number,
    adjustment: number,
    note: string,
    calculatedPayments: Payment[]
  ) => {
    if (calculatedPayments.length > 0) {
      // Working with import workflow payments
      const updated = { ...calculatedPayments[index] };
      updated.adjustment = adjustment;
      updated.notes = note;
      updated.interpreterPayment = (parseFloat(updated.interpreterPayment) + adjustment).toFixed(2);
      updated.profit = (parseFloat(updated.clientCharge) - parseFloat(updated.interpreterPayment)).toFixed(2);
      return updated;
    } else {
      // Working with database payments
      const payment = dbPayments[index];
      if (!payment.id) return null;

      try {
        await paymentsAPI.update(payment.id, {
          adjustment,
          notes: note
        });
        const updated = {
          ...payment,
          adjustment,
          notes: note,
          interpreter_payment: payment.interpreter_payment + adjustment,
          profit: payment.client_charge - (payment.interpreter_payment + adjustment)
        };
        setDbPayments(prev => prev.map((p, i) => i === index ? updated : p));
        return updated;
      } catch (error) {
        console.error('Error adding adjustment:', error);
        throw error;
      }
    }
  }, [dbPayments]);

  // Transform database payments to Payment interface format
  const transformDbPayment = useCallback((p: any): Payment => {
    const client = clients.find(c => c.id === p.client_id);
    return {
      clientName: client?.name || p.client_id,
      clientInterpreterID: p.client_interpreter_id,
      interpreterName: p.interpreter_name,
      internalInterpreterName: p.internal_interpreter_name,
      internalInterpreterId: p.interpreter_id,
      languagePair: p.language_pair || '',
      period: p.period,
      clientRate: String(p.client_rate),
      minutes: p.minutes,
      hours: p.hours,
      clientCharge: String(p.client_charge),
      interpreterPayment: String(p.interpreter_payment),
      profit: String(p.profit),
      profitMargin: String(p.profit_margin) + '%',
      status: p.status as 'pending' | 'approved' | 'rejected',
      matchStatus: p.match_status as 'matched' | 'unmatched' | 'no_interpreter_rate',
      adjustment: p.adjustment || 0,
      notes: p.notes || ''
    };
  }, [clients]);

  return {
    dbPayments,
    setDbPayments,
    loading,
    loadPayments,
    updatePayment,
    approvePayment,
    rejectPayment,
    addAdjustment,
    transformDbPayment
  };
};
