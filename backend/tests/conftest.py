"""Shared fixtures for backend tests."""
import os
import sys

# Ensure the backend package is importable from the repo root
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
