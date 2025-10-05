import { useState, useCallback } from 'react';
import { Interpreter } from '@/lib/types';
import { interpretersAPI } from '@/lib/api';
import Papa from 'papaparse';

export const useInterpreters = () => {
  const [interpreters, setInterpreters] = useState<Interpreter[]>([]);
  const [loading, setLoading] = useState(false);

  const loadInterpreters = useCallback(async () => {
    try {
      setLoading(true);
      const data = await interpretersAPI.getAll();
      setInterpreters(data);
    } catch (error) {
      console.error('Error loading interpreters:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);

  const createInterpreter = useCallback(async (data: Partial<Interpreter>) => {
    try {
      const created = await interpretersAPI.create(data);
      setInterpreters(prev => [...prev, created]);
      return created;
    } catch (error) {
      console.error('Error creating interpreter:', error);
      throw error;
    }
  }, []);

  const updateInterpreter = useCallback(async (id: string, data: Partial<Interpreter>) => {
    try {
      const updated = await interpretersAPI.update(id, data);
      setInterpreters(prev => prev.map(i => i.id === id ? updated : i));
      return updated;
    } catch (error) {
      console.error('Error updating interpreter:', error);
      throw error;
    }
  }, []);

  const deleteInterpreter = useCallback(async (id: string) => {
    try {
      await interpretersAPI.delete(id);
      setInterpreters(prev => prev.filter(i => i.id !== id));
    } catch (error) {
      console.error('Error deleting interpreter:', error);
      throw error;
    }
  }, []);

  const importInterpretersFromCSV = useCallback((file: File) => {
    return new Promise<{ created: number; updated: number; total: number }>((resolve, reject) => {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: async (results) => {
          try {
            const imported = results.data.map((row: any) => ({
              record_id: row['Record Id'] || '',
              last_name: row['Last Name'] || '',
              employee_id: row['Employee ID'] || row['Emplyee ID'] || '',
              cloudbreak_id: row['Cloudbreak ID'] || '',
              languagelink_id: row['Languagelink ID'] || '',
              propio_id: row['Propio ID'] || '',
              contact_name: row['Contact Name'] || '',
              email: row['Email'] || '',
              language: row['Language'] || '',
              payment_frequency: row['Payment frequency'] || '',
              service_location: row['Service Location'] || '',
              rate_per_minute: row['Rate Per Minute'] || row['Rate/Min'] || '',
              rate_per_hour: row['Rate Per Hour'] || row['Rate per Hour'] || row['Rate/Hour'] || ''
            }));

            const result = await interpretersAPI.bulkCreate(imported);

            // Combine created and updated interpreters
            const allInterpreters = [...result.created, ...result.updated];

            // Update state with new/updated interpreters
            setInterpreters(prev => {
              const existingIds = new Set(prev.map(i => i.id));
              const newInterpreters = allInterpreters.filter(i => !existingIds.has(i.id));
              const updatedInterpreters = prev.map(existing => {
                const updated = allInterpreters.find(i => i.id === existing.id);
                return updated || existing;
              });

              return [...updatedInterpreters, ...newInterpreters];
            });

            resolve(result.summary);
          } catch (error) {
            console.error('Error importing interpreters:', error);
            reject(error);
          }
        },
        error: (error) => {
          reject(error);
        }
      });
    });
  }, []);

  return {
    interpreters,
    setInterpreters,
    loading,
    loadInterpreters,
    createInterpreter,
    updateInterpreter,
    deleteInterpreter,
    importInterpretersFromCSV
  };
};
