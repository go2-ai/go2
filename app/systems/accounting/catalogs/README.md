# Accounting Catalogs

Starter charts of accounts that the AI proposal system uses as a base.

A catalog is a **base** — a set of ledgers and accounts that is generally
applicable to a certain kind of business. The AI never emits a full chart
from scratch; it selects one catalog and applies a small diff on top
(add/rename/remove specific ledgers and accounts). This keeps every
proposal structurally valid by construction.

## Files

One YAML file per catalog. The filename (minus `.yml`) must equal the
catalog's `key` field. `Accounting::Catalogs.available` returns the
sorted list of keys found in this directory.

## Schema

```yaml
key: <string>                 # must match the filename without .yml
label:
  en: <string>
  fa: <string>
description:
  en: <string>
  fa: <string>

categories: []                # reserved for v2 — must be empty for now

ledgers:
  - category: <identifier>    # one of CA LA CL LL OE RE EX CO ME
    code: <string>            # suffix only — must be exactly `ledger_length`
                              # characters long (from accounting_setting)
    name:
      en: <string>
      fa: <string>
    unexpected_balance: accept | warn | disallow
    is_monetary: true | false # only meaningful on balance-sheet categories
                              # (CA, LA, CL, LL, OE); ignored elsewhere

accounts:
  - ledger: <identifier>.<ledger_code>   # e.g. "CA.10"
    code: <string>                        # suffix only — must be exactly
                                          # `account_length` characters long
    name:
      en: <string>
      fa: <string>
    accepts_other_currencies: true | false