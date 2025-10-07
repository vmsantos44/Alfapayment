#!/usr/bin/env python3
"""
Propio Report Import Utilities
"""
from typing import Dict, List, Optional
from sqlalchemy.orm import Session
from datetime import datetime
import pandas as pd
import io

from models import Client, Interpreter, Payment, ClientRate, PaymentStatus, MatchStatus


def parse_propio_report(file_content: bytes) -> List[Dict]:
    """
    Parse Propio Excel report and extract interpreter data

    Args:
        file_content: Binary content of the Excel file

    Returns:
        List of dictionaries with parsed data
    """
    # Read Excel file
    df = pd.read_excel(io.BytesIO(file_content))

    # Expected columns:
    # Agent, Utilization %, Total Portal Hours, Calls, Payable Minutes, N/A's, Rejects

    results = []
    for idx, row in df.iterrows():
        agent = row.get('Agent', '')
        payable_min = row.get('Payable Minutes', 0)

        # Skip if no agent or no payable minutes
        if not agent or pd.isna(payable_min) or payable_min == 0:
            continue

        # Parse agent name and Propio ID
        if ' - ' in str(agent):
            name, propio_id = agent.rsplit(' - ', 1)
            propio_id = propio_id.strip()
            name = name.strip()
        else:
            # Can't parse - skip
            continue

        results.append({
            'name': name,
            'propio_id': propio_id,
            'payable_minutes': float(payable_min),
            'utilization_pct': row.get('Utilization %', 0),
            'total_portal_hours': row.get('Total Portal Hours', 0),
            'calls': row.get('Calls', 0),
            'nas': row.get("N/A's", 0),
            'rejects': row.get('Rejects', 0)
        })

    return results


def process_propio_import(
    parsed_data: List[Dict],
    period: str,
    db: Session
) -> Dict:
    """
    Process parsed Propio data and create payment records

    Args:
        parsed_data: List of dictionaries from parse_propio_report
        period: Period string (e.g., "September 2025")
        db: Database session

    Returns:
        Dictionary with import results
    """
    # Get Propio client
    propio_client = db.query(Client).filter(Client.name == "Propio").first()
    if not propio_client:
        raise ValueError("Propio client not found in database")

    # Results tracking
    created = []
    matched = []
    unmatched = []
    no_interpreter_rate = []
    no_client_rate = []
    errors = []

    # ID generation counter
    base_timestamp = int(datetime.utcnow().timestamp() * 1000)
    id_counter = 0

    for data in parsed_data:
        try:
            propio_id = data['propio_id']
            payable_minutes = data['payable_minutes']

            # Find interpreter by Propio ID
            interpreter = db.query(Interpreter).filter(
                Interpreter.propio_id == propio_id
            ).first()

            if not interpreter:
                unmatched.append({
                    'propio_id': propio_id,
                    'name': data['name'],
                    'payable_minutes': payable_minutes,
                    'reason': 'Interpreter not found in database'
                })
                continue

            # Check if interpreter has rate
            interp_rate = interpreter.rate_per_minute
            if not interp_rate or interp_rate == '':
                no_interpreter_rate.append({
                    'propio_id': propio_id,
                    'name': interpreter.contact_name,
                    'payable_minutes': payable_minutes
                })
                continue

            interp_rate_float = float(interp_rate)

            # Get client rate for this language
            language = interpreter.language or 'Spanish'  # Default to Spanish
            client_rate_obj = db.query(ClientRate).filter(
                ClientRate.client_id == propio_client.id,
                ClientRate.language == language
            ).first()

            if not client_rate_obj:
                no_client_rate.append({
                    'propio_id': propio_id,
                    'name': interpreter.contact_name,
                    'language': language,
                    'payable_minutes': payable_minutes
                })
                continue

            client_rate = client_rate_obj.rate_per_minute or client_rate_obj.rate_amount or 0

            # Calculate payments (round to 2 decimal places to avoid floating point errors)
            interpreter_payment = round(payable_minutes * interp_rate_float, 2)
            client_charge = round(payable_minutes * float(client_rate), 2)
            profit = round(client_charge - interpreter_payment, 2)
            profit_margin = round((profit / client_charge * 100), 2) if client_charge > 0 else 0

            # Create payment record
            payment_id = f"{base_timestamp}_{id_counter}"
            id_counter += 1
            payment = Payment(
                id=payment_id,
                client_id=propio_client.id,
                interpreter_id=interpreter.id,
                client_interpreter_id=propio_id,
                interpreter_name=data['name'],
                internal_interpreter_name=interpreter.contact_name,
                language_pair=language,
                period=period,
                client_rate=float(client_rate),
                minutes=payable_minutes,
                hours=payable_minutes / 60,
                client_charge=client_charge,
                interpreter_payment=interpreter_payment,
                profit=profit,
                profit_margin=profit_margin,
                status=PaymentStatus.pending,
                match_status=MatchStatus.matched,
                notes=f"Imported from Propio report. Utilization: {data.get('utilization_pct', 0):.1%}, Calls: {data.get('calls', 0)}, Rejects: {data.get('rejects', 0)}"
            )

            db.add(payment)
            created.append(payment)
            matched.append({
                'propio_id': propio_id,
                'name': interpreter.contact_name,
                'language': language,
                'minutes': round(payable_minutes, 2),
                'interpreter_payment': round(interpreter_payment, 2),
                'client_charge': round(client_charge, 2),
                'profit': round(profit, 2)
            })

        except Exception as e:
            errors.append({
                'propio_id': data.get('propio_id'),
                'name': data.get('name'),
                'error': str(e)
            })

    return {
        'success': True,
        'created': len(created),
        'matched': matched,
        'unmatched': unmatched,
        'no_interpreter_rate': no_interpreter_rate,
        'no_client_rate': no_client_rate,
        'errors': errors,
        'total_processed': len(parsed_data)
    }
