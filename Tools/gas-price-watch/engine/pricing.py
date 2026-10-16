"""Nova Scotia regular gasoline math and public-source parsers.

All monetary calculations use Decimal and Canadian cents per litre.
Policy sources and effective dates are documented in README.md.
"""
from datetime import date, datetime, timedelta
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
from html.parser import HTMLParser
import re

D = Decimal
US_GALLON_LITRES = D("3.785411784")
TRANSPORT = (D("0.6"), D("1.1"), D("1.5"), D("1.6"), D("1.6"), D("2.3"))


def rounded(value, places="0.01"):
    return D(value).quantize(D(places), rounding=ROUND_HALF_UP)


def number(value):
    try:
        result = D(str(value))
    except InvalidOperation as exc:
        raise ValueError(f"Invalid number: {value!r}") from exc
    if not result.is_finite():
        raise ValueError("A price must be a finite number")
    return result


def policy(day):
    if day < date(2025, 1, 3):
        raise ValueError("Policy history starts on 2025-01-03")
    excise = D("10")
    if date(2026, 4, 20) <= day <= date(2027, 1, 31):
        excise = D("0")
    elif date(2027, 2, 1) <= day <= date(2027, 3, 31):
        excise = D("5")
    return {
        "wholesale_margin": D("13.84") if day < date(2026, 1, 9) else D("10.84"),
        "carbon": D("17.61") if day < date(2025, 4, 1) else D("0"),
        "excise": excise,
        "provincial_tax": D("15.5"),
        "hst": D("0.15") if day < date(2025, 4, 1) else D("0.14"),
        "retail_min": D("5.4") if day < date(2026, 5, 29) else D("7.1"),
        "retail_max": D("7.4") if day < date(2026, 5, 29) else D("9.7"),
    }


def calculate_supply(day, zone, supply_component, credit_card):
    """Apply regulated margins/taxes to B + forward + clean-fuel costs, in CAD c/L."""
    if zone not in range(1, 7):
        raise ValueError("Zone must be 1 through 6")
    supply_component, credit_card = map(number, (supply_component, credit_card))
    if supply_component <= 0:
        raise ValueError("Supply component must be positive")
    p = policy(day)
    base = rounded(supply_component + p["wholesale_margin"] + TRANSPORT[zone - 1] + p["carbon"])
    wholesale = rounded(base + p["excise"] + p["provincial_tax"])
    minimum = rounded((wholesale + p["retail_min"] + credit_card) * (1 + p["hst"]), "0.1")
    maximum = rounded((wholesale + p["retail_max"] + credit_card) * (1 + p["hst"]), "0.1")
    return dict(p, zone=zone, supply_component=rounded(supply_component), credit_card=credit_card,
                transport=TRANSPORT[zone - 1], base_wholesale=base,
                wholesale=wholesale, minimum=minimum, maximum=maximum)


def calculate(day, zone, benchmark, forward, clean_fuel, credit_card):
    benchmark, forward, clean_fuel, credit_card = map(
        number, (benchmark, forward, clean_fuel, credit_card))
    if benchmark <= 0 or clean_fuel < 0:
        raise ValueError("Benchmark must be positive and clean-fuel adjustor nonnegative")
    result = calculate_supply(day, zone, rounded(benchmark) + forward + clean_fuel, credit_card)
    return dict(result, benchmark=rounded(benchmark), forward=forward, clean_fuel=clean_fuel)


def blend_benchmark(rows):
    if not rows:
        raise ValueError("No daily assessments supplied")
    values = []
    for row in rows:
        cbob_low, cbob_high, ethanol_low, ethanol_high, fx = (
            number(row[k]) for k in ("cbob_low", "cbob_high", "ethanol_low", "ethanol_high", "fx"))
        if min(cbob_low, ethanol_low, fx) <= 0 or cbob_high < cbob_low or ethanol_high < ethanol_low:
            raise ValueError("Invalid high/low assessment or exchange rate")
        blend = D("0.9") * (cbob_low + cbob_high) / 2 + D("0.1") * (ethanol_low + ethanol_high) / 2
        values.append(100 * fx * blend / US_GALLON_LITRES)
    return rounded(sum(values) / len(values))


NUM = r"([+-]?\d+(?:\.\d+)?)"


