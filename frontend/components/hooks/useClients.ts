import { useState, useCallback } from 'react';
import { Client, ClientRate } from '@/lib/types';
import { clientsAPI, clientRatesAPI } from '@/lib/api';

export const useClients = () => {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(false);

  const loadClients = useCallback(async () => {
    try {
      setLoading(true);
      const response = await clientsAPI.getAll();
      // Backend returns { data: [...] }, extract the array
      const data = Array.isArray(response) ? response : (response.data || []);
      setClients(data);
    } catch (error) {
      console.error('Error loading clients:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);

  const createClient = useCallback(async (data: { name: string; email?: string; currency?: string; address?: string; rates?: ClientRate[] }) => {
    try {
      const idField = data.name.toLowerCase().replace(/\s+/g, '') + 'Id';
      const created = await clientsAPI.create({
        name: data.name,
        id_field: idField,
        email: data.email,
        currency: data.currency || 'USD',
        address: data.address
      });
      setClients(prev => [...prev, created]);

      // If there are temp rates, save them
      if (data.rates && data.rates.length > 0) {
        for (const rate of data.rates) {
          if (rate.id.startsWith('temp-')) {
            await clientRatesAPI.create({
              clientId: created.id,
              language: rate.language,
              ratePerMinute: rate.ratePerMinute,
              ratePerHour: rate.ratePerHour,
              rateType: rate.rateType,
            });
          }
        }
      }

      return created;
    } catch (error) {
      console.error('Error creating client:', error);
      throw error;
    }
  }, []);

  const updateClient = useCallback(async (id: string, data: { name: string; email?: string; currency?: string; address?: string }) => {
    try {
      const updated = await clientsAPI.update(id, {
        name: data.name,
        email: data.email,
        currency: data.currency,
        address: data.address
      });
      setClients(prev => prev.map(c => c.id === id ? updated : c));
      return updated;
    } catch (error) {
      console.error('Error updating client:', error);
      throw error;
    }
  }, []);

  const deleteClient = useCallback(async (id: string) => {
    try {
      await clientsAPI.delete(id);
      setClients(prev => prev.filter(c => c.id !== id));
    } catch (error) {
      console.error('Error deleting client:', error);
      throw error;
    }
  }, []);

  return {
    clients,
    setClients,
    loading,
    loadClients,
    createClient,
    updateClient,
    deleteClient
  };
};
