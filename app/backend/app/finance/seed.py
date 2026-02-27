"""Finance module data seeding."""

import uuid
from datetime import date
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.finance.models import Account, FiscalYear, TaxRate

async def seed_chart_of_accounts(session: AsyncSession, tenant_id: uuid.UUID) -> dict[str, Account]:
    """Seed the default Indian GAAP Chart of Accounts for a new tenant."""
    
    accounts_map = {}
    
    # helper for clean insertions
    def add_acc(code: str, name: str, atype: str, is_group: bool, parent_code: str | None = None) -> None:
        parent_id = accounts_map[parent_code].id if parent_code else None
        
        acc = Account(
            tenant_id=tenant_id,
            account_code=code,
            name=name,
            account_type=atype,
            parent_id=parent_id,
            is_group=is_group,
            currency_code="INR",
            is_active=True
        )
        session.add(acc)
        accounts_map[code] = acc
        
    # Standard 5-group CoA
    add_acc("1000", "Assets", "asset", True)
    add_acc("1100", "Current Assets", "asset", True, "1000")
    add_acc("1110", "Cash and Cash Equivalents", "asset", False, "1100")
    add_acc("1120", "Accounts Receivable", "asset", False, "1100")
    add_acc("1130", "Inventory", "asset", False, "1100")
    add_acc("1140", "Input Tax Credit - CGST", "asset", False, "1100")
    add_acc("1141", "Input Tax Credit - SGST", "asset", False, "1100")
    add_acc("1142", "Input Tax Credit - IGST", "asset", False, "1100")
    
    add_acc("1200", "Fixed Assets", "asset", True, "1000")
    add_acc("1210", "Plant & Machinery", "asset", False, "1200")
    add_acc("1220", "Accumulated Depreciation", "asset", False, "1200")
    
    add_acc("2000", "Liabilities", "liability", True)
    add_acc("2100", "Current Liabilities", "liability", True, "2000")
    add_acc("2110", "Accounts Payable", "liability", False, "2100")
    add_acc("2120", "Output Tax Payable - CGST", "liability", False, "2100")
    add_acc("2121", "Output Tax Payable - SGST", "liability", False, "2100")
    add_acc("2122", "Output Tax Payable - IGST", "liability", False, "2100")
    add_acc("2130", "TDS Payable", "liability", False, "2100")
    
    add_acc("2200", "Long-term Liabilities", "liability", True, "2000")
    add_acc("2210", "Bank Loans", "liability", False, "2200")
    
    add_acc("3000", "Equity", "equity", True)
    add_acc("3100", "Owner's Capital", "equity", False, "3000")
    add_acc("3200", "Retained Earnings", "equity", False, "3000")
    
    add_acc("4000", "Revenue", "revenue", True)
    add_acc("4100", "Sales Revenue", "revenue", False, "4000")
    add_acc("4200", "Other Income", "revenue", False, "4000")
    
    add_acc("5000", "Expenses", "expense", True)
    add_acc("5100", "Cost of Goods Sold", "expense", False, "5000")
    add_acc("5200", "Operating Expenses", "expense", True, "5000")
    add_acc("5210", "Salaries and Wages", "expense", False, "5200")
    add_acc("5220", "Rent", "expense", False, "5200")
    add_acc("5230", "Utilities", "expense", False, "5200")
    add_acc("5240", "Marketing Expenses", "expense", False, "5200")
    
    add_acc("5300", "Financial Expenses", "expense", True, "5000")
    add_acc("5310", "Bank Charges", "expense", False, "5300")
    add_acc("5320", "Interest Expense", "expense", False, "5300")
    
    # We yield control or await flush only once
    await session.flush()
    return accounts_map


async def seed_gst_tax_rates(session: AsyncSession, tenant_id: uuid.UUID, accounts_map: dict[str, Account]) -> None:
    """Seed default Indian GST Tax Rates."""
    
    cgst_payable = accounts_map.get("2120")
    sgst_payable = accounts_map.get("2121")
    igst_payable = accounts_map.get("2122")

    cgst_input = accounts_map.get("1140")
    sgst_input = accounts_map.get("1141")
    igst_input = accounts_map.get("1142")

    if not all([cgst_payable, sgst_payable, igst_payable, cgst_input, sgst_input, igst_input]):
        return # Missing accounts, skip
        
    def add_rate(name: str, tax_type: str, rate: float, is_sales: bool) -> None:
        if tax_type == "CGST":
            linked = cgst_payable if is_sales else cgst_input
        elif tax_type == "SGST":
            linked = sgst_payable if is_sales else sgst_input
        elif tax_type == "IGST":
            linked = igst_payable if is_sales else igst_input
        else:
            return
            
        tr = TaxRate(
            tenant_id=tenant_id,
            name=name,
            tax_type=tax_type,
            rate=rate,
            linked_account_id=linked.id,
            is_active=True
        )
        session.add(tr)
        
    rates = [
        (0.00, "0"),
        (0.05, "5"),
        (0.12, "12"),
        (0.18, "18"),
        (0.28, "28"),
    ]
    
    for r, name in rates:
        half_rate = r / 2
        # Sales Output taxes
        add_rate(f"Output CGST {name}%", "CGST", half_rate, True)
        add_rate(f"Output SGST {name}%", "SGST", half_rate, True)
        add_rate(f"Output IGST {name}%", "IGST", r, True)
        
        # Purchase Input taxes
        add_rate(f"Input CGST {name}%", "CGST", half_rate, False)
        add_rate(f"Input SGST {name}%", "SGST", half_rate, False)
        add_rate(f"Input IGST {name}%", "IGST", r, False)
        
    await session.flush()


async def seed_initial_fiscal_year(session: AsyncSession, tenant_id: uuid.UUID) -> FiscalYear:
    """Create the current Indian financial year."""
    today = date.today()
    if today.month < 4:
        # Before April, the financial year started last year
        start_year = today.year - 1
    else:
        # After April, the financial year started this year
        start_year = today.year
        
    start_date = date(start_year, 4, 1)
    end_date = date(start_year + 1, 3, 31)
    
    fy = FiscalYear(
        tenant_id=tenant_id,
        name=f"FY{start_year}-{start_year+1}",
        start_date=start_date,
        end_date=end_date,
        status="open"
    )
    session.add(fy)
    await session.flush()
    return fy
