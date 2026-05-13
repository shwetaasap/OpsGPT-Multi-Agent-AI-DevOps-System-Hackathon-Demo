"""Make the project root importable so `from agents.* import ...` works
regardless of where pytest is run from.
"""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))
