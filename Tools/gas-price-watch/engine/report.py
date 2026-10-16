"""Render the saved results as a portable, local HTML calculator."""
from datetime import date, datetime
from decimal import Decimal
import json
from pathlib import Path


def render(snapshot, target):
    def encode(value):
        if isinstance(value, (date, datetime, Decimal)):
            return str(value)
        raise TypeError(type(value).__name__)

    payload = json.dumps(snapshot, default=encode).replace("<", "\\u003c")
    template = Path(__file__).with_name("report-template.html").read_text()
    target.write_text(template.replace("__DATA__", payload))
