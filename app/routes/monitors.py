"""Monitor routes: create, list, delete monthly domain monitors."""

from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel

from app.services.user_service import find_user_by_token
from app.services.monitor_service import (
    create_monitor,
    list_monitors,
    delete_monitor,
)

router = APIRouter()


class MonitorCreate(BaseModel):
    domain: str
    notify_email: str
    track_new_competitors: bool = True


@router.post("/api/monitors", status_code=201)
async def create_monitor_route(body: MonitorCreate, x_user_token: str = Header(None)):
    if not x_user_token:
        raise HTTPException(status_code=401, detail="Authentication required")

    user = await find_user_by_token(x_user_token)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid token")

    if user.get("plan", "free") == "free":
        raise HTTPException(status_code=403, detail="Monthly monitors require a Pro plan")

    monitor = await create_monitor(
        user_id=user["user_id"],
        domain=body.domain,
        notify_email=body.notify_email,
        track_new_competitors=body.track_new_competitors,
    )
    return monitor


@router.get("/api/monitors")
async def list_monitors_route(x_user_token: str = Header(None)):
    if not x_user_token:
        raise HTTPException(status_code=401, detail="Authentication required")

    user = await find_user_by_token(x_user_token)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid token")

    monitors = await list_monitors(user["user_id"])
    # Strip internal _memory_id before returning
    for m in monitors:
        m.pop("_memory_id", None)
    return {"monitors": monitors}


@router.delete("/api/monitors/{monitor_id}", status_code=204)
async def delete_monitor_route(monitor_id: str, x_user_token: str = Header(None)):
    if not x_user_token:
        raise HTTPException(status_code=401, detail="Authentication required")

    user = await find_user_by_token(x_user_token)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid token")

    deleted = await delete_monitor(monitor_id, user["user_id"])
    if not deleted:
        raise HTTPException(status_code=404, detail="Monitor not found")
