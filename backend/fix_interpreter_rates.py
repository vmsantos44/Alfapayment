#!/usr/bin/env python3
"""
Fix interpreter rates where rate_per_hour equals rate_per_minute
This should calculate rate_per_hour = rate_per_minute * 60
"""

from database import SessionLocal
from models import Interpreter

def fix_interpreter_rates():
    db = SessionLocal()

    try:
        # Find interpreters where rate_per_minute and rate_per_hour are the same
        interpreters = db.query(Interpreter).all()

        fixed_count = 0
        for interp in interpreters:
            if interp.rate_per_minute and interp.rate_per_hour:
                rate_min = float(interp.rate_per_minute)
                rate_hour = float(interp.rate_per_hour)

                # If they're the same (or very close), we need to fix it
                if abs(rate_min - rate_hour) < 0.01:
                    # Calculate correct hourly rate
                    correct_hourly = round(rate_min * 60, 2)

                    print(f"Fixing {interp.contact_name}:")
                    print(f"  Rate per minute: ${rate_min}")
                    print(f"  Old rate per hour: ${rate_hour}")
                    print(f"  New rate per hour: ${correct_hourly}")

                    interp.rate_per_hour = str(correct_hourly)
                    fixed_count += 1

        if fixed_count > 0:
            db.commit()
            print(f"\n✅ Fixed {fixed_count} interpreter rates")
        else:
            print("✅ No rates needed fixing")

    except Exception as e:
        db.rollback()
        print(f"❌ Error: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    fix_interpreter_rates()
