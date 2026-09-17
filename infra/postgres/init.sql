-- Runs only on first creation of the local development volume.
CREATE ROLE backend LOGIN PASSWORD 'backend-dev';
CREATE DATABASE backend OWNER backend;
REVOKE ALL ON DATABASE backend FROM PUBLIC;
CREATE ROLE ai_service LOGIN PASSWORD 'ai-dev';
CREATE DATABASE ai_runtime OWNER ai_service;
REVOKE ALL ON DATABASE ai_runtime FROM PUBLIC;
