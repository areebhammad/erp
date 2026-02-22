# Contributing Guide

## How to Contribute
1. Create a logical branch for your feature
2. Develop features using the provided architecture patterns
3. Add unit and integration tests under `tests/`
4. Run `pytest` or `make test` to ensure coverage
5. Validate linting using pre-commit hooks
6. Submit a Pull Request

## Core Principles
- Modular separation: Ensure new modules communicate via Events
- Multi-tenancy must be preserved: Always test queries with fake tenant IDs
