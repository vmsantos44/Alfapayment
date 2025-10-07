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
      const response = await interpretersAPI.getAll();
      // Backend returns { data: [...] }, extract the array
      const data = Array.isArray(response) ? response : (response.data || []);
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

  const syncFromZohoSheet = useCallback(async () => {
    try {
      setLoading(true);
      const result = await interpretersAPI.syncFromZohoSheet();

      // Update state with new/updated interpreters
      if (result.success) {
        // Reload all interpreters to ensure we have the latest data
        await loadInterpreters();
      }

      return result;
    } catch (error) {
      console.error('Error syncing from Zoho Sheet:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [loadInterpreters]);

  const importInterpretersFromCSV = useCallback((file: File) => {
    return new Promise<{ created: number; updated: number; total: number }>((resolve, reject) => {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        transformHeader: (header: string) => {
          // Trim whitespace from column names and normalize
          return header.trim();
        },
        complete: async (results) => {
          try {
            // Helper function to clean rate values (remove $, spaces, etc.)
            const cleanRateValue = (value: any): string => {
              if (!value) return '';
              // Convert to string and remove $, spaces, commas
              const cleaned = String(value).replace(/[$,\s]/g, '').trim();
              // Return empty string if not a valid number
              return cleaned && !isNaN(parseFloat(cleaned)) ? cleaned : '';
            };

            const imported = results.data.map((row: any) => {
              // Debug: Log the first row to see actual column names
              if (results.data.indexOf(row) === 0) {
                console.log('CSV Column Names:', Object.keys(row));
                console.log('First Row Data:', row);
                console.log('Rate/Min value:', row['Rate/Min']);
                console.log('Rate/Hour value:', row['Rate/Hour']);
              }

              return {
                record_id: row['Record Id'] || row['Record ID'] || row['record_id'] || '',
                last_name: row['Last Name'] || row['LastName'] || row['last_name'] || '',
                employee_id: row['Employee ID'] || row['Emplyee ID'] || row['EmployeeID'] || row['employee_id'] || '',
                cloudbreak_id: row['Cloudbreak ID'] || row['CloudbreakID'] || row['Cloudbreak Id'] || row['cloudbreak_id'] || '',
                languagelink_id: row['Languagelink ID'] || row['LanguagelinkID'] || row['Languagelink Id'] || row['LanguageLink ID'] || row['languagelink_id'] || '',
                propio_id: row['Propio ID'] || row['PropioID'] || row['Propio Id'] || row['propio_id'] || '',
                contact_name: row['Contact Name'] || row['ContactName'] || row['Name'] || row['Full Name'] || row['contact_name'] || '',
                email: row['Email'] || row['email'] || '',
                language: row['Language'] || row['language'] || '',
                payment_frequency: row['Payment frequency'] || row['Payment Frequency'] || row['PaymentFrequency'] || row['payment_frequency'] || '',
                service_location: row['Service Location'] || row['ServiceLocation'] || row['Service_Location'] || row['service_location'] || '',
                // Extensive rate field mapping - try all possible variations and clean the values
                rate_per_minute: cleanRateValue(
                  row['Rate Per Minute'] ||
                  row['Rate/Min'] ||
                  row['Rate/Minute'] ||
                  row['RatePerMinute'] ||
                  row['rate_per_minute'] ||
                  row['Rate per minute'] ||
                  row['RATE PER MINUTE'] ||
                  row['Minute Rate'] ||
                  row['Min Rate'] ||
                  row['Agreed Rate'] ||  // From Zoho
                  row['Rate'] ||  // Generic
                  ''
                ),
                rate_per_hour: cleanRateValue(
                  row['Rate Per Hour'] ||
                  row['Rate per Hour'] ||
                  row['Rate/Hour'] ||
                  row['Rate/Hou'] ||
                  row['RatePerHour'] ||
                  row['rate_per_hour'] ||
                  row['RATE PER HOUR'] ||
                  row['Hourly Rate'] ||
                  row['Hour Rate'] ||
                  row['Hr Rate'] ||
                  ''
                )
              };
            });

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
    importInterpretersFromCSV,
    syncFromZohoSheet
  };
};
