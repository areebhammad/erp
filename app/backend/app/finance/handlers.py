"""Finance module event handlers."""

import logging
from uuid import UUID

from app.core.database import get_db_context
from app.core.events import TenantProvisionedEvent, event_bus
from app.finance.seed import seed_chart_of_accounts, seed_gst_tax_rates, seed_initial_fiscal_year

logger = logging.getLogger(__name__)


@event_bus.subscribe(TenantProvisionedEvent.model_fields["event_type"].default)
async def handle_tenant_provisioned(event: TenantProvisionedEvent) -> None:
    """Handle tenant provisioning event to seed finance module data."""
    tenant_id = event.tenant_id
    logger.info(f"Seeding finance data for provisioned tenant {tenant_id}")

    try:
        async with get_db_context() as session:
            # Seed Fiscal Year
            await seed_initial_fiscal_year(session, tenant_id)
            
            # Seed Chart of Accounts
            accounts_map = await seed_chart_of_accounts(session, tenant_id)
            
            # Seed GST Rates
            await seed_gst_tax_rates(session, tenant_id, accounts_map)

            logger.info(f"Successfully seeded finance data for tenant {tenant_id}")
    except Exception as e:
        # We must not crash the event bus or fail provisioning logic 
        # completely if finance seeding fails
        logger.error(f"Failed to seed finance data for tenant {tenant_id}: {e}")
