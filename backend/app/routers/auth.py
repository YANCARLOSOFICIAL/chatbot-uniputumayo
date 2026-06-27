import re
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, field_validator
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user import User
from app.auth import (
    hash_password,
    verify_password,
    create_access_token,
    require_auth,
    require_admin,
)
from app.utils.rate_limit import limiter

router = APIRouter()


# ── Schemas ──


class RegisterRequest(BaseModel):
    email: str
    password: str
    display_name: str

    @field_validator("email")
    @classmethod
    def validate_email(cls, v: str) -> str:
        v = v.strip().lower()
        if not re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", v):
            raise ValueError("Formato de email inválido")
        return v

    @field_validator("password")
    @classmethod
    def validate_password(cls, v: str) -> str:
        if len(v) < 6:
            raise ValueError("La contraseña debe tener al menos 6 caracteres")
        return v


class LoginRequest(BaseModel):
    email: str
    password: str


class UserResponse(BaseModel):
    id: str
    email: str | None
    display_name: str | None
    role: str
    is_active: bool
    created_at: str

    model_config = {"from_attributes": True}

    @classmethod
    def from_model(cls, user: "User") -> "UserResponse":
        return cls(
            id=str(user.id),
            email=user.email,
            display_name=user.display_name,
            role=user.role,
            is_active=user.is_active,
            created_at=user.created_at.isoformat(),
        )


class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


class RoleUpdate(BaseModel):
    role: str


# ── Endpoints ──


@router.post("/register", response_model=AuthResponse)
@limiter.limit("5/hour")
async def register(request: Request, data: RegisterRequest, db: AsyncSession = Depends(get_db)):
    # Check if email already exists
    result = await db.execute(select(User).where(User.email == data.email))
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Ya existe un usuario con este email",
        )

    user = User(
        email=data.email,
        display_name=data.display_name,
        password_hash=hash_password(data.password),
        role="user",
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)

    token = create_access_token(str(user.id), user.role)
    return AuthResponse(
        access_token=token,
        user=UserResponse.from_model(user),
    )


@router.post("/login", response_model=AuthResponse)
@limiter.limit("10/5minutes")
async def login(request: Request, data: LoginRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == data.email))
    user = result.scalar_one_or_none()

    if not user or not user.password_hash or not verify_password(data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email o contraseña incorrectos",
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Usuario desactivado",
        )

    token = create_access_token(str(user.id), user.role)
    return AuthResponse(
        access_token=token,
        user=UserResponse.from_model(user),
    )


@router.get("/me", response_model=UserResponse)
async def get_me(user: User = Depends(require_auth)):
    return UserResponse.from_model(user)


@router.get("/users", response_model=list[UserResponse])
async def list_users(
    user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(User).order_by(User.created_at.desc()))
    users = result.scalars().all()
    return [UserResponse.from_model(u) for u in users]


@router.put("/users/{user_id}/role")
async def update_user_role(
    user_id: UUID,
    data: RoleUpdate,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    if data.role not in ("user", "admin"):
        raise HTTPException(status_code=400, detail="Rol inválido. Usa 'user' o 'admin'")

    if user_id == admin.id:
        raise HTTPException(status_code=400, detail="No puedes modificar tu propio rol")

    result = await db.execute(select(User).where(User.id == user_id))
    target_user = result.scalar_one_or_none()
    if not target_user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    target_user.role = data.role
    await db.commit()
    return {"success": True, "user_id": str(user_id), "new_role": data.role}
