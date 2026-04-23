from fastapi import FastAPI, APIRouter
from starlette.middleware.cors import CORSMiddleware
import os
import logging
from pathlib import Path
from dotenv import load_dotenv
from database import client

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

app = FastAPI()
api_router = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')

# ─── Import and include all route modules ───
from routes.auth import router as auth_router
from routes.chat import router as chat_router
from routes.journal import router as journal_router
from routes.calendar import router as calendar_router
from routes.mood import router as mood_router
from routes.subscription import router as subscription_router
from routes.referral import router as referral_router
from routes.admin import router as admin_router
from routes.profile import router as profile_router
from routes.calm_corner import router as calm_corner_router

api_router.include_router(auth_router)
api_router.include_router(chat_router)
api_router.include_router(journal_router)
api_router.include_router(calendar_router)
api_router.include_router(mood_router)
api_router.include_router(subscription_router)
api_router.include_router(referral_router)
api_router.include_router(admin_router)
api_router.include_router(profile_router)
api_router.include_router(calm_corner_router)


# ─── Health Check ───
@api_router.get("/health")
async def health_check():
    return {"status": "healthy", "app": "HEARD", "version": "1.0.0"}


# Include router and middleware
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
