# System Architecture

## Overview
This document outlines the core architecture of the AI-First ERP system.

## Components
- **API Gateway Layer**: FastAPI application providing RESTful routes
- **Identity & Access Management**: JWT-based authentication and RBAC
- **Core Data Layer**: Multi-tenant PostgreSQL database via SQLAlchemy
- **Event System**: Redis Pub/Sub for cross-module events
- **Background Jobs**: Redis Queue (RQ) for async processing

## Flow
1. Client makes HTTP request
2. Gateway authenticates via JWT
3. Middleware extracts Tenant Context
4. Application handles business logic
5. Service queries Data Layer with Tenant filtering
