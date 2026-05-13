from fastapi import APIRouter

from app.api.v1 import (
    auth,
    diagnostic,
    dialogue,
    progress,
    sessions,
    streak,
    tasks,
    theory,
    users,
)


api_router = APIRouter()
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(users.router, prefix="/users", tags=["users"])
api_router.include_router(diagnostic.router, prefix="/diagnostic", tags=["diagnostic"])
api_router.include_router(sessions.router, prefix="/sessions", tags=["sessions"])
api_router.include_router(tasks.router, prefix="/tasks", tags=["tasks"])
api_router.include_router(dialogue.router, prefix="/dialogue", tags=["dialogue"])
api_router.include_router(progress.router, prefix="/progress", tags=["progress"])
api_router.include_router(theory.router, prefix="/theory", tags=["theory"])
api_router.include_router(streak.router, prefix="/streak", tags=["streak"])
