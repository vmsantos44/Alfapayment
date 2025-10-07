#!/usr/bin/env python3
"""
Full Propio report analysis
"""
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from models import Interpreter
import pandas as pd
import os

DATABASE_URL = os.getenv('DATABASE_URL', 'sqlite:///./alfa_payment.db')
engine = create_engine(DATABASE_URL)
Session = sessionmaker(bind=engine)
db = Session()

# Read report
df = pd.read_excel('/Users/santos/Downloads/Propio report_September 2025 (1).xlsx')

# Statistics
total_in_report = len(df)
found = 0
not_found = 0
has_rate = 0
missing_rate = 0
total_payable_minutes = 0

print(f'Analyzing all {total_in_report} interpreters from Propio report...\n')

for idx, row in df.iterrows():
    agent = row['Agent']
    payable_min = row['Payable Minutes']
    if pd.notna(payable_min):
        total_payable_minutes += payable_min

    # Parse name and ID
    if ' - ' in str(agent):
        name, propio_id = agent.rsplit(' - ', 1)
        propio_id = propio_id.strip()

        # Look up in database
        interp = db.query(Interpreter).filter(Interpreter.propio_id == propio_id).first()

        if interp:
            found += 1
            rate = interp.rate_per_minute
            if rate and rate != '':
                has_rate += 1
            else:
                missing_rate += 1
        else:
            not_found += 1

print('=' * 60)
print('SUMMARY')
print('=' * 60)
print(f'Total interpreters in report: {total_in_report}')
print(f'Found in database: {found} ({found/total_in_report*100:.1f}%)')
print(f'Not found in database: {not_found}')
print(f'\nRate Status:')
print(f'  With rates set: {has_rate}')
print(f'  Missing rates: {missing_rate} ⚠️')
print(f'\nTotal Payable Minutes: {total_payable_minutes:,.0f}')
print(f'Total Payable Hours: {total_payable_minutes/60:,.1f}')
print('=' * 60)

if missing_rate > 0:
    print(f'\n⚠️  WARNING: {missing_rate} interpreters need rates set before import!')
