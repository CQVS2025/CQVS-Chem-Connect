"""
Convert "Chem Connect Contacts Segmented.xlsx" -> GHL-import CSV.

Reads the "All Contacts" sheet (master list; the other sheets are filtered
views of the same data) and writes a CSV matching the GHL Sample-File schema:

    Phone, Email, First Name, Last Name, Business Name, Source,
    Additional Emails, Additional Phones, Notes, Tags

Mapping:
    Company    -> Business Name
    Full Name  -> Name + First Name + Last Name (split on first space)
    Email      -> Email
    Phone      -> Phone  (cleaned: "61-261621400" -> "+61261621400")
    City       -> City   (standard GHL field)
    State      -> State  (standard GHL field)
    Industry   -> Tags
    Job Title  -> Notes  (no standard GHL field for it)
    Source / Additional Emails / Additional Phones -> empty

Phone handling (to avoid GHL import failures):
  * Many rows share an office phone (multiple people at one company).
    GHL treats same phone = same contact and merges them. To preserve all
    contacts as separate records, each phone is kept on only the FIRST row
    that uses it; subsequent rows move that phone into Notes as
    "Office Phone: ...".
  * Phones that aren't valid AU E.164 (e.g. "+61800679493", "+618013640233"
    — malformed source data) are moved to Notes as "Phone (unparsed): ..."
    so the contact still imports.
"""

import csv
import re
from pathlib import Path

import openpyxl
import phonenumbers

DOCS = Path(__file__).resolve().parent
SRC = DOCS / "Chem Connect Contacts Segmented.xlsx"
DST = DOCS / "Chem-Connect-GHL-Import.csv"

GHL_HEADERS = [
    "Phone",
    "Email",
    "Name",
    "First Name",
    "Last Name",
    "Business Name",
    "City",
    "State",
    "Source",
    "Additional Emails",
    "Additional Phones",
    "Notes",
    "Tags",
]


def clean_phone(raw):
    if raw is None:
        return ""
    s = str(raw).strip()
    if not s:
        return ""
    digits = re.sub(r"\D", "", s)
    if not digits:
        return ""
    return "+" + digits


def is_valid_au_phone(phone):
    try:
        n = phonenumbers.parse(phone, None)
    except phonenumbers.NumberParseException:
        return False
    return phonenumbers.is_valid_number(n)


def split_name(full):
    if not full:
        return "", ""
    parts = str(full).strip().split()
    if len(parts) == 1:
        return parts[0], ""
    return parts[0], " ".join(parts[1:])


def build_notes(job_title, extra_phone_note=""):
    bits = []
    if job_title:
        bits.append(f"Job Title: {job_title}")
    if extra_phone_note:
        bits.append(extra_phone_note)
    return " | ".join(bits)


def cell(value):
    if value is None or value is False:
        return ""
    return str(value).strip()


def main():
    wb = openpyxl.load_workbook(SRC, read_only=True, data_only=True)
    ws = wb["All Contacts"]

    rows_in = 0
    rows_out = 0
    seen_email_phone = set()       # de-dupe on (email, phone)
    used_phones = set()            # phone -> already assigned to a contact
    invalid_phone_count = 0
    moved_to_notes_count = 0

    with DST.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=GHL_HEADERS)
        writer.writeheader()

        header = None
        for raw_row in ws.iter_rows(values_only=True):
            if header is None:
                header = [cell(c).lower() for c in raw_row]
                idx = {name: header.index(name) for name in [
                    "company", "full name", "job title", "email",
                    "phone", "city", "state", "industry",
                ]}
                continue

            if not raw_row or all(c is None or c == "" for c in raw_row):
                continue

            rows_in += 1

            company   = cell(raw_row[idx["company"]])
            full_name = cell(raw_row[idx["full name"]])
            job_title = cell(raw_row[idx["job title"]])
            email     = cell(raw_row[idx["email"]]).lower()
            phone_raw = clean_phone(raw_row[idx["phone"]])
            city      = cell(raw_row[idx["city"]])
            state     = cell(raw_row[idx["state"]])
            industry  = cell(raw_row[idx["industry"]])

            # Skip rows with no contact info at all
            if not email and not phone_raw and not full_name:
                continue

            # De-dupe identical contact rows
            dedupe_key = (email, phone_raw)
            if dedupe_key in seen_email_phone and (email or phone_raw):
                continue
            seen_email_phone.add(dedupe_key)

            # Decide where the phone goes:
            #   1. Invalid AU phone -> Notes (so the contact still imports).
            #   2. Already used by an earlier contact -> Notes (avoid GHL merge).
            #   3. Otherwise -> Phone column.
            phone_for_column = ""
            extra_phone_note = ""
            if phone_raw:
                if not is_valid_au_phone(phone_raw):
                    extra_phone_note = f"Phone (unparsed): {phone_raw}"
                    invalid_phone_count += 1
                elif phone_raw in used_phones:
                    extra_phone_note = f"Office Phone: {phone_raw}"
                    moved_to_notes_count += 1
                else:
                    phone_for_column = phone_raw
                    used_phones.add(phone_raw)

            first, last = split_name(full_name)

            writer.writerow({
                "Phone": phone_for_column,
                "Email": email,
                "Name": full_name,
                "First Name": first,
                "Last Name": last,
                "Business Name": company,
                "City": city,
                "State": state,
                "Source": "",
                "Additional Emails": "",
                "Additional Phones": "",
                "Notes": build_notes(job_title, extra_phone_note),
                "Tags": industry,
            })
            rows_out += 1

    print(f"Read  : {rows_in} rows from 'All Contacts'")
    print(f"Wrote : {rows_out} rows to {DST.name}")
    print(f"Skipped (exact dupes/empty) : {rows_in - rows_out}")
    print(f"Phones in Phone column      : {len(used_phones)}")
    print(f"Phones moved to Notes (shared): {moved_to_notes_count}")
    print(f"Phones moved to Notes (invalid): {invalid_phone_count}")


if __name__ == "__main__":
    main()
