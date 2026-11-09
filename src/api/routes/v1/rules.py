from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from core.security import CurrentUser, RoleCode, require_role
from schemas.rule import RuleOut, RuleUpdate
from services.rules.service import CriticalityUnavailable, RuleNotFound, RuleService

router = APIRouter(prefix="/rules", tags=["rules"])


def get_rule_service(session: Annotated[AsyncSession, Depends(get_db)]) -> RuleService:
    return RuleService(session)


Service = Annotated[RuleService, Depends(get_rule_service)]
# Rule settings belong to the Supervisor (UC-05).
Supervisor = Annotated[CurrentUser, Depends(require_role(RoleCode.SUPERVISOR))]


@router.get("", summary="List the business rules")
async def list_rules(service: Service, _supervisor: Supervisor) -> list[RuleOut]:
    """Every rule with its threshold, unit, criticality and state, sorted by code (BF-13)."""
    return await service.list()


@router.get("/{code}", summary="Get a business rule")
async def get_rule(code: str, service: Service, _supervisor: Supervisor) -> RuleOut:
    rule = await service.get(code)
    if rule is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Rule not found")
    return rule


@router.patch("/{code}", summary="Change the settings of a business rule")
async def update_rule(
    code: str, changes: RuleUpdate, service: Service, supervisor: Supervisor
) -> RuleOut:
    """Change the threshold, the activation or the criticality of a rule (UC-05).

    The change applies at the next evaluation. Alerts already raised keep the threshold
    in force when they were triggered."""
    try:
        return await service.update(code, changes, supervisor.id)
    except RuleNotFound as error:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Rule not found"
        ) from error
    except CriticalityUnavailable as error:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail=f"Criticality {error} is not available",
        ) from error