def parse_order(text, effective, source_url, previous=None, *, allow_decision_date_conflict=False):
    text = re.sub(r"([+-])\s+(?=\d)", r"\1", text)
    # One archived order prints +0,4. Preserve dates and normalize only short decimal fractions.
    text = re.sub(r"(\d+),(\d{1,2})(?!\d)", r"\1.\2", text)
    compact = " ".join(text.split())
    dates = re.findall(r"effective on and after 12:01\s*a\.?m\.?\s*(?:on\s*)?"
                       r"(?:(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),?\s*)?"
                       r"([A-Za-z]+\.?\s+\d{1,2},?\s+\d{4})", compact, re.I)
    parsed_dates = []
    for value in dates:
        value = value.replace(".", "").replace(",", "")
        parsed_dates.append(datetime.strptime(value, "%B %d %Y").date())
    warnings = []
    # The operative Schedule A precedes the decision body in these Board PDFs.
    # Only the independently reviewed May 23 typo is allowed by the caller.
    known_typo = (allow_decision_date_conflict and effective == date(2026, 5, 23)
                  and parsed_dates and parsed_dates[0] == effective
                  and set(parsed_dates) == {effective, date(2026, 5, 22)}
                  and "Schedule" in compact.split("effective on and after", 1)[0])
    if known_typo:
        warnings.append("Decision body says 2026-05-22; operative Schedule A and official archive "
                        "agree on 2026-05-23. The schedule date is used.")
    elif not parsed_dates or any(d != effective for d in parsed_dates):
        raise ValueError(f"Archive date {effective} conflicts with the effective dates "
                         + ", ".join(d.isoformat() for d in parsed_dates))
    rows = re.findall(r"^\s*Re[gq]ular Unleaded\s+(.+)$", text, re.M | re.I)
    zones = []
    for zone, row in enumerate(rows, 1):
        values = [D(x) for x in re.findall(NUM, row)]
        if len(values) != 8:
            raise ValueError(f"Expected eight schedule columns for zone {zone}")
        zones.append(dict(zip(("base_wholesale", "excise", "provincial_tax", "wholesale",
                               "minimum", "maximum", "full_min", "full_max"), values), zone=zone))
    if len(zones) != 6:
        raise ValueError("Expected six regular gasoline zone rows")
    benchmark = re.search(r"Regular Gasoline\s*\(Grade 1\)\s*" + NUM
                          + r"\s+([+-]?\d+(?:\.\d+)?|NIL)", text, re.I)
    if benchmark:
        minimum = re.findall(r"^\s*Gasoline Minimum Self-Service and Full-Service\s*" + NUM, text, re.M)
        maximum = re.findall(r"^\s*Gasoline Maximum Self-Service\s*" + NUM, text, re.M)
        clean = re.findall(r"^\s*Gasoline\s+" + NUM + r"\s*$", text, re.M)
        if not minimum or not maximum or not clean:
            raise ValueError("Gasoline component table is incomplete")
        if sum(map(D, minimum)) != sum(map(D, maximum)):
            raise ValueError("Different minimum/maximum retail adjustments require a model update")
        components = {"benchmark": D(benchmark[1]),
                      "forward": D("0") if benchmark[2].upper() == "NIL" else D(benchmark[2]),
                      "credit_card": sum(map(D, minimum)), "clean_fuel": D(clean[-1])}
    else:
        if previous is None:
            raise ValueError("A partial order needs the preceding gasoline order")
        if zones != previous["zones"]:
            raise ValueError("A partial order changed gasoline prices without gasoline component tables")
        components = {k: previous[k] for k in ("benchmark", "forward", "credit_card", "clean_fuel")}
    return dict(components, date=effective, source_url=source_url, zones=zones,
                gasoline_setting=bool(benchmark), source_warnings=warnings)


class Anchors(HTMLParser):
    def __init__(self):
        super().__init__()
        self.links, self.href, self.parts = [], None, []

    def handle_starttag(self, tag, attrs):
        if tag == "a":
            self.href, self.parts = dict(attrs).get("href"), []

    def handle_data(self, data):
        if self.href:
            self.parts.append(data.strip())

    def handle_endtag(self, tag):
        if tag == "a" and self.href:
            self.links.append({"url": self.href, "text": " ".join(self.parts)})
            self.href = None


class TableRows(HTMLParser):
    def __init__(self):
        super().__init__()
        self.rows, self.row, self.cell = [], [], None

    def handle_starttag(self, tag, attrs):
        if tag == "tr":
            self.row = []
        if tag in ("td", "th"):
            self.cell = []

    def handle_data(self, data):
        if self.cell is not None:
            self.cell.append(data)

    def handle_endtag(self, tag):
        if tag in ("td", "th") and self.cell is not None:
            self.row.append("".join(self.cell).strip())
            self.cell = None
        if tag == "tr" and len(self.row) == 6:
            self.rows.append(self.row)


def parse_eia(html):
    parser = TableRows()
    parser.feed(html)
    result = {}
    for row in parser.rows:
        match = re.match(r"(\d{4}) ([A-Z][a-z]{2})-\s*(\d+) to", row[0])
        if match is None:
            continue
        monday = datetime.strptime(" ".join(match.groups()), "%Y %b %d").date()
        for offset, value in enumerate(row[1:]):
            if re.fullmatch(r"\d+\.\d+", value):
                result[monday + timedelta(days=offset)] = D(value)
    if not result:
        raise ValueError("EIA response contains no daily prices")
    return result


