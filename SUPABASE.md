# SUPABASE.md - Database Documentation

This file documents all Supabase database operations, schema changes, and configurations for PronoiaApp V2.

## Project Information
- **Project Name**: PronoiaApp V2 SaaS
- **Database Type**: PostgreSQL (Supabase)
- **Created**: 2025-09-17
- **Version**: Initial Setup

---

## Table of Contents
- [Database Schema](#database-schema)
- [Row Level Security (RLS) Policies](#row-level-security-rls-policies)
- [Authentication Configuration](#authentication-configuration)
- [Storage Buckets](#storage-buckets)
- [Functions and Triggers](#functions-and-triggers)
- [Migrations Log](#migrations-log)
- [Performance Indices](#performance-indices)
- [Security Configurations](#security-configurations)

---

## Database Schema

### Core Tables Overview
The database follows a multi-tenant architecture with organization-based data isolation.

#### 1. Organizations Table
**Purpose**: Central table for multi-tenant organization management
**Created**: TBD
**Status**: Pending Creation

#### 2. Organization Users Table
**Purpose**: Many-to-many relationship between users and organizations with roles
**Created**: TBD
**Status**: Pending Creation

#### 3. Templates Table
**Purpose**: Store photo template designs and metadata
**Created**: TBD
**Status**: Pending Creation

#### 4. Studio Sessions Table
**Purpose**: Track photo editing sessions and workflow states
**Created**: TBD
**Status**: Pending Creation

#### 5. Google Drive Integrations Table
**Purpose**: Store encrypted OAuth tokens per organization
**Created**: TBD
**Status**: Pending Creation

---

## Row Level Security (RLS) Policies

### Security Strategy
All tables implement Row Level Security to ensure:
- Complete data isolation between organizations
- User-level permissions within organizations
- Secure multi-tenant architecture

### Policy Documentation
*Policies will be documented here as they are created*

---

## Authentication Configuration

### Providers Setup
*Authentication provider configurations will be documented here*

### Custom Claims
*Custom JWT claims and user metadata will be documented here*

---

## Storage Buckets

### Bucket Configuration
*Storage bucket setup and policies will be documented here*

---

## Functions and Triggers

### Database Functions
*Custom PostgreSQL functions will be documented here*

### Triggers
*Database triggers for automation will be documented here*

---

## Migrations Log

### Migration Format
Each migration entry includes:
- **Migration ID**: Unique identifier
- **Date**: When applied
- **Description**: What changed
- **SQL**: Complete migration SQL
- **Rollback**: How to reverse if needed
- **Dependencies**: Other migrations required
- **Impact**: Performance/breaking changes

### Migration History
*All migrations will be logged here chronologically*

---

## Performance Indices

### Index Strategy
*Database indices for performance optimization will be documented here*

---

## Security Configurations

### Encryption
*Encryption setup for sensitive data will be documented here*

### Access Controls
*Database-level access controls will be documented here*

---

## Development Notes

### Environment Setup
- Development database URL: TBD
- Production database URL: TBD (when ready)

### Backup Strategy
*Backup and recovery procedures will be documented here*

### Monitoring
*Database monitoring and alerting setup will be documented here*

---

## Troubleshooting

### Common Issues
*Common database issues and solutions will be documented here*

### Performance Tuning
*Performance optimization notes will be documented here*

---

**Last Updated**: 2025-09-17
**Next Review**: After initial schema creation
**Maintained By**: Claude Code Assistant

---

*This document is automatically maintained during development. All database changes must be documented here immediately after implementation.*