#!/usr/bin/env python3
"""
Restore the three main clients
"""
import requests
import json

clients_to_create = [
    {
        "name": "Cloudbreak",
        "id_field": "cloudbreakId",
        "email": "info@cloudbreak.com",
        "currency": "USD",
        "address": ""
    },
    {
        "name": "Languagelink",
        "id_field": "languagelinkId",
        "email": "info@languagelink.com",
        "currency": "USD",
        "address": ""
    },
    {
        "name": "Propio",
        "id_field": "propioId",
        "email": "info@propio.com",
        "currency": "USD",
        "address": ""
    }
]

print("Recreating clients...\n")

for client_data in clients_to_create:
    try:
        response = requests.post(
            "http://localhost:8000/api/clients",
            headers={"Content-Type": "application/json"},
            json=client_data
        )

        if response.status_code == 200:
            result = response.json()
            print(f"✅ Created: {client_data['name']}")
            print(f"   ID: {result.get('id')}")
        else:
            print(f"❌ Failed to create {client_data['name']}: {response.status_code}")
            print(f"   Response: {response.text}")
    except Exception as e:
        print(f"❌ Error creating {client_data['name']}: {e}")

    print()

print("Done!")
