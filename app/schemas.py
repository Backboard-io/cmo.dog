"""Pydantic schemas for API request/response and run state."""

from pydantic import BaseModel, Field, HttpUrl
from typing import Optional


class RunCreate(BaseModel):
    website_url: str = Field(..., description="Website URL to analyze")


class RunResponse(BaseModel):
    run_id: str


class DocumentItem(BaseModel):
    id: str
    title: str


class CompetitorItem(BaseModel):
    id: str
    name: str


class CompetitorReportRow(BaseModel):
    competitor: str
    category: str
    pricing: str


class CompetitorReport(BaseModel):
    title: str = "Competitor Analysis"
    date: str = ""
    executive_summary: str = ""
    rows: list[CompetitorReportRow] = Field(default_factory=list)


class AnalyticsMetric(BaseModel):
    key: str
    label: str
    score: int = Field(..., ge=0, le=100)
    tone: str = "neutral"


class AuditCheck(BaseModel):
    name: str
    description: str
    value: str = ""
    passed: bool = True
    how_to_fix: str = ""


class FeedItem(BaseModel):
    id: str
    title: str
    status: str
    description: str = ""
    how_to_fix: str = ""
    action_label: str = "Fix"


class ChatMessage(BaseModel):
    role: str
    content: str


class RunStatus(BaseModel):
    run_id: str
    status: str = Field(..., description="pending | running | completed | failed")
    website_url: str = ""
    project_name: str = ""
    project_description: str = ""
    documents: list[DocumentItem] = Field(default_factory=list)
    competitors: list[CompetitorItem] = Field(default_factory=list)
    competitor_report: Optional[CompetitorReport] = None
    brand_voice_snippet: str = ""
    audit_summary: str = ""
    analytics_overview: list[AnalyticsMetric] = Field(default_factory=list)
    passed_checks: list[AuditCheck] = Field(default_factory=list)
    failed_checks: list[AuditCheck] = Field(default_factory=list)
    feed_items: list[FeedItem] = Field(default_factory=list)
    chat_status: str = "loading"
    chat_messages: list[ChatMessage] = Field(default_factory=list)
    credits: int = 2000
