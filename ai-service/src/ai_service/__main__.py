"""Support ``python -m ai_service`` as well as the installed console script."""

from ai_service.cli import main

if __name__ == "__main__":
    raise SystemExit(main())
