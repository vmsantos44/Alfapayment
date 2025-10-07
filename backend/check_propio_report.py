#!/usr/bin/env python3
"""
Check Propio report against database
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

# Parse first 10 agents
found = 0
not_found = 0
missing_rate = 0

print('Checking first 10 interpreters from report:\n')
for idx, row in df.head(10).iterrows():
    agent = row['Agent']
    payable_min = row['Payable Minutes']

    # Parse name and ID
    if ' - ' in str(agent):
        name, propio_id = agent.rsplit(' - ', 1)
        propio_id = propio_id.strip()

        # Look up in database
        interp = db.query(Interpreter).filter(Interpreter.propio_id == propio_id).first()

        if interp:
            rate = interp.rate_per_minute
            status = 'FOUND'
            if rate and rate != '':
                payment = float(payable_min) * float(rate)
                print(f'{status}: {name} (ID: {propio_id})')
                print(f'     DB Name: {interp.contact_name}')
                print(f'     Rate: ${rate}/min | Payable Min: {payable_min:.0f} | Payment: ${payment:.2f}')
            else:
                print(f'{status}: {name} (ID: {propio_id}) - WARNING: NO RATE SET')
                missing_rate += 1
            found += 1
        else:
            print(f'NOT FOUND: {name} (ID: {propio_id})')
            not_found += 1
        print()

print(f'\nSummary of first 10:')
print(f'  Found in DB: {found}')
print(f'  Not found: {not_found}')
print(f'  Missing rates: {missing_rate}')
