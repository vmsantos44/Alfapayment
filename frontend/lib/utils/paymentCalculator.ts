import { Interpreter, Client, Payment, ColumnMapping } from '../types';

/**
 * Calculate payment for a single row from imported data
 */
export function calculatePaymentForRow(
  row: any,
  columnMapping: ColumnMapping,
  interpreters: Interpreter[],
  client: Client
): Payment {
  const reportInterpreterID = row[columnMapping.interpreterId || ''];
  const interpreterName = row[columnMapping.interpreterName || ''];
  const minutes = parseFloat(row[columnMapping.minutes || ''] || 0);
  const hours = parseFloat(row[columnMapping.hours || ''] || 0);
  const languagePair = row[columnMapping.languagePair || ''];
  const period = row[columnMapping.date || ''];
  const clientRate = parseFloat(row[columnMapping.rate || ''] || 0);

  const matchedInterpreter = interpreters.find(i =>
    i[client.idField as keyof Interpreter] === reportInterpreterID
  );

  let clientCharge = 0;
  let interpreterPayment = 0;
  let matchStatus: 'matched' | 'unmatched' | 'no_interpreter_rate' = 'unmatched';

  if (matchedInterpreter) {
    const hasRate = matchedInterpreter.ratePerMinute || matchedInterpreter.ratePerHour;

    if (!hasRate) {
      matchStatus = 'no_interpreter_rate';
      if (minutes > 0) {
        clientCharge = minutes * clientRate;
      } else if (hours > 0) {
        clientCharge = hours * clientRate;
      }
    } else {
      matchStatus = 'matched';

      if (minutes > 0) {
        clientCharge = minutes * clientRate;
        interpreterPayment = minutes * (parseFloat(matchedInterpreter.ratePerMinute || '0'));
      } else if (hours > 0) {
        clientCharge = hours * clientRate;
        interpreterPayment = hours * (parseFloat(matchedInterpreter.ratePerHour || '0'));
      }
    }
  } else {
    matchStatus = 'unmatched';
    if (minutes > 0) {
      clientCharge = minutes * clientRate;
    } else if (hours > 0) {
      clientCharge = hours * clientRate;
    }
  }

  const profit = clientCharge - interpreterPayment;
  const profitMargin = clientCharge > 0 ? ((profit / clientCharge) * 100).toFixed(1) : '0';

  return {
    clientName: client.name,
    clientInterpreterID: reportInterpreterID,
    interpreterName: interpreterName,
    internalInterpreterName: matchedInterpreter ? matchedInterpreter.contactName : 'UNMATCHED',
    internalInterpreterId: matchedInterpreter ? matchedInterpreter.id : null,
    languagePair,
    period,
    clientRate: clientRate.toFixed(2),
    minutes,
    hours,
    clientCharge: clientCharge.toFixed(2),
    interpreterPayment: interpreterPayment.toFixed(2),
    profit: profit.toFixed(2),
    profitMargin: `${profitMargin}%`,
    status: 'pending' as const,
    matchStatus,
    adjustment: 0,
    notes: ''
  };
}

/**
 * Calculate payments for all rows from imported data
 */
export function calculatePayments(
  importedData: any[],
  columnMapping: ColumnMapping,
  interpreters: Interpreter[],
  client: Client
): Payment[] {
  return importedData.map(row =>
    calculatePaymentForRow(row, columnMapping, interpreters, client)
  );
}

/**
 * Calculate statistics from payments
 */
export function calculatePaymentStats(payments: Payment[]) {
  return payments.reduce((acc, p) => ({
    totalRevenue: acc.totalRevenue + parseFloat(p.clientCharge),
    totalPayments: acc.totalPayments + parseFloat(p.interpreterPayment),
    totalProfit: acc.totalProfit + parseFloat(p.profit),
    approved: acc.approved + (p.status === 'approved' ? 1 : 0),
    pending: acc.pending + (p.status === 'pending' ? 1 : 0),
    unmatched: acc.unmatched + (p.matchStatus === 'unmatched' ? 1 : 0),
    noInterpreterRate: acc.noInterpreterRate + (p.matchStatus === 'no_interpreter_rate' ? 1 : 0)
  }), {
    totalRevenue: 0,
    totalPayments: 0,
    totalProfit: 0,
    approved: 0,
    pending: 0,
    unmatched: 0,
    noInterpreterRate: 0
  });
}

/**
 * Auto-detect column mapping from CSV headers
 */
export function detectColumnMapping(firstRow: Record<string, any>): ColumnMapping {
  const detectedMapping: ColumnMapping = {};

  Object.keys(firstRow).forEach(col => {
    const colLower = col.toLowerCase();
    if (colLower.includes('id')) detectedMapping.interpreterId = col;
    if (colLower.includes('name')) detectedMapping.interpreterName = col;
    if (colLower.includes('minute') && !colLower.includes('rate')) detectedMapping.minutes = col;
    if (colLower.includes('hour') && !colLower.includes('minute') && !colLower.includes('rate')) detectedMapping.hours = col;
    if (colLower.includes('date') || colLower.includes('period')) detectedMapping.date = col;
    if (colLower.includes('language')) detectedMapping.languagePair = col;
    if (colLower.includes('rate')) detectedMapping.rate = col;
  });

  return detectedMapping;
}