def easter(year):
    a, b, c = year % 19, year // 100, year % 100
    d, e, f = b // 4, b % 4, (b + 8) // 25
    g = (b - f + 1) // 3
    h = (19 * a + b - d - g + 15) % 30
    i, k = c // 4, c % 4
    l = (32 + 2 * e + 2 * i - h - k) % 7
    m = (a + 11 * h + 22 * l) // 451
    n = h + l - 7 * m + 114
    return date(year, n // 31, n % 31 + 1)


def market_days(start, end):
    def observed(day):
        return day - timedelta(days=1) if day.weekday() == 5 else day + timedelta(days=1) if day.weekday() == 6 else day

    def nth_weekday(year, month, weekday, n):
        first = date(year, month, 1)
        return first + timedelta(days=(weekday - first.weekday()) % 7 + 7 * (n - 1))

    holidays = set()
    for year in range(start.year, end.year + 2):
        holidays.update(observed(date(year, month, day)) for month, day in ((1, 1), (6, 19), (7, 4), (12, 25)))
        holidays.update((nth_weekday(year, 1, 0, 3), nth_weekday(year, 2, 0, 3),
                         date(year, 5, 31) - timedelta(days=date(year, 5, 31).weekday()),
                         nth_weekday(year, 9, 0, 1), nth_weekday(year, 11, 3, 4),
                         easter(year) - timedelta(days=2)))
    days = [start + timedelta(days=i) for i in range((end - start).days + 1)]
    return [d for d in days if d.weekday() < 5 and d not in holidays]


def bank_holidays(year):
    """Canadian FX nonpublication holidays; Easter Monday is a publication day."""
    def monday(month, n):
        first = date(year, month, 1)
        return first + timedelta(days=(-first.weekday()) % 7 + 7 * (n - 1))

    result = {monday(2, 3), monday(8, 1), monday(9, 1), monday(10, 2),
              date(year, 5, 24) - timedelta(days=date(year, 5, 24).weekday()),
              easter(year) - timedelta(days=2)}
    for month, day in ((1, 1), (7, 1), (9, 30), (11, 11), (12, 25), (12, 26)):
        observed = date(year, month, day)
        while observed.weekday() >= 5 or observed in result:
            observed += timedelta(days=1)
        result.add(observed)
    return result


def fx_rate(day, rates):
    if day in rates:
        return day, rates[day]
    if day not in bank_holidays(day.year):
        raise ValueError(f"Missing Bank of Canada business-day rate for {day}")
    previous = day - timedelta(days=1)
    while previous.weekday() >= 5 or previous in bank_holidays(previous.year):
        previous -= timedelta(days=1)
    if previous not in rates or (day - previous).days > 4:
        raise ValueError(f"No preceding published Bank of Canada rate for holiday {day}")
    return previous, rates[previous]


def proxy_window(effective, market, fx):
    if effective.weekday() != 4:
        raise ValueError("The free forecast model supports normal Friday settings")
    start, end = effective - timedelta(days=8), effective - timedelta(days=2)
    required = market_days(start, end)
    missing = [d.isoformat() for d in required if d not in market]
    if missing:
        raise ValueError("Incomplete market window; missing " + ", ".join(missing))
    days = sorted(d for d in market if start <= d <= end)
    values, carried, observations = [], [], []
    for day in days:
        rate_date, rate = fx_rate(day, fx)
        if rate_date != day:
            carried.append(day.isoformat())
        if market[day] <= 0 or rate <= 0:
            raise ValueError("Invalid market price or exchange rate")
        value = 100 * market[day] * rate / US_GALLON_LITRES
        values.append(value)
        observations.append(dict(date=day.isoformat(), usd_per_gallon=market[day],
                                 fx=fx[rate_date], fx_date=rate_date.isoformat(), cad_cents_litre=rounded(value)))
    return dict(value=rounded(sum(values) / len(values)), start=start.isoformat(), end=end.isoformat(),
                carried_fx_days=carried, observations=observations)


def audit_order(order):
    mismatches = []
    for observed in order["zones"]:
        result = calculate(order["date"], observed["zone"], order["benchmark"],
                           order["forward"], order["clean_fuel"], order["credit_card"])
        for field in ("base_wholesale", "excise", "provincial_tax", "wholesale", "minimum", "maximum"):
            if result[field] != observed[field]:
                mismatches.append(dict(zone=observed["zone"], field=field,
                                       calculated=result[field], published=observed[field],
                                       difference=rounded(observed[field] - result[field])))
    return mismatches
