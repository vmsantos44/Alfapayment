"""
Seed script to populate database with mock data for testing
"""
import requests
import random
from datetime import datetime, timedelta

API_URL = "http://localhost:8000"

# Common languages
LANGUAGES = ["Spanish", "Mandarin", "Portuguese", "French", "Arabic", "Vietnamese",
             "Tagalog", "Korean", "Russian", "Haitian Creole", "Polish", "German"]

# First and Last names for mock interpreters
FIRST_NAMES = ["Maria", "John", "Wei", "Ana", "Mohammed", "Elena", "Carlos", "Linh",
               "Jose", "Fatima", "Chen", "Isabella", "Miguel", "Yuki", "Hassan",
               "Sofia", "Diego", "Aisha", "Luis", "Mei", "Omar", "Carmen", "Ahmed",
               "Rosa", "Javier"]

LAST_NAMES = ["Garcia", "Smith", "Wang", "Rodriguez", "Ali", "Martinez", "Chen",
              "Nguyen", "Lopez", "Hassan", "Kim", "Santos", "Lee", "Kumar",
              "Mohammed", "Fernandez", "Patel", "Silva", "Gonzalez", "Ahmad",
              "Torres", "Hernandez", "Cohen", "Perez", "Yamamoto"]

def create_client_rates():
    """Create rates for all 3 clients"""
    print("Creating client rates...")

    rates_data = [
        # Cloudbreak rates
        {"clientId": "cloudbreak", "language": "Spanish", "serviceLocation": "On-site", "ratePerMinute": 1.75, "rateType": "minute"},
        {"clientId": "cloudbreak", "language": "Spanish", "serviceLocation": "Remote", "ratePerMinute": 1.50, "rateType": "minute"},
        {"clientId": "cloudbreak", "language": "Mandarin", "serviceLocation": "On-site", "ratePerMinute": 2.25, "rateType": "minute"},
        {"clientId": "cloudbreak", "language": "Mandarin", "serviceLocation": "Remote", "ratePerMinute": 2.00, "rateType": "minute"},
        {"clientId": "cloudbreak", "language": "Portuguese", "serviceLocation": "On-site", "ratePerMinute": 2.50, "rateType": "minute"},
        {"clientId": "cloudbreak", "language": "Portuguese", "serviceLocation": "Remote", "ratePerMinute": 2.00, "rateType": "minute"},
        {"clientId": "cloudbreak", "language": "French", "serviceLocation": "On-site", "ratePerMinute": 1.90, "rateType": "minute"},
        {"clientId": "cloudbreak", "language": "Arabic", "serviceLocation": "On-site", "ratePerMinute": 2.10, "rateType": "minute"},
        {"clientId": "cloudbreak", "language": "Vietnamese", "serviceLocation": "Remote", "ratePerMinute": 1.80, "rateType": "minute"},

        # Languagelink rates
        {"clientId": "languagelink", "language": "Spanish", "serviceLocation": "On-site", "ratePerMinute": 1.85, "rateType": "minute"},
        {"clientId": "languagelink", "language": "Spanish", "serviceLocation": "Remote", "ratePerMinute": 1.60, "rateType": "minute"},
        {"clientId": "languagelink", "language": "Mandarin", "serviceLocation": "On-site", "ratePerMinute": 2.35, "rateType": "minute"},
        {"clientId": "languagelink", "language": "Mandarin", "serviceLocation": "Remote", "ratePerMinute": 2.10, "rateType": "minute"},
        {"clientId": "languagelink", "language": "Tagalog", "serviceLocation": "On-site", "ratePerMinute": 1.95, "rateType": "minute"},
        {"clientId": "languagelink", "language": "Korean", "serviceLocation": "Remote", "ratePerMinute": 2.00, "rateType": "minute"},
        {"clientId": "languagelink", "language": "Russian", "serviceLocation": "On-site", "ratePerMinute": 2.20, "rateType": "minute"},
        {"clientId": "languagelink", "language": "Arabic", "serviceLocation": "Remote", "ratePerMinute": 1.95, "rateType": "minute"},

        # Propio rates
        {"clientId": "propio", "language": "Spanish", "serviceLocation": "On-site", "ratePerMinute": 1.70, "rateType": "minute"},
        {"clientId": "propio", "language": "Spanish", "serviceLocation": "Remote", "ratePerMinute": 1.45, "rateType": "minute"},
        {"clientId": "propio", "language": "Portuguese", "serviceLocation": "On-site", "ratePerMinute": 2.30, "rateType": "minute"},
        {"clientId": "propio", "language": "Portuguese", "serviceLocation": "Remote", "ratePerMinute": 1.90, "rateType": "minute"},
        {"clientId": "propio", "language": "Haitian Creole", "serviceLocation": "On-site", "ratePerMinute": 2.00, "rateType": "minute"},
        {"clientId": "propio", "language": "Polish", "serviceLocation": "Remote", "ratePerMinute": 1.85, "rateType": "minute"},
        {"clientId": "propio", "language": "French", "serviceLocation": "On-site", "ratePerMinute": 1.95, "rateType": "minute"},
        {"clientId": "propio", "language": "German", "serviceLocation": "Remote", "ratePerMinute": 2.05, "rateType": "minute"},
    ]

    for rate in rates_data:
        try:
            response = requests.post(f"{API_URL}/api/client-rates", json=rate)
            if response.status_code == 200:
                print(f"  ✓ Created rate: {rate['language']} ({rate['serviceLocation']}) for {rate['clientId']}")
            else:
                print(f"  ✗ Failed to create rate: {response.text}")
        except Exception as e:
            print(f"  ✗ Error: {e}")

