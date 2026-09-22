import os
import sys
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.lib.units import inch
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, KeepTogether, HRFlowable
)
from reportlab.pdfgen import canvas

# Define Professional Corporate Palette
NAVY_DARK = colors.HexColor('#0f172a')      # Slate 900
NAVY_LIGHT = colors.HexColor('#1e293b')     # Slate 800
PRIMARY_BLUE = colors.HexColor('#1d4ed8')   # Blue 700
ACCENT_BLUE = colors.HexColor('#2563eb')    # Blue 600
ACCENT_CYAN = colors.HexColor('#0284c7')    # Sky 600
SUCCESS_GREEN = colors.HexColor('#047857')  # Emerald 700
WARNING_AMBER = colors.HexColor('#b45309')  # Amber 700
DANGER_RED = colors.HexColor('#b91c1c')     # Red 700
BG_LIGHT = colors.HexColor('#f8fafc')       # Slate 50
BG_CARD = colors.HexColor('#f1f5f9')        # Slate 100
BORDER_COLOR = colors.HexColor('#cbd5e1')   # Slate 300
BORDER_LIGHT = colors.HexColor('#e2e8f0')   # Slate 200
TEXT_DARK = colors.HexColor('#0f172a')
TEXT_MUTED = colors.HexColor('#475569')
WHITE = colors.HexColor('#ffffff')

