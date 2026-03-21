import requests
import os

BACKBOARD_API_KEY = os.getenv("BACKBOARD_API_KEY")
url = "https://app.backboard.io/api/models"
headers = {
 "X-API-Key": BACKBOARD_API_KEY
}

def get_model_list(skip=0, limit=1):
    data = {
        "skip": skip,
        "limit": limit
    }
    response = requests.get(url, headers=headers, params=data)
    return response.json()

import csv
csv_file = "model_list.csv"
skip = 0
limit = 100
data = get_model_list(skip=skip, limit=limit)
while data["models"]:
    with open(csv_file, "a") as file:
        writer = csv.DictWriter(file, fieldnames=data["models"][0].keys())
        writer.writeheader()
        writer.writerows(data["models"])
    skip += limit
    data = get_model_list(skip=skip, limit=limit)