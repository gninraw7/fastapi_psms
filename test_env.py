from dotenv import load_dotenv
import os

load_dotenv()

print("=" * 50)
print("Environment Variables Test")
print("=" * 50)
print(f"DB_HOST: {os.getenv('DB_HOST')}")
print(f"DB_PORT: {os.getenv('DB_PORT')}")
print(f"DB_USER: {os.getenv('DB_USER')}")
print(f"DB_NAME: {os.getenv('DB_NAME')}")
print(f"DB_SSL_DISABLED: {os.getenv('DB_SSL_DISABLED')}")
print("=" * 50)
