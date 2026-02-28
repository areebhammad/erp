"""PDF generation logic for invoices."""

import os
from jinja2 import Environment, FileSystemLoader
import weasyprint
from app.invoices.schemas import InvoiceResponse

TEMPLATES_DIR = os.path.join(os.path.dirname(__file__), "templates")

def render_invoice_pdf(invoice: InvoiceResponse, tenant_name: str) -> bytes:
    """Render an invoice to a PDF byte string."""
    env = Environment(loader=FileSystemLoader(TEMPLATES_DIR))
    template = env.get_template("invoice.html")
    
    html_out = template.render(
        invoice=invoice,
        tenant_name=tenant_name
    )
    
    pdf_bytes = weasyprint.HTML(string=html_out).write_pdf()
    return pdf_bytes