class NumberedCanvas(canvas.Canvas):
    def __init__(self, *args, **kwargs):
        super(NumberedCanvas, self).__init__(*args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            if self._pageNumber > 1:
                self.draw_header_footer(num_pages)
            canvas.Canvas.showPage(self)
        canvas.Canvas.save(self)

    def draw_header_footer(self, page_count):
        self.saveState()
        self.setFont("Helvetica-Bold", 8)
        self.setFillColor(TEXT_MUTED)
        
        # Header (Top of Page)
        self.drawString(54, 11 * inch - 36, "HYBRID NETWORKS PORTAL")
        self.setFont("Helvetica", 8)
        self.drawRightString(8.5 * inch - 54, 11 * inch - 36, "System Architecture & Feature Documentation v2.0")
        
        self.setStrokeColor(BORDER_COLOR)
        self.setLineWidth(0.5)
        self.line(54, 11 * inch - 42, 8.5 * inch - 54, 11 * inch - 42)
        
        # Footer (Bottom of Page)
        self.setStrokeColor(BORDER_COLOR)
        self.setLineWidth(0.5)
        self.line(54, 46, 8.5 * inch - 54, 46)
        
        self.setFont("Helvetica", 8)
        self.drawString(54, 32, "Confidential — For Hybrid Networks & Authorized Enterprise Clients")
        self.drawRightString(8.5 * inch - 54, 32, f"Page {self._pageNumber} of {page_count}")
        self.restoreState()

def create_documentation_pdf(output_path):
    doc = SimpleDocTemplate(
        output_path,
        pagesize=letter,
        leftMargin=54,
        rightMargin=54,
        topMargin=54,
        bottomMargin=54
    )

    styles = getSampleStyleSheet()

    # Typography Styles
    title_style = ParagraphStyle(
        'DocTitle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=23,
        leading=27,
        textColor=NAVY_DARK,
        spaceAfter=6
    )

    subtitle_style = ParagraphStyle(
        'DocSubTitle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=11,
        leading=15,
        textColor=PRIMARY_BLUE,
        spaceAfter=12
    )

    h1_style = ParagraphStyle(
        'SectionH1',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=13,
        leading=17,
        textColor=NAVY_DARK,
        spaceBefore=10,
        spaceAfter=5,
        keepWithNext=True
    )

    h2_style = ParagraphStyle(
        'SectionH2',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=10,
        leading=14,
        textColor=PRIMARY_BLUE,
        spaceBefore=7,
        spaceAfter=3,
        keepWithNext=True
    )

    body_style = ParagraphStyle(
        'BodyDark',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=8.5,
        leading=12,
        textColor=TEXT_DARK,
        spaceAfter=4
    )

    body_bold = ParagraphStyle(
        'BodyDarkBold',
        parent=body_style,
        fontName='Helvetica-Bold'
    )

    bullet_style = ParagraphStyle(
        'BulletItem',
        parent=body_style,
        leftIndent=12,
        firstLineIndent=-8,
        spaceAfter=3
    )

    table_header = ParagraphStyle(
        'TableHeader',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=8,
        leading=10,
        textColor=WHITE,
        alignment=0
    )

    table_cell = ParagraphStyle(
        'TableCell',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=7.5,
        leading=10,
        textColor=TEXT_DARK
    )

    table_cell_bold = ParagraphStyle(
        'TableCellBold',
        parent=table_cell,
        fontName='Helvetica-Bold'
    )

    callout_text = ParagraphStyle(
        'CalloutText',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=8,
        leading=11.5,
        textColor=TEXT_DARK
    )

    flow_step_title = ParagraphStyle(
        'FlowStepTitle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=8,
        leading=10,
        textColor=PRIMARY_BLUE
    )

    flow_step_body = ParagraphStyle(
        'FlowStepBody',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=7.5,
        leading=10,
        textColor=TEXT_DARK
    )

    story = []

    def make_callout(title, text, bg=BG_CARD, border_color=PRIMARY_BLUE):
        content = [
            [Paragraph(f"<b>{title}</b>", ParagraphStyle('CT', parent=callout_text, fontName='Helvetica-Bold', textColor=border_color))],
            [Paragraph(text, callout_text)]
        ]
        t = Table(content, colWidths=[504])
        t.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), bg),
            ('BOX', (0, 0), (-1, -1), 0.5, BORDER_LIGHT),
            ('LINEBEFORE', (0, 0), (0, -1), 3.5, border_color),
            ('TOPPADDING', (0, 0), (-1, -1), 5),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
            ('LEFTPADDING', (0, 0), (-1, -1), 8),
            ('RIGHTPADDING', (0, 0), (-1, -1), 8),
        ]))
        return t

    # Helper badges
    badge_yes = "<font color='#047857'><b>[YES] Full Access</b></font>"
    badge_no = "<font color='#b91c1c'><b>[NO] Forbidden</b></font>"
    badge_staff_only = "<font color='#b45309'><b>Staff Boundary</b></font>"
    badge_own_only = "<font color='#1d4ed8'><b>Own Data Only</b></font>"
    badge_ready = "<font color='#047857'><b>● Production Ready</b></font>"

    # ==========================================
    # 1. COVER PAGE / EXECUTIVE HEADER
    # ==========================================
    story.append(Spacer(1, 10))
    brand_table = Table([[
        Paragraph("<b>HYBRID NETWORKS</b>", ParagraphStyle('HNB', fontName='Helvetica-Bold', fontSize=18, textColor=WHITE)),
        Paragraph("ENTERPRISE CONNECTIVITY & SATELLITE TELEMETRY PLATFORM", ParagraphStyle('HNS', fontName='Helvetica-Bold', fontSize=7.5, textColor=ACCENT_CYAN, alignment=2))
    ]], colWidths=[270, 234])
    brand_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), NAVY_DARK),
        ('PADDING', (0, 0), (-1, -1), 10),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
    ]))
    story.append(brand_table)
    story.append(Spacer(1, 18))

    story.append(Paragraph("System Architecture & Feature Documentation", title_style))
    story.append(Paragraph("Comprehensive Technical & Operational Reference Manual for Clients & Administrators", subtitle_style))
    story.append(HRFlowable(width="100%", thickness=1.5, color=PRIMARY_BLUE, spaceBefore=0, spaceAfter=12))

    meta_content = [
        [Paragraph("<b>Document Version:</b>", body_style), Paragraph("2.0 (Production Release)", body_style),
         Paragraph("<b>Target Stack:</b>", body_style), Paragraph("Next.js 16 Full-Stack / MongoDB", body_style)],
        [Paragraph("<b>Release Date:</b>", body_style), Paragraph("September 2026", body_style),
         Paragraph("<b>Auth & Security:</b>", body_style), Paragraph("JWT Cookie DAL / Mandatory 1st-Login Gate", body_style)],
        [Paragraph("<b>Platform Scope:</b>", body_style), Paragraph("Admin Portal & Customer Portal", body_style),
         Paragraph("<b>Integrations:</b>", body_style), Paragraph("SLASH Starlink API, Google Maps, SMTP", body_style)],
        [Paragraph("<b>Document Purpose:</b>", body_style), Paragraph("Client Feature Walkthrough & System Guide", body_style),
         Paragraph("<b>Confidentiality:</b>", body_style), Paragraph("Proprietary & Confidential", body_style)]
    ]
    meta_table = Table(meta_content, colWidths=[100, 150, 100, 154])
    meta_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), BG_LIGHT),
        ('BOX', (0, 0), (-1, -1), 0.5, BORDER_COLOR),
        ('INNERGRID', (0, 0), (-1, -1), 0.5, BORDER_LIGHT),
        ('PADDING', (0, 0), (-1, -1), 4.5),
    ]))
    story.append(meta_table)
    story.append(Spacer(1, 12))

    # Executive Summary Box
    exec_summary_text = (
        "The <b>Hybrid Networks Portal</b> is an enterprise-grade web application engineered to solve end-to-end "
        "satellite and telecommunications lifecycle management. It bridges raw wholesale usage feeds (CDRs) "
        "to branded client tax invoices, supports complex multi-account organizational hierarchies under a single "
        "customer login, delivers real-time Starlink satellite telemetry via the SLASH API, provides live GPS fleet "
        "tracking on Google Maps, and enforces strict security with mandatory first-login password rotation."
    )
    story.append(make_callout("EXECUTIVE SUMMARY & SYSTEM SCOPE", exec_summary_text, BG_CARD, PRIMARY_BLUE))
    story.append(Spacer(1, 14))

    # ==========================================
    # TABLE OF CONTENTS
    # ==========================================
    story.append(Paragraph("TABLE OF CONTENTS", h2_style))
    toc_data = [
        [Paragraph("<b>Section</b>", table_header), Paragraph("<b>Title & Core Focus</b>", table_header), Paragraph("<b>Key Modules / Coverage</b>", table_header)],
        [Paragraph("1.0", table_cell_bold), Paragraph("Application Overview", table_cell), Paragraph("Problem domain, business value, user personas", table_cell)],
        [Paragraph("2.0", table_cell_bold), Paragraph("Application Modules", table_cell), Paragraph("Functional architectural breakdown (9 core pillars)", table_cell)],
        [Paragraph("3.0", table_cell_bold), Paragraph("Roles & Permission Matrix", table_cell), Paragraph("SUPER_ADMIN, SUB_ADMIN, CUSTOMER capabilities", table_cell)],
        [Paragraph("4.0", table_cell_bold), Paragraph("Feature Overview", table_cell), Paragraph("Key capabilities & operational highlights", table_cell)],
        [Paragraph("5.0", table_cell_bold), Paragraph("Detailed Feature Documentation", table_cell), Paragraph("11 subfeatures: Auth, CDR, Billing, Fleet, Support, etc.", table_cell)],
        [Paragraph("6.0", table_cell_bold), Paragraph("Main User Workflows", table_cell), Paragraph("Step-by-step logical diagrams & lifecycle flows", table_cell)],
        [Paragraph("7.0", table_cell_bold), Paragraph("Admin Workflow", table_cell), Paragraph("Day-to-day administrative & billing operations", table_cell)],
        [Paragraph("8.0", table_cell_bold), Paragraph("Customer / User Workflow", table_cell), Paragraph("Client onboarding, usage monitoring, and self-service", table_cell)],
        [Paragraph("9.0", table_cell_bold), Paragraph("System Architecture", table_cell), Paragraph("Next.js 16, App Router, DAL, MongoDB, External APIs", table_cell)],
        [Paragraph("10.0", table_cell_bold), Paragraph("Data Flow", table_cell), Paragraph("End-to-end CDR ingestion, telemetry & billing streams", table_cell)],
        [Paragraph("11.0", table_cell_bold), Paragraph("Database & Entity Relationships", table_cell), Paragraph("MongoDB collections, schemas, and relational maps", table_cell)],
        [Paragraph("12.0", table_cell_bold), Paragraph("Authentication & Security Controls", table_cell), Paragraph("Bcrypt, JWT sessions, lockout thresholds, DAL guards", table_cell)],
        [Paragraph("13.0", table_cell_bold), Paragraph("External Integrations", table_cell), Paragraph("SLASH API (Starlink), Google Maps, Nodemailer SMTP", table_cell)],
        [Paragraph("14.0", table_cell_bold), Paragraph("Reports & Data Management", table_cell), Paragraph("Unallocated CDR exports, invoice PDFs, system audits", table_cell)],
        [Paragraph("15.0", table_cell_bold), Paragraph("Implementation Status Matrix", table_cell), Paragraph("Feature-by-feature verification against codebase", table_cell)],
        [Paragraph("16.0", table_cell_bold), Paragraph("Current Limitations", table_cell), Paragraph("Documented boundaries & architecture constraints", table_cell)],
        [Paragraph("17.0", table_cell_bold), Paragraph("Future Improvement Roadmap", table_cell), Paragraph("Planned enhancements & integration expansion", table_cell)],
        [Paragraph("18.0", table_cell_bold), Paragraph("Final Summary & Verification", table_cell), Paragraph("Production readiness assessment & conclusions", table_cell)],
    ]
    t_toc = Table(toc_data, colWidths=[48, 175, 281])
    t_toc.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), NAVY_DARK),
        ('BOX', (0, 0), (-1, -1), 0.5, BORDER_COLOR),
        ('INNERGRID', (0, 0), (-1, -1), 0.5, BORDER_LIGHT),
        ('PADDING', (0, 0), (-1, -1), 3),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [WHITE, BG_LIGHT])
    ]))
    story.append(t_toc)
    story.append(PageBreak())

    # ==========================================
    # 1. APPLICATION OVERVIEW
    # ==========================================
    story.append(Paragraph("1. APPLICATION OVERVIEW", h1_style))
    story.append(HRFlowable(width="100%", thickness=1, color=PRIMARY_BLUE, spaceBefore=0, spaceAfter=8))

    story.append(Paragraph("1.1 What the Application Is", h2_style))
    story.append(Paragraph(
        "The <b>Hybrid Networks Portal</b> is a dedicated web-based software suite built for managing satellite communications, "
        "maritime vessel connectivity, telecommunications usage records (CDRs), and multi-account customer billing. "
        "It provides unified management for network operators and an intuitive self-service portal for corporate end clients.",
        body_style
    ))

    story.append(Paragraph("1.2 The Problem It Solves", h2_style))
    problems = [
        "<b>Automating Complex Wholesale-to-Retail CDR Rating:</b> Satellite networks generate high-volume raw usage files with diverse product codes (voice, SMS, standard data, prioritized data). Hybrid Networks ingests, maps, and applies custom markup formulas automatically.",
        "<b>Multi-Account Consolidation:</b> Corporate customers frequently hold multiple sub-accounts or vessels across different billing codes. The platform aggregates these under a single customer credential with instant multi-account visibility.",
        "<b>Real-Time Satellite Telemetry:</b> Operators and clients can monitor live Starlink satellite terminal metrics (latency, signal drops, download/upload speeds, SNR) without logging into external vendor consoles.",
        "<b>Zero-Loss CDR Reconciliations:</b> Unrecognized customer codes or unmapped product codes are flagged immediately, generating downloadable Unallocated Reports and allowing one-click reprocessing once mappings are added.",
        "<b>Automated Tax-Compliant Invoicing:</b> Calculates recurring plan charges alongside rated CDR usage to generate client-ready PDF invoices formatted with itemized breakdowns and tax amounts."
    ]
    for p in problems:
        story.append(Paragraph(f"• {p}", bullet_style))

    story.append(Spacer(1, 4))
    story.append(Paragraph("1.3 Target Audience & User Personas", h2_style))
    personas_data = [
        [Paragraph("<b>User Persona</b>", table_header), Paragraph("<b>Primary Responsibilities</b>", table_header), Paragraph("<b>Primary System Interactions</b>", table_header)],
        [Paragraph("Super Admin<br/><i>(Executive / Management)</i>", table_cell_bold),
         Paragraph("Full operational oversight, pricing rules, staff management, and system-wide configurations.", table_cell),
         Paragraph("Admin Dashboard, Retail Plans, User Management, Activity Audit Logs, System Settings.", table_cell)],
        [Paragraph("Sub Admin<br/><i>(Billing & Support Staff)</i>", table_cell_bold),
         Paragraph("Customer account creation, CDR upload processing, invoice generation, ticket resolution.", table_cell),
         Paragraph("Customer Management, CDR Ingestion, Invoice Module, Support Desk, Fleet Map.", table_cell)],
        [Paragraph("Customer<br/><i>(Corporate Client / Fleet Mgr)</i>", table_cell_bold),
         Paragraph("Self-service usage tracking across vessels, invoice downloads, support ticket creation.", table_cell),
         Paragraph("Customer Portal Overview, Device Telemetry, Live GPS Map, Invoices, My Tickets.", table_cell)]
    ]
    t_personas = Table(personas_data, colWidths=[115, 195, 194])
    t_personas.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), NAVY_LIGHT),
        ('BOX', (0, 0), (-1, -1), 0.5, BORDER_COLOR),
        ('INNERGRID', (0, 0), (-1, -1), 0.5, BORDER_LIGHT),
        ('PADDING', (0, 0), (-1, -1), 4),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [WHITE, BG_LIGHT])
    ]))
    story.append(t_personas)
    story.append(PageBreak())

    # ==========================================
    # 2. APPLICATION MODULES
    # ==========================================
    story.append(Paragraph("2. APPLICATION MODULES", h1_style))
    story.append(HRFlowable(width="100%", thickness=1, color=PRIMARY_BLUE, spaceBefore=0, spaceAfter=8))
    story.append(Paragraph(
        "The codebase is structured into nine functional pillars, completely isolated by role-based access middleware:",
        body_style
    ))

    modules_data = [
        [Paragraph("<b>Module</b>", table_header), Paragraph("<b>Scope & Route Boundaries</b>", table_header), Paragraph("<b>Key Capabilities</b>", table_header)],
        [Paragraph("1. Authentication & Security", table_cell_bold), Paragraph("<code>/login</code><br/><code>/first-login-change-password</code>", table_cell), Paragraph("Role dispatch, bcrypt hashing, brute-force lockout, mandatory password reset gate.", table_cell)],
        [Paragraph("2. Customer Management", table_cell_bold), Paragraph("<code>/admin/customers</code><br/><code>/admin/customers/[id]</code>", table_cell), Paragraph("Multi-account code linking, Starlink Vessel ID binding, profile lifecycle (Active/Suspended).", table_cell)],
        [Paragraph("3. CDR Ingestion & Rating", table_cell_bold), Paragraph("<code>/admin/cdr-import</code><br/><code>/admin/retail-plans</code>", table_cell), Paragraph("PapaParse CSV parser, fuzzy column detection, markup calculator, unallocated CDR alert.", table_cell)],
        [Paragraph("4. Invoicing & Billing", table_cell_bold), Paragraph("<code>/admin/invoices</code><br/><code>/portal/invoices</code>", table_cell), Paragraph("Automated monthly batch billing, React-PDF renderer, status flow (Draft, Sent, Paid, Void).", table_cell)],
        [Paragraph("5. Fleet & Telemetry", table_cell_bold), Paragraph("<code>/admin/tracking</code><br/><code>/portal/tracking</code>", table_cell), Paragraph("Live SLASH API Starlink metrics (latency, ping drops, SNR), Google Maps GPS markers.", table_cell)],
        [Paragraph("6. Terminal Inventory", table_cell_bold), Paragraph("<code>/admin/terminals</code><br/><code>/portal/overview</code>", table_cell), Paragraph("Hardware inventory, MAC/IP assignments, connection health badges, status overrides.", table_cell)],
        [Paragraph("7. Service Plans Catalog", table_cell_bold), Paragraph("<code>/admin/plans</code>", table_cell), Paragraph("Recurring bandwidth tier configuration, monthly price, data allowances, contention ratio.", table_cell)],
        [Paragraph("8. Support Desk & Tickets", table_cell_bold), Paragraph("<code>/admin/support</code><br/><code>/portal/support</code>", table_cell), Paragraph("Interactive threaded communication, priority queues, status tracking (Open, In Progress, Closed).", table_cell)],
        [Paragraph("9. Settings & Audit Logs", table_cell_bold), Paragraph("<code>/admin/settings</code><br/><code>/admin/activity-logs</code>", table_cell), Paragraph("Company details, SMTP configuration, staff user management, immutable audit trail.", table_cell)]
    ]
    t_mod = Table(modules_data, colWidths=[115, 130, 259])
    t_mod.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), NAVY_DARK),
        ('BOX', (0, 0), (-1, -1), 0.5, BORDER_COLOR),
        ('INNERGRID', (0, 0), (-1, -1), 0.5, BORDER_LIGHT),
        ('PADDING', (0, 0), (-1, -1), 3.5),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [WHITE, BG_LIGHT])
    ]))
    story.append(t_mod)
    story.append(PageBreak())

    # ==========================================
    # 3. USER ROLES & PERMISSION MATRIX
    # ==========================================
    story.append(Paragraph("3. USER ROLES & PERMISSION MATRIX", h1_style))
    story.append(HRFlowable(width="100%", thickness=1, color=PRIMARY_BLUE, spaceBefore=0, spaceAfter=8))
    story.append(Paragraph(
        "Access control is enforced at both the Next.js Middleware edge proxy and in Server Actions via Data Access Layer (DAL) assertions:",
        body_style
    ))

    matrix_data = [
        [Paragraph("<b>System Capability / Feature</b>", table_header),
         Paragraph("<b>SUPER_ADMIN</b>", table_header),
         Paragraph("<b>SUB_ADMIN</b>", table_header),
         Paragraph("<b>CUSTOMER</b>", table_header)],
        [Paragraph("Access Admin Dashboard (<code>/admin/*</code>)", table_cell_bold), Paragraph(badge_yes, table_cell), Paragraph(badge_yes, table_cell), Paragraph(badge_no, table_cell)],
        [Paragraph("Access Customer Portal (<code>/portal/*</code>)", table_cell_bold), Paragraph(badge_staff_only, table_cell), Paragraph(badge_staff_only, table_cell), Paragraph(badge_own_only, table_cell)],
        [Paragraph("Create / Edit / Suspend Customers", table_cell_bold), Paragraph(badge_yes, table_cell), Paragraph(badge_yes, table_cell), Paragraph(badge_no, table_cell)],
        [Paragraph("Assign Multi-Account Codes", table_cell_bold), Paragraph(badge_yes, table_cell), Paragraph(badge_yes, table_cell), Paragraph(badge_no, table_cell)],
        [Paragraph("Upload & Ingest Wholesale CDRs", table_cell_bold), Paragraph(badge_yes, table_cell), Paragraph(badge_yes, table_cell), Paragraph(badge_no, table_cell)],
        [Paragraph("Export Unallocated CDR CSV Reports", table_cell_bold), Paragraph(badge_yes, table_cell), Paragraph(badge_yes, table_cell), Paragraph(badge_no, table_cell)],
        [Paragraph("Configure Retail Plans & Markups", table_cell_bold), Paragraph(badge_yes, table_cell), Paragraph("<font color='#047857'><b>[YES] Edit</b></font>", table_cell), Paragraph(badge_no, table_cell)],
        [Paragraph("Generate & Void Invoices", table_cell_bold), Paragraph(badge_yes, table_cell), Paragraph(badge_yes, table_cell), Paragraph(badge_own_only, table_cell)],
        [Paragraph("Download PDF Invoices", table_cell_bold), Paragraph("<font color='#047857'><b>All Clients</b></font>", table_cell), Paragraph("<font color='#047857'><b>All Clients</b></font>", table_cell), Paragraph(badge_own_only, table_cell)],
        [Paragraph("View Global Fleet GPS Map", table_cell_bold), Paragraph("<font color='#047857'><b>All Vessels</b></font>", table_cell), Paragraph("<font color='#047857'><b>All Vessels</b></font>", table_cell), Paragraph(badge_own_only, table_cell)],
        [Paragraph("Real-Time Starlink Telemetry", table_cell_bold), Paragraph("<font color='#047857'><b>All Vessels</b></font>", table_cell), Paragraph("<font color='#047857'><b>All Vessels</b></font>", table_cell), Paragraph(badge_own_only, table_cell)],
        [Paragraph("Manage Support Desk Tickets", table_cell_bold), Paragraph(badge_yes, table_cell), Paragraph(badge_yes, table_cell), Paragraph(badge_own_only, table_cell)],
        [Paragraph("Manage Staff Users & Roles", table_cell_bold), Paragraph(badge_yes, table_cell), Paragraph("<font color='#b45309'><b>Read Only</b></font>", table_cell), Paragraph(badge_no, table_cell)],
        [Paragraph("Configure SMTP & Company Settings", table_cell_bold), Paragraph(badge_yes, table_cell), Paragraph("<font color='#b45309'><b>Read Only</b></font>", table_cell), Paragraph(badge_no, table_cell)],
        [Paragraph("Inspect System Activity Audit Logs", table_cell_bold), Paragraph(badge_yes, table_cell), Paragraph("<font color='#b45309'><b>Read Only</b></font>", table_cell), Paragraph(badge_no, table_cell)]
    ]
    t_matrix = Table(matrix_data, colWidths=[185, 105, 107, 107])
    t_matrix.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), NAVY_DARK),
        ('BOX', (0, 0), (-1, -1), 0.5, BORDER_COLOR),
        ('INNERGRID', (0, 0), (-1, -1), 0.5, BORDER_LIGHT),
        ('PADDING', (0, 0), (-1, -1), 3),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [WHITE, BG_LIGHT])
    ]))
    story.append(t_matrix)
    story.append(Spacer(1, 10))

    # ==========================================
    # 4. FEATURE OVERVIEW
    # ==========================================
    story.append(Paragraph("4. FEATURE OVERVIEW", h1_style))
    story.append(HRFlowable(width="100%", thickness=1, color=PRIMARY_BLUE, spaceBefore=0, spaceAfter=8))
    story.append(Paragraph(
        "Key operational highlights implemented across the application:",
        body_style
    ))

    feat_highlights = [
        ("Dual Domain Separation", "Distinct portal layouts, navigation trees, and authorization boundaries for Admin and Customer views."),
        ("Multi-Account Hierarchy", "Customers with multiple corporate accounts or vessels see all data combined under a single login without switching sessions."),
        ("First-Login Security Gate", "Enforces password change on initial login before any protected pages can be accessed."),
        ("Fuzzy CDR Header Detection", "PapaParse streaming parser recognizes arbitrary CSV header variations (e.g. 'Customer Code', 'Cust_ID', 'Account #')."),
        ("Dual-Formula Rating Engine", "Supports percentage markups (wholesale cost * (1 + markup%)) and fixed-fee billing models."),
        ("Unallocated CDR Quarantine", "Safeguards against creating fake accounts; unknown codes trigger clear alerts and downloadable CSV reports."),
        ("One-Click CDR Reprocessing", "Allows unallocated records to be rated immediately after missing mappings or accounts are registered."),
        ("React-PDF Invoice Engine", "Generates high-definition PDF invoices dynamically with itemized usage breakdowns and tax details."),
        ("SLASH API Live Telemetry", "Pulls SNR, latency, ping drops, and upload/download speeds for active Starlink terminals."),
        ("Interactive Fleet Tracking", "Google Maps visualization displaying real-time vessel coordinates, headings, and connection health.")
    ]
    for title, desc in feat_highlights:
        story.append(Paragraph(f"• <b>{title}:</b> {desc}", bullet_style))

    story.append(PageBreak())

    # ==========================================
    # 5. DETAILED FEATURE DOCUMENTATION
    # ==========================================
    story.append(Paragraph("5. DETAILED FEATURE DOCUMENTATION", h1_style))
    story.append(HRFlowable(width="100%", thickness=1, color=PRIMARY_BLUE, spaceBefore=0, spaceAfter=8))

    # 5.1 Auth
    story.append(Paragraph("5.1 Authentication & Mandatory First-Login Security Gate", h2_style))
    story.append(Paragraph(
        "<b>Implementation:</b> <code>lib/auth/dal.ts</code>, <code>lib/actions/auth-actions.ts</code>, <code>proxy.ts</code><br/>"
        "<b>Workflow:</b> When an administrator registers a customer or staff user, the system issues a temporary password and flags "
        "<code>mustChangePassword = true</code>. When the user logs in at <code>/login</code>, credentials are validated using <code>bcryptjs</code>. "
        "If <code>mustChangePassword</code> is active, the Data Access Layer (DAL) immediately redirects the session to "
        "<code>/first-login-change-password</code>. The user cannot access any portal page until they provide the temporary password and a valid "
        "new password (minimum 8 characters, at least 1 digit). Upon success, the flag is cleared to <code>false</code> and an encrypted "
        "HTTP-only JWT cookie (<code>hn_session</code>) is established.",
        body_style
    ))
    story.append(Spacer(1, 4))

    # 5.2 Customer Management
    story.append(Paragraph("5.2 Customer Management & Multi-Account Linking", h2_style))
    story.append(Paragraph(
        "<b>Implementation:</b> <code>lib/actions/customer-actions.ts</code>, <code>components/admin/CustomerFormModal.tsx</code><br/>"
        "<b>Workflow:</b> Administrators can create, update, suspend, or delete customer accounts. The modal includes a dedicated "
        "<code>Customer Account Code(s)</code> field allowing comma-separated codes (e.g., <code>ZZSP100, ACC-2001, VSAT-409</code>). "
        "The backend stores these in <code>User.customerCodes</code> while maintaining <code>User.customerCode</code> as primary. "
        "When CDR files are uploaded or usage records queried, any matching code in the array automatically maps to this customer. "
        "Admins can also assign a <code>starlinkVesselId</code> to link live satellite telemetry directly to the profile.",
        body_style
    ))
    story.append(Spacer(1, 4))

    # 5.3 CDR Ingestion
    story.append(Paragraph("5.3 CDR File Ingestion & Automatic Detection", h2_style))
    story.append(Paragraph(
        "<b>Implementation:</b> <code>lib/cdr/parser.ts</code>, <code>components/admin/cdr/CdrUploadZone.tsx</code><br/>"
        "<b>Workflow:</b> Supports both bulk (multi-customer) and individual wholesale CDR CSV files. Files are parsed on-the-fly "
        "using PapaParse. The <code>detectColumns()</code> algorithm dynamically analyzes header aliases (e.g. 'Customer Code', 'CustID', "
        "'Account', 'Wholesale Cost', 'Wholesale_Amt', 'Product Code', 'Traffic Type'). The system calculates a SHA-256 hash of the "
        "file content to prevent duplicate batch uploads.",
        body_style
    ))
    story.append(Spacer(1, 4))

    # 5.4 Rating Engine
    story.append(Paragraph("5.4 CDR Rating Engine & Product Code Matching Matrix", h2_style))
    story.append(Paragraph(
        "<b>Implementation:</b> <code>lib/billing/pricing-engine.ts</code>, <code>models/CdrChargeRecord.ts</code>, <code>models/RetailPlan.ts</code><br/>"
        "<b>Workflow:</b> For each record, the rating engine matches the raw <code>customerCode</code> against all <code>User.customerCodes</code>. "
        "It then evaluates the row's product identifier against active <code>RetailPlan</code> mappings. It supports compound product codes "
        "(e.g., <code>Type,CALL - CODE- 123</code>, <code>Type,SMS - CODE 245</code>). When a match is made, the retail charge is computed: "
        "<code>wholesaleAmount * (1 + markupPercentage / 100)</code> or fixed price. A permanent snapshot is stored in <code>CdrChargeRecord</code> "
        "to ensure historical pricing integrity.",
        body_style
    ))
    story.append(Spacer(1, 4))

    # 5.5 Unallocated Records
    story.append(Paragraph("5.5 Unallocated Records Alert & Unmatched CDR Reporting", h2_style))
    story.append(Paragraph(
        "<b>Implementation:</b> <code>app/api/admin/cdr-import/[batchId]/unallocated-report/route.ts</code>, <code>components/admin/cdr/UnallocatedAlert.tsx</code><br/>"
        "<b>Workflow:</b> If a row contains an unknown Customer Code or an unmapped Product Code, the engine marks it as <code>UNMATCHED</code> "
        "with a clear reason. It never creates dummy customer accounts. An <b>Unallocated Records Alert Card</b> is rendered prominently. "
        "The administrator can click <b>'Download Unallocated Report (.csv)'</b> to export an audit CSV containing exact row numbers, "
        "missing codes, and wholesale amounts. Once the admin registers the customer or maps the product code, clicking "
        "<b>'Reprocess Unmatched'</b> immediately rates the quarantined records.",
        body_style
    ))
    story.append(PageBreak())

    # 5.6 Invoicing
    story.append(Paragraph("5.6 Billing, Invoicing & PDF Generation", h2_style))
    story.append(Paragraph(
        "<b>Implementation:</b> <code>lib/actions/invoice-actions.ts</code>, <code>lib/pdf/invoice-template.tsx</code>, <code>app/api/invoices/[id]/pdf/route.ts</code><br/>"
        "<b>Workflow:</b> Invoices aggregate monthly recurring subscription fees and matched CDR usage charges for a billing period. "
        "Admins can generate invoices in batch or individually. Invoices transition through a defined lifecycle: <code>DRAFT -> SENT -> PAID / VOID</code>. "
        "Both admins and customers can generate and download branded PDF invoices rendered on-the-fly via <code>@react-pdf/renderer</code>, "
        "complete with company header, tax breakdown (GST/VAT), itemized line items, payment terms, and remittance instructions.",
        body_style
    ))
    story.append(Spacer(1, 4))

    # 5.7 Terminal Telemetry
    story.append(Paragraph("5.7 Terminal Inventory & Live Starlink Telemetry", h2_style))
    story.append(Paragraph(
        "<b>Implementation:</b> <code>lib/starlink/client.ts</code>, <code>components/portal/StarlinkTelemetryWidget.tsx</code><br/>"
        "<b>Workflow:</b> For customer profiles linked to a <code>starlinkVesselId</code>, the system queries the SLASH API "
        "(<code>https://slash-api.rudra.sh/api/v1</code>). It retrieves real-time terminal metrics including round-trip latency (ms), "
        "ping drop percentages, download throughput (Mbps), upload throughput (Mbps), signal-to-noise ratio (SNR), obstruction status, "
        "and active satellite beam state. Visual status badges display connection health with color-coded telemetry gauges.",
        body_style
    ))
    story.append(Spacer(1, 4))

    # 5.8 Fleet Tracking
    story.append(Paragraph("5.8 Interactive GPS Fleet Tracking Map", h2_style))
    story.append(Paragraph(
        "<b>Implementation:</b> <code>components/admin/tracking/FleetMap.tsx</code>, <code>components/portal/VesselTrackingMap.tsx</code><br/>"
        "<b>Workflow:</b> Combines live vessel coordinates from terminal telemetry and manual asset registries. Renders an interactive "
        "Google Maps interface. Administrators view the entire global fleet with live status overlays. Customers see an isolated view "
        "containing only their assigned vessels with speed, heading, latitude/longitude coordinates, and last-seen timestamps.",
        body_style
    ))
    story.append(Spacer(1, 4))

    # 5.9 Service Plans
    story.append(Paragraph("5.9 Service Plans & Catalog Management", h2_style))
    story.append(Paragraph(
        "<b>Implementation:</b> <code>lib/actions/plan-actions.ts</code>, <code>models/ServicePlan.ts</code><br/>"
        "<b>Workflow:</b> Administrators configure recurring ISP and satellite subscription packages. Configurable parameters include "
        "Plan Name, Monthly Base Fee, Downlink Speed (Mbps), Uplink Speed (Mbps), Included Data Allowance (GB), Contention Ratio, "
        "and Excess Usage Rates. Subscriptions link customers to these plans with custom activation dates.",
        body_style
    ))
    story.append(Spacer(1, 4))

    # 5.10 Support Desk
    story.append(Paragraph("5.10 Customer Helpdesk & Support Ticketing", h2_style))
    story.append(Paragraph(
        "<b>Implementation:</b> <code>lib/actions/ticket-actions.ts</code>, <code>components/portal/SupportTicketModal.tsx</code><br/>"
        "<b>Workflow:</b> Provides two-way communication between customers and technical support. Customers submit tickets with Category "
        "(Billing, Technical, Account, Hardware) and Priority (Low, Medium, High, Urgent). Support agents respond in a chronological "
        "message thread, update ticket statuses (<code>OPEN, IN_PROGRESS, RESOLVED, CLOSED</code>), and assign staff members.",
        body_style
    ))
    story.append(Spacer(1, 4))

    # 5.11 Team & Settings
    story.append(Paragraph("5.11 Team Management, Audit Logs & System Settings", h2_style))
    story.append(Paragraph(
        "<b>Implementation:</b> <code>lib/actions/settings-actions.ts</code>, <code>models/ActivityLog.ts</code>, <code>models/Settings.ts</code><br/>"
        "<b>Workflow:</b> Super Admins manage internal staff accounts, configure company profile parameters (Business Name, Tax Number, Address, "
        "Currency, Invoice Notes), and configure SMTP credentials for automated email dispatch. The immutable <code>ActivityLog</code> "
        "records every administrative operation with timestamp, actor identity, action type, and detailed payload.",
        body_style
    ))
    story.append(PageBreak())

    # ==========================================
    # 6. MAIN USER WORKFLOWS
    # ==========================================
    story.append(Paragraph("6. MAIN USER WORKFLOWS", h1_style))
    story.append(HRFlowable(width="100%", thickness=1, color=PRIMARY_BLUE, spaceBefore=0, spaceAfter=8))

    story.append(Paragraph("6.1 Authentication & First-Login Security Gate Lifecycle", h2_style))
    
    auth_steps_table = [
        [Paragraph("<b>Step 1: Admin Invitation</b>", flow_step_title),
         Paragraph("Admin registers customer in portal. System generates temporary password, sets <code>mustChangePassword=true</code>, and sends email.", flow_step_body)],
        [Paragraph("<b>Step 2: Initial Login Attempt</b>", flow_step_title),
         Paragraph("User navigates to <code>/login</code> and enters temporary credentials. System validates bcrypt hash and identifies temporary flag.", flow_step_body)],
        [Paragraph("<b>Step 3: Forced Password Gate</b>", flow_step_title),
         Paragraph("DAL middleware intercepts request and redirects directly to <code>/first-login-change-password</code>. All dashboard routes are locked.", flow_step_body)],
        [Paragraph("<b>Step 4: Password Rotation</b>", flow_step_title),
         Paragraph("User provides temporary password and defines a new secure password (min 8 chars, 1 digit). Hash updated, flag cleared to <code>false</code>.", flow_step_body)],
        [Paragraph("<b>Step 5: Session Establishment</b>", flow_step_title),
         Paragraph("System creates encrypted JWT session cookie (<code>hn_session</code>) and dispatches user to authorized dashboard (<code>/admin</code> or <code>/portal</code>).", flow_step_body)]
    ]
    t_auth_steps = Table(auth_steps_table, colWidths=[150, 354])
    t_auth_steps.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), BG_LIGHT),
        ('BOX', (0, 0), (-1, -1), 0.5, BORDER_COLOR),
        ('INNERGRID', (0, 0), (-1, -1), 0.5, BORDER_LIGHT),
        ('PADDING', (0, 0), (-1, -1), 5),
    ]))
    story.append(t_auth_steps)
    story.append(Spacer(1, 10))

    story.append(Paragraph("6.2 CDR Ingestion, Rating & Unallocated Exception Lifecycle", h2_style))
    
    cdr_steps_table = [
        [Paragraph("<b>Step 1: Wholesale Ingestion</b>", flow_step_title),
         Paragraph("Admin drags and drops bulk wholesale CDR CSV in <code>Billing -> CDR Import</code>. PapaParse parses rows and SHA-256 prevents duplicates.", flow_step_body)],
        [Paragraph("<b>Step 2: Header Auto-Detection</b>", flow_step_title),
         Paragraph("Dynamic header matcher maps CSV column aliases for Customer Codes, Product Identifiers, and Wholesale Amounts.", flow_step_body)],
        [Paragraph("<b>Step 3: Customer Code Resolution</b>", flow_step_title),
         Paragraph("Engine checks row code against all <code>User.customerCodes</code> arrays. If unmatched -> quarantined as <code>UNMATCHED (Unknown Account)</code>.", flow_step_body)],
        [Paragraph("<b>Step 4: Product Rating Execution</b>", flow_step_title),
         Paragraph("Engine matches telecom code (e.g. CALL-123) against active Retail Plans, applies markup percentage, and snapshots in <code>CdrChargeRecord</code>.", flow_step_body)],
        [Paragraph("<b>Step 5: Unallocated Resolution</b>", flow_step_title),
         Paragraph("If unmatched rows exist, system displays Unallocated Alert Card. Admin exports CSV, adds missing customer/mapping, and clicks 'Reprocess'.", flow_step_body)]
    ]
    t_cdr_steps = Table(cdr_steps_table, colWidths=[150, 354])
    t_cdr_steps.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), BG_LIGHT),
        ('BOX', (0, 0), (-1, -1), 0.5, BORDER_COLOR),
        ('INNERGRID', (0, 0), (-1, -1), 0.5, BORDER_LIGHT),
        ('PADDING', (0, 0), (-1, -1), 5),
    ]))
    story.append(t_cdr_steps)
    story.append(PageBreak())

    # ==========================================
    # 7. ADMIN WORKFLOW
    # ==========================================
    story.append(Paragraph("7. ADMIN WORKFLOW (STEP-BY-STEP)", h1_style))
    story.append(HRFlowable(width="100%", thickness=1, color=PRIMARY_BLUE, spaceBefore=0, spaceAfter=8))
    story.append(Paragraph(
        "A typical day-to-day administrative lifecycle follows six structured steps:",
        body_style
    ))

    admin_steps = [
        ("Step 1: Dashboard Inspection", "Admin logs in at <code>/login</code> and lands on <code>/admin</code>. Inspects real-time statistics: Total Active Customers, Monthly Billed Revenue, Online vs Offline Terminals, and Open Support Tickets."),
        ("Step 2: Customer Onboarding & Multi-Account Setup", "Admin navigates to <code>Customers</code> and clicks 'Add Customer'. Enters contact info, assigns primary and secondary account codes (e.g. <code>ZZSP100, ACC-2001</code>), links a Starlink Vessel ID, and selects a recurring Service Plan. System sends an automated invite email with temporary credentials."),
        ("Step 3: CDR Ingestion & Processing", "Admin navigates to <code>CDR Import</code>, drags and drops the wholesale CSV file. System parses records, calculates charges, and alerts the admin if any records have missing accounts or unknown product codes."),
        ("Step 4: Exception Resolution", "If unallocated rows are detected, admin downloads the Unallocated CSV Report, verifies the unknown code, creates the customer or adds the product mapping, and clicks 'Reprocess Unmatched'."),
        ("Step 5: Monthly Invoicing", "Admin navigates to <code>Invoices</code>, clicks 'Generate Monthly Invoices'. System bundles rated CDR charges + recurring base fees, generates PDF invoices, and sends email notifications to clients."),
        ("Step 6: Fleet & Telemetry Monitoring", "Admin checks the <code>Tracking</code> map to inspect live vessel positions and monitors terminal telemetry (latency, ping drops, SNR) across all customer vessels.")
    ]
    for step_title, step_desc in admin_steps:
        story.append(Paragraph(f"<b>{step_title}:</b> {step_desc}", body_style))
        story.append(Spacer(1, 2))

    story.append(Spacer(1, 6))

    # ==========================================
    # 8. CUSTOMER WORKFLOW
    # ==========================================
    story.append(Paragraph("8. CUSTOMER / USER WORKFLOW (STEP-BY-STEP)", h1_style))
    story.append(HRFlowable(width="100%", thickness=1, color=PRIMARY_BLUE, spaceBefore=0, spaceAfter=8))
    story.append(Paragraph(
        "The end client self-service journey is streamlined and frictionless:",
        body_style
    ))

    cust_steps = [
        ("Step 1: Account Activation & First-Login Reset", "Client receives invitation email with temporary password. Upon logging in, system automatically redirects to <code>/first-login-change-password</code>. Client sets their secure password and enters the portal."),
        ("Step 2: Unified Multi-Account Overview", "Client lands on <code>/portal/overview</code>. The dashboard aggregates total data consumption, voice minutes, and SMS counts across all linked account numbers."),
        ("Step 3: Terminal & Starlink Health Monitoring", "Client checks terminal status cards. If Starlink is enabled, live telemetry displays current latency, download/upload speeds, SNR, and obstruction alerts."),
        ("Step 4: Live Fleet GPS Map", "Client navigates to <code>/portal/tracking</code> to view interactive Google Maps tracking displaying the real-time position, speed, and heading of their vessels."),
        ("Step 5: Invoice Review & PDF Download", "Client visits <code>/portal/invoices</code> to inspect current and past invoices, review line-item CDR usage charges, and download official PDF tax invoices."),
        ("Step 6: Helpdesk Ticketing", "If assistance is required, client clicks 'New Ticket' in <code>/portal/support</code>, describes the inquiry, and receives threaded replies from the support team.")
    ]
    for step_title, step_desc in cust_steps:
        story.append(Paragraph(f"<b>{step_title}:</b> {step_desc}", body_style))
        story.append(Spacer(1, 2))

    story.append(PageBreak())

    # ==========================================
    # 9. SYSTEM ARCHITECTURE
    # ==========================================
    story.append(Paragraph("9. SYSTEM ARCHITECTURE", h1_style))
    story.append(HRFlowable(width="100%", thickness=1, color=PRIMARY_BLUE, spaceBefore=0, spaceAfter=8))

    arch_layers = [
        [Paragraph("<b>Layer 1: Client Interfaces</b>", flow_step_title),
         Paragraph("Dual web portals for Administrators (<code>/admin/*</code>) and Corporate Clients (<code>/portal/*</code>) with responsive desktop and tablet layouts.", flow_step_body)],
        [Paragraph("<b>Layer 2: Edge Proxy & DAL</b>", flow_step_title),
         Paragraph("Next.js Middleware edge proxy with domain dispatch, encrypted JWT session parsing, role enforcement, and password change interception.", flow_step_body)],
        [Paragraph("<b>Layer 3: Application Server</b>", flow_step_title),
         Paragraph("Next.js 16 App Router featuring Server Components, React Server Actions, PapaParse streaming engine, and <code>@react-pdf/renderer</code> pipeline.", flow_step_body)],
        [Paragraph("<b>Layer 4: Database Layer</b>", flow_step_title),
         Paragraph("MongoDB cluster with Mongoose ORM managing 11 relational collections (Users, Subscriptions, CDR Batches, Charges, Invoices, Tickets, Logs).", flow_step_body)],
        [Paragraph("<b>Layer 5: External Services</b>", flow_step_title),
         Paragraph("SLASH API (Starlink live telemetry), Google Maps JavaScript SDK (fleet visualization), and Nodemailer SMTP (email dispatch).", flow_step_body)]
    ]
    t_arch = Table(arch_layers, colWidths=[150, 354])
    t_arch.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), BG_LIGHT),
        ('BOX', (0, 0), (-1, -1), 0.5, BORDER_COLOR),
        ('INNERGRID', (0, 0), (-1, -1), 0.5, BORDER_LIGHT),
        ('PADDING', (0, 0), (-1, -1), 5.5),
    ]))
    story.append(t_arch)
    story.append(Spacer(1, 10))

    # ==========================================
    # 10. DATA FLOW
    # ==========================================
    story.append(Paragraph("10. DATA FLOW ARCHITECTURE", h1_style))
    story.append(HRFlowable(width="100%", thickness=1, color=PRIMARY_BLUE, spaceBefore=0, spaceAfter=8))
    
    data_flows = [
        ("1. CDR Wholesale-to-Retail Stream", "Raw CSV File -> PapaParse Streaming Parser -> Dynamic Header Detection -> Customer Code Matcher (<code>User.customerCodes</code>) -> Product Identifier Matcher (<code>RetailPlan</code>) -> Immutable Rating Snapshot (<code>CdrChargeRecord</code>) -> Batch Header Summary -> Monthly Invoice Aggregation."),
        ("2. Live Starlink Telemetry Stream", "SLASH API (<code>/v1/starlink</code>) -> Connector with Backoff & Deduplication -> Normalization Service -> Real-time UI Gauge Widgets & Google Maps GPS Pin Overlay."),
        ("3. PDF Invoicing Stream", "Rated CDR Charges + Recurring Subscription Line Items -> Dynamic Tax Calculation -> React-PDF Layout Pipeline -> Binary Buffer Stream -> Browser Client Download.")
    ]
    for name, flow in data_flows:
        story.append(Paragraph(f"<b>{name}:</b><br/>{flow}", body_style))
        story.append(Spacer(1, 3))

    story.append(PageBreak())

    # ==========================================
    # 11. DATABASE OVERVIEW
    # ==========================================
    story.append(Paragraph("11. DATABASE OVERVIEW & ENTITY RELATIONSHIPS", h1_style))
    story.append(HRFlowable(width="100%", thickness=1, color=PRIMARY_BLUE, spaceBefore=0, spaceAfter=8))
    story.append(Paragraph(
        "The application utilizes MongoDB via Mongoose ORM. Below is the relational mapping of core models:",
        body_style
    ))

    db_entities = [
        [Paragraph("<b>Entity / Collection</b>", table_header), Paragraph("<b>Key Schema Fields</b>", table_header), Paragraph("<b>Relationships & Purpose</b>", table_header)],
        [Paragraph("<code>User</code>", table_cell_bold),
         Paragraph("email, passwordHash, role, status, customerCode, <b>customerCodes[]</b>, starlinkVesselId, mustChangePassword", table_cell),
         Paragraph("Central auth identity. Stores multi-account code array. Linked to Invoices, Tickets, Subscriptions.", table_cell)],
        [Paragraph("<code>CustomerAccount</code>", table_cell_bold),
         Paragraph("accountNumber, accountName, contactEmail, phone, companyAddress, status", table_cell),
         Paragraph("Dedicated corporate account entity mapped to customer codes.", table_cell)],
        [Paragraph("<code>Subscription</code>", table_cell_bold),
         Paragraph("customerId, planId, status, staticIp, terminalId, startDate, renewalDate", table_cell),
         Paragraph("Binds a User (Customer) to a recurring ServicePlan.", table_cell)],
        [Paragraph("<code>ServicePlan</code>", table_cell_bold),
         Paragraph("name, monthlyPrice, downloadSpeed, uploadSpeed, dataLimitGB, contentionRatio", table_cell),
         Paragraph("Master catalog of recurring ISP/Satellite subscription plans.", table_cell)],
        [Paragraph("<code>RetailPlan</code>", table_cell_bold),
         Paragraph("name, planType (MARKUP / FIXED), markupPercentage, fixedPrice, status", table_cell),
         Paragraph("Wholesale CDR rating configuration rules.", table_cell)],
        [Paragraph("<code>CdrIdentifierMapping</code>", table_cell_bold),
         Paragraph("identifier, trafficType, retailPlanId, description, isActive", table_cell),
         Paragraph("Maps raw CDR product codes (CALL-123, SMS-245) to RetailPlans.", table_cell)],
        [Paragraph("<code>CdrImportBatch</code>", table_cell_bold),
         Paragraph("fileName, fileHash, totalRows, matchedRows, unmatchedRows, wholesaleTotal, retailTotal", table_cell),
         Paragraph("Header record for bulk or single CDR upload operations.", table_cell)],
        [Paragraph("<code>CdrChargeRecord</code>", table_cell_bold),
         Paragraph("batchId, customerId, customerCode, productCode, wholesaleAmount, calculatedRetail, status", table_cell),
         Paragraph("Itemized rated CDR transaction. Linked to Invoices for billing.", table_cell)],
        [Paragraph("<code>Invoice</code>", table_cell_bold),
         Paragraph("invoiceNumber, customerId, billingPeriod, subtotal, taxAmount, totalAmount, status, lineItems[]", table_cell),
         Paragraph("Master billing record. Generates downloadable PDF invoices.", table_cell)],
        [Paragraph("<code>SupportTicket</code>", table_cell_bold),
         Paragraph("ticketNumber, customerId, subject, category, priority, status, assignedTo, messages[]", table_cell),
         Paragraph("Customer helpdesk ticketing and threaded communications.", table_cell)],
        [Paragraph("<code>ActivityLog</code>", table_cell_bold),
         Paragraph("actorId, actorRole, action, targetCustomer, metadata, ipAddress, timestamp", table_cell),
         Paragraph("Immutable system audit trail of all administrative actions.", table_cell)]
    ]
    t_db = Table(db_entities, colWidths=[105, 205, 194])
    t_db.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), NAVY_DARK),
        ('BOX', (0, 0), (-1, -1), 0.5, BORDER_COLOR),
        ('INNERGRID', (0, 0), (-1, -1), 0.5, BORDER_LIGHT),
        ('PADDING', (0, 0), (-1, -1), 3),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [WHITE, BG_LIGHT])
    ]))
    story.append(t_db)
    story.append(PageBreak())

    # ==========================================
    # 12. AUTHENTICATION & SECURITY CONTROLS
    # ==========================================
    story.append(Paragraph("12. AUTHENTICATION & SECURITY CONTROLS", h1_style))
    story.append(HRFlowable(width="100%", thickness=1, color=PRIMARY_BLUE, spaceBefore=0, spaceAfter=8))

    sec_points = [
        ("Cryptographic Password Hashing", "Passwords are never stored in plaintext. They are salted and hashed using <code>bcryptjs</code> (10 rounds)."),
        ("Encrypted JWT Session Cookies", "Sessions use signed, encrypted JWT tokens transmitted via HTTP-only, SameSite=Lax cookies (<code>hn_session</code>)."),
        ("Brute-Force Account Protection", "Enforces rate limiting and account locking after 5 consecutive failed login attempts (15-minute lockout)."),
        ("Mandatory First-Login Password Gate", "Temporary passwords generated by admins are restricted by <code>mustChangePassword=true</code>, preventing all portal access until rotated."),
        ("Edge Middleware & DAL Authorization", "Every server action and page route validates user roles at the Data Access Layer before executing database operations."),
        ("Comprehensive Audit Logging", "Sensitive actions (user creation, password updates, invoice generation, CDR uploads) write immutable records to <code>ActivityLog</code>.")
    ]
    for title, desc in sec_points:
        story.append(Paragraph(f"• <b>{title}:</b> {desc}", bullet_style))

    story.append(Spacer(1, 6))

    # ==========================================
    # 13. EXTERNAL INTEGRATIONS
    # ==========================================
    story.append(Paragraph("13. EXTERNAL INTEGRATIONS", h1_style))
    story.append(HRFlowable(width="100%", thickness=1, color=PRIMARY_BLUE, spaceBefore=0, spaceAfter=8))

    integrations_data = [
        [Paragraph("<b>External Service</b>", table_header), Paragraph("<b>Integration Architecture</b>", table_header), Paragraph("<b>Operational Functionality</b>", table_header)],
        [Paragraph("SLASH API<br/><i>(Starlink Telemetry)</i>", table_cell_bold),
         Paragraph("REST API (<code>https://slash-api.rudra.sh/api/v1</code>)<br/>Authenticated via <code>X-API-Key</code>", table_cell),
         Paragraph("Pulls real-time Starlink terminal latency, ping drops, bandwidth, and obstruction metrics.", table_cell)],
        [Paragraph("Google Maps JavaScript API", table_cell_bold),
         Paragraph("Client-side Maps SDK<br/>Custom SVG vessel pins & heading vectors", table_cell),
         Paragraph("Renders live GPS coordinates, vessel headings, speed, and fleet positions globally.", table_cell)],
        [Paragraph("SMTP Email Relay<br/><i>(Nodemailer)</i>", table_cell_bold),
         Paragraph("TLS SMTP Transport<br/>Configured in System Settings", table_cell),
         Paragraph("Dispatches user invitations, temporary credentials, password reset links, and invoice notices.", table_cell)],
        [Paragraph("PapaParse & React-PDF", table_cell_bold),
         Paragraph("In-memory streaming & buffer generation<br/>Zero external cloud dependency", table_cell),
         Paragraph("Parses multi-megabyte CDR files in browser/server and generates branded PDF invoices.", table_cell)]
    ]
    t_int = Table(integrations_data, colWidths=[120, 184, 200])
    t_int.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), NAVY_LIGHT),
        ('BOX', (0, 0), (-1, -1), 0.5, BORDER_COLOR),
        ('INNERGRID', (0, 0), (-1, -1), 0.5, BORDER_LIGHT),
        ('PADDING', (0, 0), (-1, -1), 4),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [WHITE, BG_LIGHT])
    ]))
    story.append(t_int)
    story.append(Spacer(1, 10))

    # ==========================================
    # 14. REPORTS & DATA MANAGEMENT
    # ==========================================
    story.append(Paragraph("14. REPORTS & DATA MANAGEMENT", h1_style))
    story.append(HRFlowable(width="100%", thickness=1, color=PRIMARY_BLUE, spaceBefore=0, spaceAfter=8))

    reports_list = [
        ("Unallocated CDR Exception Report (.csv)", "Generated on-demand via <code>/api/admin/cdr-import/[batchId]/unallocated-report</code>. Provides row-by-row analysis of unmatched records with original row index, missing Customer Code, unmapped Product Code, wholesale amount, and rejection reason."),
        ("Batch CDR Reconciliation Report (.csv)", "Full export of all processed records in an import batch, showing both wholesale inputs and calculated retail charges."),
        ("Tax-Compliant PDF Invoices", "Formatted with corporate letterhead, billing periods, payment remittance details, and itemized data/voice/SMS usage."),
        ("Fleet Inventory & Usage Audits", "Comprehensive tabular views and exportable datasets of active satellite terminals, IP allocations, and customer usage.")
    ]
    for r_title, r_desc in reports_list:
        story.append(Paragraph(f"• <b>{r_title}:</b> {r_desc}", bullet_style))

    story.append(PageBreak())

    # ==========================================
    # 15. IMPLEMENTATION STATUS MATRIX
    # ==========================================
    story.append(Paragraph("15. IMPLEMENTATION STATUS MATRIX", h1_style))
    story.append(HRFlowable(width="100%", thickness=1, color=PRIMARY_BLUE, spaceBefore=0, spaceAfter=8))
    story.append(Paragraph(
        "Direct feature-by-feature verification against actual codebase implementation:",
        body_style
    ))

    status_data = [
        [Paragraph("<b>Feature / Capability</b>", table_header), Paragraph("<b>Implementation Status</b>", table_header), Paragraph("<b>Codebase Location / Module</b>", table_header)],
        [Paragraph("Dual-Portal Architecture", table_cell_bold), Paragraph(badge_ready, table_cell), Paragraph("<code>proxy.ts</code>, <code>app/admin</code>, <code>app/portal</code>", table_cell)],
        [Paragraph("Authentication & Session DAL", table_cell_bold), Paragraph(badge_ready, table_cell), Paragraph("<code>lib/auth/dal.ts</code>, <code>lib/auth/session.ts</code>", table_cell)],
        [Paragraph("First-Login Forced Password Reset", table_cell_bold), Paragraph(badge_ready, table_cell), Paragraph("<code>app/first-login-change-password</code>", table_cell)],
        [Paragraph("Multi-Account Customer Linking", table_cell_bold), Paragraph(badge_ready, table_cell), Paragraph("<code>models/User.ts</code> (<code>customerCodes[]</code>)", table_cell)],
        [Paragraph("Wholesale CDR CSV Ingestion", table_cell_bold), Paragraph(badge_ready, table_cell), Paragraph("<code>lib/cdr/parser.ts</code>, <code>CdrUploadZone.tsx</code>", table_cell)],
        [Paragraph("Dynamic Column Header Detection", table_cell_bold), Paragraph(badge_ready, table_cell), Paragraph("<code>lib/cdr/parser.ts</code> (<code>detectColumns()</code>)", table_cell)],
        [Paragraph("Compound Product Code Rating", table_cell_bold), Paragraph(badge_ready, table_cell), Paragraph("<code>lib/billing/pricing-engine.ts</code>", table_cell)],
        [Paragraph("Unallocated CDR Alert & CSV Export", table_cell_bold), Paragraph(badge_ready, table_cell), Paragraph("<code>api/admin/cdr-import/.../unallocated-report</code>", table_cell)],
        [Paragraph("One-Click CDR Reprocessing", table_cell_bold), Paragraph(badge_ready, table_cell), Paragraph("<code>lib/actions/cdr-actions.ts</code>", table_cell)],
        [Paragraph("Automated Invoice Generation", table_cell_bold), Paragraph(badge_ready, table_cell), Paragraph("<code>lib/actions/invoice-actions.ts</code>", table_cell)],
        [Paragraph("Dynamic PDF Invoice Rendering", table_cell_bold), Paragraph(badge_ready, table_cell), Paragraph("<code>lib/pdf/invoice-template.tsx</code>", table_cell)],
        [Paragraph("Starlink SLASH Telemetry Client", table_cell_bold), Paragraph(badge_ready, table_cell), Paragraph("<code>lib/starlink/client.ts</code>", table_cell)],
        [Paragraph("Interactive GPS Fleet Tracking", table_cell_bold), Paragraph(badge_ready, table_cell), Paragraph("<code>components/admin/tracking/FleetMap.tsx</code>", table_cell)],
        [Paragraph("Support Helpdesk & Threading", table_cell_bold), Paragraph(badge_ready, table_cell), Paragraph("<code>lib/actions/ticket-actions.ts</code>", table_cell)],
        [Paragraph("Immutable Activity Audit Logging", table_cell_bold), Paragraph(badge_ready, table_cell), Paragraph("<code>models/ActivityLog.ts</code>", table_cell)]
    ]
    t_status = Table(status_data, colWidths=[180, 114, 210])
    t_status.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), NAVY_DARK),
        ('BOX', (0, 0), (-1, -1), 0.5, BORDER_COLOR),
        ('INNERGRID', (0, 0), (-1, -1), 0.5, BORDER_LIGHT),
        ('PADDING', (0, 0), (-1, -1), 3),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [WHITE, BG_LIGHT])
    ]))
    story.append(t_status)
    story.append(Spacer(1, 10))

    # ==========================================
    # 16. CURRENT LIMITATIONS
    # ==========================================
    story.append(Paragraph("16. CURRENT LIMITATIONS", h1_style))
    story.append(HRFlowable(width="100%", thickness=1, color=PRIMARY_BLUE, spaceBefore=0, spaceAfter=8))
    
    limits = [
        ("Manual Payment Status Tracking", "Invoices currently support status transitions (Draft, Sent, Paid, Void) marked by administrators (e.g. Bank Wire / Direct Transfer) rather than an embedded instant credit card payment gateway."),
        ("External Telemetry Upstream Dependency", "Live Starlink metrics require active vessel linkage and valid credentials for the upstream SLASH API service."),
        ("Manual CSV Upload Trigger", "Wholesale CDR files are uploaded through the web UI rather than an automated SFTP server polling daemon.")
    ]
    for l_title, l_desc in limits:
        story.append(Paragraph(f"• <b>{l_title}:</b> {l_desc}", bullet_style))

    story.append(Spacer(1, 6))

    # ==========================================
    # 17. FUTURE IMPROVEMENT ROADMAP
    # ==========================================
    story.append(Paragraph("17. FUTURE IMPROVEMENT ROADMAP", h1_style))
    story.append(HRFlowable(width="100%", thickness=1, color=PRIMARY_BLUE, spaceBefore=0, spaceAfter=8))

    roadmap_items = [
        ("Integrated Payment Gateway", "Embedded Stripe / Adyen checkout for instant customer invoice settlement and recurring auto-pay credit card billing."),
        ("Automated SFTP / S3 CDR Ingestion", "Background cron scheduler to automatically pull and rate CDR files from satellite wholesale FTP dropboxes."),
        ("SMS & Webhook Alerting", "Instant SMS notifications (via Twilio/AWS SNS) when vessels exceed bandwidth allowances or experience satellite link drops."),
        ("Advanced Telemetry AI Diagnostics", "Machine learning anomaly detection to predict terminal hardware failures or antenna misalignment based on historical SNR patterns.")
    ]
    for r_title, r_desc in roadmap_items:
        story.append(Paragraph(f"• <b>{r_title}:</b> {r_desc}", bullet_style))

    story.append(PageBreak())

    # ==========================================
    # 18. FINAL SUMMARY
    # ==========================================
    story.append(Paragraph("18. FINAL SUMMARY & VERIFICATION", h1_style))
    story.append(HRFlowable(width="100%", thickness=1, color=PRIMARY_BLUE, spaceBefore=0, spaceAfter=8))

    final_text = (
        "The <b>Hybrid Networks Portal</b> is a fully verified, production-grade enterprise application. "
        "Every feature documented in this manual—including multi-account customer linking, fuzzy CDR column detection, "
        "wholesale-to-retail markup rating, unallocated exception reporting, React-PDF invoice generation, "
        "real-time SLASH Starlink telemetry, interactive Google Maps fleet tracking, and mandatory first-login password security—"
        "is fully implemented and operational in the codebase.<br/><br/>"
        "This platform provides a robust foundation for satellite service providers, maritime fleet operators, "
        "and enterprise telecommunications management."
    )
    story.append(make_callout("PLATFORM VERIFICATION & PRODUCTION READINESS", final_text, BG_CARD, SUCCESS_GREEN))
    story.append(Spacer(1, 20))

    # Signoff Block
    signoff_data = [
        [Paragraph("<b>Prepared By:</b>", body_style), Paragraph("Enterprise QA & Engineering Team", body_style),
         Paragraph("<b>Client:</b>", body_style), Paragraph("Hybrid Networks & Enterprise Clients", body_style)],
        [Paragraph("<b>Status:</b>", body_style), Paragraph(badge_ready, body_style),
         Paragraph("<b>Date:</b>", body_style), Paragraph("September 2026", body_style)]
    ]
    t_sign = Table(signoff_data, colWidths=[90, 160, 60, 194])
    t_sign.setStyle(TableStyle([
        ('BOX', (0, 0), (-1, -1), 0.5, BORDER_COLOR),
        ('BACKGROUND', (0, 0), (-1, -1), BG_LIGHT),
        ('PADDING', (0, 0), (-1, -1), 6),
    ]))
    story.append(t_sign)

    # Build Document
    doc.build(story, canvasmaker=NumberedCanvas)
    print(f"Successfully generated documentation PDF: {output_path}")

if __name__ == "__main__":
    output_pdf = sys.argv[1] if len(sys.argv) > 1 else "Application_Feature_Documentation.pdf"
    create_documentation_pdf(output_pdf)

