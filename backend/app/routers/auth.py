import logging
import re
import secrets
from datetime import datetime, timedelta, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from pydantic import BaseModel, field_validator
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.models.user import User
from app.auth import (
    hash_password,
    verify_password,
    create_access_token,
    require_auth,
    require_admin,
)
from app.services.email_service import send_password_reset_email
from app.utils.rate_limit import limiter

logger = logging.getLogger(__name__)

router = APIRouter()


def _validate_password_strength(v: str) -> str:
    if len(v) < 6:
        raise ValueError("La contraseña debe tener al menos 6 caracteres")
    return v


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


class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


class RoleUpdate(BaseModel):
    role: str


class ForgotPasswordRequest(BaseModel):
    email: str


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str

    @field_validator("new_password")
    @classmethod
    def validate_new_password(cls, v: str) -> str:
        return _validate_password_strength(v)


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
        user=UserResponse(
            id=str(user.id),
            email=user.email,
            display_name=user.display_name,
            role=user.role,
            is_active=user.is_active,
            created_at=user.created_at.isoformat(),
        ),
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
        user=UserResponse(
            id=str(user.id),
            email=user.email,
            display_name=user.display_name,
            role=user.role,
            is_active=user.is_active,
            created_at=user.created_at.isoformat(),
        ),
    )


@router.get("/me", response_model=UserResponse)
async def get_me(user: User = Depends(require_auth)):
    return UserResponse(
        id=str(user.id),
        email=user.email,
        display_name=user.display_name,
        role=user.role,
        is_active=user.is_active,
        created_at=user.created_at.isoformat(),
    )


@router.get("/users", response_model=list[UserResponse])
async def list_users(
    response: Response,
    page: int = 1,
    per_page: int = 20,
    user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    # X-Total-Count (not part of the JSON body) lets the admin UI paginate —
    # same pattern as GET /documents (see documents.py).
    total = await db.scalar(select(func.count()).select_from(User))
    response.headers["X-Total-Count"] = str(total)

    result = await db.execute(
        select(User)
        .order_by(User.created_at.desc())
        .offset((page - 1) * per_page)
        .limit(per_page)
    )
    users = result.scalars().all()
    return [
        UserResponse(
            id=str(u.id),
            email=u.email,
            display_name=u.display_name,
            role=u.role,
            is_active=u.is_active,
            created_at=u.created_at.isoformat(),
        )
        for u in users
    ]


@router.get("/users/stats")
async def get_user_stats(
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    # Separate from the paginated list above so the stats strip reflects
    # ALL users, not just whatever page happens to be loaded client-side.
    result = await db.execute(select(User.role, func.count()).group_by(User.role))
    counts = dict(result.all())
    return {
        "total": sum(counts.values()),
        "admins": counts.get("admin", 0),
        "users": counts.get("user", 0),
    }


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

    if target_user.role == "admin" and data.role != "admin":
        admin_count = await db.scalar(
            select(func.count()).select_from(User).where(User.role == "admin")
        )
        if admin_count <= 1:
            raise HTTPException(
                status_code=400,
                detail="No puedes quitar el rol de admin al único administrador restante",
            )

    target_user.role = data.role
    await db.commit()
    return {"success": True, "user_id": str(user_id), "new_role": data.role}


# ── Password recovery ──

# Generic response for both branches of forgot-password (user found/not found,
# email send succeeded/failed) — never reveals whether an email is registered.
_FORGOT_PASSWORD_GENERIC_MESSAGE = "Si el correo está registrado, te enviamos un enlace para restablecer tu contraseña."


@router.post("/forgot-password")
@limiter.limit("3/hour")
async def forgot_password(
    request: Request, data: ForgotPasswordRequest, db: AsyncSession = Depends(get_db)
):
    email = data.email.strip().lower()
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()

    if user and user.is_active:
        token = secrets.token_urlsafe(32)
        user.password_reset_token = token
        user.password_reset_expires_at = datetime.now(timezone.utc) + timedelta(
            minutes=settings.password_reset_expire_minutes
        )
        await db.commit()

        reset_link = f"{settings.frontend_url}/reset-password?token={token}"
        try:
            await send_password_reset_email(user.email, reset_link)
        except Exception:
            logger.exception("Fallo al enviar correo de recuperación de contraseña a %s", user.email)

    return {"message": _FORGOT_PASSWORD_GENERIC_MESSAGE}


@router.post("/reset-password")
@limiter.limit("10/hour")
async def reset_password(
    request: Request, data: ResetPasswordRequest, db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(User).where(User.password_reset_token == data.token)
    )
    user = result.scalar_one_or_none()

    if (
        not user
        or not user.password_reset_expires_at
        or user.password_reset_expires_at < datetime.now(timezone.utc)
    ):
        raise HTTPException(status_code=400, detail="El enlace es inválido o ha expirado")

    user.password_hash = hash_password(data.new_password)
    user.password_reset_token = None
    user.password_reset_expires_at = None
    await db.commit()

    return {"success": True}
