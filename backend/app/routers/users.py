"""User management router."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException

from app.core.security import hash_password
from app.db import store
from app.db.models import UserCreate, UserOut
from app.routers.auth import get_current_user, require_roles

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/me", response_model=UserOut)
def me(user: dict = Depends(get_current_user)):
    return UserOut(id=user["id"], username=user["username"],
                   role=user["role"], display_name=user["display_name"])


@router.get("", response_model=list[UserOut])
def list_users(user: dict = Depends(get_current_user)):
    return [UserOut(id=u["id"], username=u["username"],
                    role=u["role"], display_name=u["display_name"])
            for u in store.get_all_users()]


@router.post("", response_model=UserOut)
def create_user(body: UserCreate, user: dict = Depends(require_roles("admin"))):
    if store.get_user_by_username(body.username):
        raise HTTPException(status_code=400, detail="用户名已存在")
    uid = uuid.uuid4().hex[:12]
    new_user = {
        "id": uid,
        "username": body.username,
        "hashed_password": hash_password(body.password),
        "role": body.role.value,
        "display_name": body.display_name or body.username,
    }
    store.create_user(new_user)
    return UserOut(id=uid, username=body.username,
                   role=body.role, display_name=new_user["display_name"])
