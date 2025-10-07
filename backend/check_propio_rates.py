#!/usr/bin/env python3
"""
Check Propio interpreter rates in database
"""
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from models import Interpreter
import os

DATABASE_URL = os.getenv('DATABASE_URL', 'sqlite:///./alfa_payment.db')
engine = create_engine(DATABASE_URL)
Session = sessionmaker(bind=engine)
db = Session()

# Get Propio interpreters from database
propio_interps = db.query(Interpreter).filter(
    Interpreter.propio_id.isnot(None),
    Interpreter.propio_id != ''
).all()

print(f'Found {len(propio_interps)} interpreters with Propio IDs in database')
print()

# Check which ones have rates vs don't
with_rate = 0
without_rate = 0

print('Sample of Propio interpreters:')
print('=' * 80)
for interp in propio_interps[:20]:
    rate = interp.rate_per_minute
    if rate and rate != '':
        status = f'Rate: ${rate}/min'
        with_rate += 1
    else:
        status = 'NO RATE'
        without_rate += 1

    print(f'{interp.propio_id:6} | {interp.contact_name:35} | {status}')

print()
print(f'Summary: {with_rate} with rates, {without_rate} without rates')
