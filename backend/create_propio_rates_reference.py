#!/usr/bin/env python3
"""
Create reference list of Propio interpreters that need rates filled in Zoho Sheet
"""
import pandas as pd
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from models import Interpreter
import os

# Read report
df = pd.read_excel('/Users/santos/Downloads/Propio report_September 2025 (1).xlsx')

# Get database connection
DATABASE_URL = os.getenv('DATABASE_URL', 'sqlite:///./alfa_payment.db')
engine = create_engine(DATABASE_URL)
Session = sessionmaker(bind=engine)
db = Session()

# Create list of interpreters needing rates
output = []

for idx, row in df.iterrows():
    agent = row['Agent']
    payable_min = row.get('Payable Minutes', 0)

    if ' - ' in str(agent) and pd.notna(payable_min):
        name, propio_id = agent.rsplit(' - ', 1)
        propio_id = propio_id.strip()

        # Look up in database
        interp = db.query(Interpreter).filter(Interpreter.propio_id == propio_id).first()

        if interp:
            rate = interp.rate_per_minute
            has_rate = 'Yes' if (rate and rate != '') else 'No'
            current_rate = rate if (rate and rate != '') else ''

            output.append({
                'Propio ID': propio_id,
                'Full Name': name,
                'Email': interp.email or '',
                'Language': interp.language or '',
                'Country': interp.country or '',
                'Current Rate': current_rate,
                'Has Rate?': has_rate,
                'Payable Minutes (Sept)': f'{payable_min:,.0f}'
            })

# Create DataFrame and save
output_df = pd.DataFrame(output)

# Sort by payable minutes (descending)
output_df['sort_minutes'] = output_df['Payable Minutes (Sept)'].str.replace(',', '').astype(float)
output_df = output_df.sort_values('sort_minutes', ascending=False)
output_df = output_df.drop('sort_minutes', axis=1)

# Save to CSV
output_file = '/Users/santos/Desktop/Propio_Interpreters_Need_Rates.csv'
output_df.to_csv(output_file, index=False)

print(f'✓ Created reference list: {output_file}')
print(f'\nTotal interpreters in report: {len(output)}')
print(f'Already have rates: {len(output_df[output_df["Has Rate?"] == "Yes"])}')
print(f'Need rates filled: {len(output_df[output_df["Has Rate?"] == "No"])}')
print(f'\nTop 10 interpreters by volume (need rates):')
print('-' * 80)
for idx, row in output_df[output_df['Has Rate?'] == 'No'].head(10).iterrows():
    print(f'{row["Propio ID"]:6} | {row["Full Name"]:35} | {row["Language"]:15} | {row["Payable Minutes (Sept)"]:>10}')
