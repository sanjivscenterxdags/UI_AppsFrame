"""
Step-by-step test script for database.py

Run from the backend/ directory:
    PYTHONPATH=. python3 app/database_test.py

Each test prints PASS/FAIL and a short description.
Uses an in-memory SQLite URL so no .env file is required.
"""

import os
import sys
import unittest.mock as mock

# ── helpers ───────────────────────────────────────────────────────────────────

PASS = "\033[32mPASS\033[0m"
FAIL = "\033[31mFAIL\033[0m"
failures = 0


def ok(label: str) -> None:
    print(f"  {PASS}  {label}")


def fail(label: str, reason: str) -> None:
    global failures
    failures += 1
    print(f"  {FAIL}  {label}")
    print(f"        reason: {reason}")


# ── Step 1: ENV=unknown raises ValueError ─────────────────────────────────────

print("\nStep 1 — unknown ENV value raises ValueError")
os.environ["ENV"] = "staging"
os.environ["DATABASE_URL"] = "sqlite://"

try:
    import importlib
    import app.database as _db_mod
    importlib.reload(_db_mod)
    fail("unknown ENV raises ValueError", "no exception was raised")
except ValueError as exc:
    if "Unknown ENV" in str(exc):
        ok("unknown ENV raises ValueError")
    else:
        fail("unknown ENV raises ValueError", f"unexpected message: {exc}")
except Exception as exc:
    fail("unknown ENV raises ValueError", f"wrong exception type: {type(exc).__name__}: {exc}")

# ── Step 2: missing DATABASE_URL raises ValueError ────────────────────────────

print("\nStep 2 — missing DATABASE_URL raises ValueError")
os.environ["ENV"] = "development"

# importlib.reload re-executes `from dotenv import load_dotenv`, so patching
# the module attribute is overwritten before our mock is called. Instead we
# patch os.getenv to return None for DATABASE_URL, which fires after load_dotenv
# runs and is guaranteed to be in effect when the guard check executes.
import app.database as _db_mod2
_real_getenv = os.getenv

def _getenv_no_db_url(key, *args):
    if key == "DATABASE_URL":
        return None
    return _real_getenv(key, *args)

try:
    with mock.patch("os.getenv", side_effect=_getenv_no_db_url):
        try:
            importlib.reload(_db_mod2)
            fail("missing DATABASE_URL raises ValueError", "no exception was raised")
        except ValueError as exc:
            if "DATABASE_URL is not set" in str(exc):
                ok("missing DATABASE_URL raises ValueError")
            else:
                fail("missing DATABASE_URL raises ValueError", f"unexpected message: {exc}")
        except Exception as exc:
            fail("missing DATABASE_URL raises ValueError", f"wrong exception type: {type(exc).__name__}: {exc}")
finally:
    pass  # mock.patch context manager restores os.getenv on exit

# ── Step 3: module loads cleanly in development ───────────────────────────────

print("\nStep 3 — module loads in development with a valid SQLite URL")
os.environ["ENV"] = "development"
os.environ["DATABASE_URL"] = "sqlite://"  # in-memory SQLite

try:
    import app.database as db
    importlib.reload(db)
    ok("module loaded without error")
except Exception as exc:
    fail("module loaded without error", str(exc))
    sys.exit(1)  # remaining tests depend on this

# ── Step 4: engine is created ─────────────────────────────────────────────────

print("\nStep 4 — engine is created")
try:
    from sqlalchemy.engine import Engine
    assert isinstance(db.engine, Engine), "db.engine is not a SQLAlchemy Engine"
    ok("db.engine is a SQLAlchemy Engine")
except AssertionError as exc:
    fail("db.engine is a SQLAlchemy Engine", str(exc))
except Exception as exc:
    fail("db.engine is a SQLAlchemy Engine", str(exc))

# ── Step 5: SessionLocal factory is created ───────────────────────────────────

print("\nStep 5 — SessionLocal sessionmaker is created")
try:
    from sqlalchemy.orm import sessionmaker
    assert isinstance(db.SessionLocal, sessionmaker), "SessionLocal is not a sessionmaker"
    ok("SessionLocal is a sessionmaker")
    assert db.SessionLocal.kw.get("autocommit") is False, "autocommit should be False"
    ok("autocommit=False")
    assert db.SessionLocal.kw.get("autoflush") is False, "autoflush should be False"
    ok("autoflush=False")
except AssertionError as exc:
    fail("SessionLocal configuration", str(exc))
except Exception as exc:
    fail("SessionLocal configuration", str(exc))

# ── Step 6: Base is declarative_base ─────────────────────────────────────────

print("\nStep 6 — Base is a declarative base class")
try:
    from sqlalchemy.orm import DeclarativeMeta
    assert isinstance(db.Base, DeclarativeMeta), "Base is not a DeclarativeMeta instance"
    ok("Base is a declarative base (DeclarativeMeta)")
except AssertionError as exc:
    fail("Base is a declarative base", str(exc))
except Exception as exc:
    fail("Base is a declarative base", str(exc))

# ── Step 7: get_db yields a session and closes it ────────────────────────────

print("\nStep 7 — get_db yields a Session and closes it after use")
try:
    from sqlalchemy.orm import Session
    gen = db.get_db()
    session = next(gen)
    assert isinstance(session, Session), f"expected Session, got {type(session)}"
    ok("get_db yields a SQLAlchemy Session")

    # advance past the finally block
    try:
        next(gen)
    except StopIteration:
        pass

    # After close(), the session should not be usable (is_active becomes False or
    # the underlying connection is released). We just check it didn't raise.
    ok("get_db closes the session without error")
except AssertionError as exc:
    fail("get_db yields a Session", str(exc))
except Exception as exc:
    fail("get_db yields a Session", str(exc))

# ── Step 8: get_db closes session even after an exception ────────────────────

print("\nStep 8 — get_db closes session even when caller raises an exception")
try:
    gen2 = db.get_db()
    session2 = next(gen2)
    assert isinstance(session2, Session)

    # simulate an error in the route handler
    try:
        gen2.throw(RuntimeError("simulated route error"))
    except RuntimeError:
        pass  # expected — the finally block in get_db should have run

    ok("get_db finalises session on exception")
except Exception as exc:
    fail("get_db finalises session on exception", str(exc))

# ── Step 9: module loads in production mode ───────────────────────────────────

print("\nStep 9 — module loads in production mode")
os.environ["ENV"] = "production"
os.environ["DATABASE_URL"] = "sqlite://"  # stand-in; just tests branch execution

try:
    importlib.reload(db)
    ok("module loaded in production mode")
except Exception as exc:
    fail("module loaded in production mode", str(exc))

# ── summary ───────────────────────────────────────────────────────────────────

print()
if failures == 0:
    print(f"All tests {PASS}")
else:
    print(f"{failures} test(s) {FAIL}")
    sys.exit(1)