def create_interpreters():
    """Create 25 mock interpreters"""
    print("\nCreating interpreters...")

    interpreters = []
    for i in range(25):
        first_name = FIRST_NAMES[i]
        last_name = LAST_NAMES[i]
        language = random.choice(LANGUAGES)
        service_location = random.choice(["On-site", "Remote", "Both"])

        interpreter = {
            "contact_name": f"{first_name} {last_name}",
            "email": f"{first_name.lower()}.{last_name.lower()}@example.com",
            "employee_id": f"EMP{1000 + i}",
            "cloudbreak_id": f"CB{2000 + i}" if random.random() > 0.3 else "",
            "languagelink_id": f"LL{3000 + i}" if random.random() > 0.3 else "",
            "propio_id": f"PR{4000 + i}" if random.random() > 0.3 else "",
            "language": language,
            "service_location": service_location,
            "rate_per_minute": str(round(random.uniform(1.00, 1.75), 2)),
            "rate_per_hour": str(round(random.uniform(60, 105), 2)),
            "payment_frequency": random.choice(["Weekly", "Bi-weekly", "Monthly"]),
        }

        try:
            response = requests.post(f"{API_URL}/api/interpreters", json=interpreter)
            if response.status_code == 200:
                interpreters.append(response.json())
                print(f"  ✓ Created interpreter: {interpreter['contact_name']} ({language})")
            else:
                print(f"  ✗ Failed to create interpreter: {response.text}")
        except Exception as e:
            print(f"  ✗ Error: {e}")

    return interpreters

def create_payments(interpreters):
    """Create ~50 payment records for each client"""
    print("\nCreating payment records...")

    clients = ["cloudbreak", "languagelink", "propio"]
    periods = ["2025-01", "2025-02", "2025-03"]

    total_created = 0

    for client_id in clients:
        print(f"\n  Creating payments for {client_id}...")

        for _ in range(50):
            # Pick random interpreter
            interpreter = random.choice(interpreters)

            # Pick random period
            period = random.choice(periods)

            # Generate random call data
            minutes = round(random.uniform(15, 180), 2)
            hours = round(minutes / 60, 2)

            # Get client rate (simplified - just use a random rate)
            client_rate_per_min = round(random.uniform(1.50, 2.50), 2)
            client_charge = round(minutes * client_rate_per_min, 2)

            # Get interpreter rate
            interpreter_rate = float(interpreter.get('ratePerMinute', '1.25'))
            interpreter_payment = round(minutes * interpreter_rate, 2)

            # Calculate profit
            profit = round(client_charge - interpreter_payment, 2)
            profit_margin = round((profit / client_charge * 100) if client_charge > 0 else 0, 2)

            # Determine match status
            has_client_id = False
            if client_id == "cloudbreak" and interpreter.get('cloudbreakId'):
                has_client_id = True
                client_interpreter_id = interpreter['cloudbreakId']
            elif client_id == "languagelink" and interpreter.get('languagelinkId'):
                has_client_id = True
                client_interpreter_id = interpreter['languagelinkId']
            elif client_id == "propio" and interpreter.get('propioId'):
                has_client_id = True
                client_interpreter_id = interpreter['propioId']
            else:
                client_interpreter_id = f"UNK{random.randint(1000, 9999)}"

            match_status = "matched" if has_client_id else "unmatched"

            payment = {
                "client_id": client_id,
                "interpreter_id": interpreter['id'] if has_client_id else None,
                "client_interpreter_id": client_interpreter_id,
                "interpreter_name": interpreter['contactName'],
                "internal_interpreter_name": interpreter['contactName'],
                "language_pair": interpreter.get('language', 'Unknown'),
                "period": period,
                "client_rate": client_rate_per_min,
                "minutes": minutes,
                "hours": hours,
                "client_charge": client_charge,
                "interpreter_payment": interpreter_payment,
                "profit": profit,
                "profit_margin": profit_margin,
                "status": random.choice(["pending", "pending", "approved"]),  # More pendings
                "match_status": match_status,
                "adjustment": 0,
                "notes": ""
            }

            try:
                response = requests.post(f"{API_URL}/api/payments", json=payment)
                if response.status_code == 200:
                    total_created += 1
                    if total_created % 10 == 0:
                        print(f"    Created {total_created} payments...")
                else:
                    print(f"    ✗ Failed: {response.text}")
            except Exception as e:
                print(f"    ✗ Error: {e}")

    print(f"\n✓ Total payments created: {total_created}")

def main():
    print("=" * 60)
    print("SEEDING DATABASE WITH MOCK DATA")
    print("=" * 60)

    create_client_rates()
    interpreters = create_interpreters()

    if interpreters:
        create_payments(interpreters)

    print("\n" + "=" * 60)
    print("SEEDING COMPLETE!")
    print("=" * 60)
    print(f"\n✓ Client Rates: ~25")
    print(f"✓ Interpreters: {len(interpreters)}")
    print(f"✓ Payments: ~150 (50 per client)")
    print("\nYou can now test the application at http://localhost:3000")

if __name__ == "__main__":
    main()
