from fastapi import APIRouter
from routes._calm_data import CALM_CORNER_ACTIVITIES, CALM_CATEGORIES

router = APIRouter()


@router.get("/calm-corner/activities")
async def get_calm_activities():
    return {"activities": CALM_CORNER_ACTIVITIES, "categories": CALM_CATEGORIES}
