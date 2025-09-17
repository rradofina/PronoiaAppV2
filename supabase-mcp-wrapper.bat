@echo off
rem Supabase MCP Server Wrapper Script
rem Reads environment variables from .env.local and launches the MCP server

rem Read .env.local file and set environment variables (skip comments)
for /f "usebackq tokens=1,2 delims==" %%a in (".env.local") do (
    if not "%%a"=="" if not "%%a:~0,1%"=="#" (
        if "%%a"=="SUPABASE_ACCESS_TOKEN" set SUPABASE_ACCESS_TOKEN=%%b
        if "%%a"=="SUPABASE_PROJECT_REF" set SUPABASE_PROJECT_REF=%%b
    )
)

rem Launch the Supabase MCP server with environment variables
npx @supabase/mcp-server-supabase@latest