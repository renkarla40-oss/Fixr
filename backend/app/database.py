import os
import logging
from pathlib import Path
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

ROOT_DIR = Path(__file__).parent.parent  # backend/app -> backend
load_dotenv(ROOT_DIR / '.env')

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

UPLOADS_DIR = ROOT_DIR / 'uploads'
UPLOADS_DIR.mkdir(exist_ok=True)
(UPLOADS_DIR / 'profile_photos').mkdir(exist_ok=True)
(UPLOADS_DIR / 'government_ids').mkdir(exist_ok=True)
(UPLOADS_DIR / 'chat_images').mkdir(exist_ok=True)
(UPLOADS_DIR / 'customer_photos').mkdir(exist_ok=True)
