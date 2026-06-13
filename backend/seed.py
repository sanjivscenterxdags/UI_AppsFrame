"""
Idempotent database seed script.

Safe to run multiple times — uses upsert-style logic (lookup then insert).
Does NOT drop tables; add new records only if they don't already exist.

Run:
    cd backend
    source ../appsFrame/bin/activate
    python seed.py
"""

import json
import uuid

from passlib.context import CryptContext

from app.database import SessionLocal, Base, engine
from app.models.agent import ExpertAgent, SubAgent
from app.models.log import SystemLog
from app.models.user import User

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def _get_or_create(db, model, lookup_kwargs, create_kwargs):
    """Return existing record or create it. Returns (instance, created: bool)."""
    instance = db.query(model).filter_by(**lookup_kwargs).first()
    if instance:
        return instance, False
    instance = model(**lookup_kwargs, **create_kwargs)
    db.add(instance)
    return instance, True


def _migrate_add_column_if_missing(column: str, table: str, definition: str) -> None:
    """SQLite doesn't support IF NOT EXISTS on ALTER TABLE — check first."""
    with engine.connect() as conn:
        cols = [row[1] for row in conn.execute(
            __import__("sqlalchemy").text(f"PRAGMA table_info({table})")
        ).fetchall()]
        if column not in cols:
            conn.execute(__import__("sqlalchemy").text(
                f"ALTER TABLE {table} ADD COLUMN {column} {definition}"
            ))
            conn.commit()
            print(f"  [m] Added column {table}.{column}")


def seed_database():
    Base.metadata.create_all(bind=engine)

    # One-time schema migrations for columns added after initial release
    # SQLite cannot ADD COLUMN with UNIQUE — add plain then create index separately

    # --- Iteration 2: sub_agents.code_name ---
    _migrate_add_column_if_missing("code_name", "sub_agents", "VARCHAR")
    with engine.connect() as conn:
        indexes = [row[1] for row in conn.execute(
            __import__("sqlalchemy").text("PRAGMA index_list(sub_agents)")
        ).fetchall()]
        if "ix_sub_agents_code_name" not in indexes:
            conn.execute(__import__("sqlalchemy").text(
                "CREATE UNIQUE INDEX ix_sub_agents_code_name ON sub_agents (code_name)"
            ))
            conn.commit()

    # --- Iteration 3: users new columns ---
    _migrate_add_column_if_missing("is_active",    "users", "BOOLEAN NOT NULL DEFAULT 1")
    _migrate_add_column_if_missing("corporate_id", "users", "VARCHAR")
    _migrate_add_column_if_missing("uid",          "users", "VARCHAR")

    # Back-fill uid for any existing users that have NULL uid
    import sqlalchemy as _sa
    with engine.connect() as conn:
        rows = conn.execute(_sa.text("SELECT id FROM users WHERE uid IS NULL")).fetchall()
        for row in rows:
            conn.execute(_sa.text("UPDATE users SET uid=:u WHERE id=:id"),
                         {"u": uuid.uuid4().hex[:8], "id": row[0]})
        if rows:
            conn.commit()
            print(f"  [m] Back-filled uid for {len(rows)} existing user(s)")

    # Unique index on uid
    with engine.connect() as conn:
        idxs = [r[1] for r in conn.execute(_sa.text("PRAGMA index_list(users)")).fetchall()]
        if "ix_users_uid" not in idxs:
            conn.execute(_sa.text("CREATE UNIQUE INDEX ix_users_uid ON users (uid)"))
            conn.commit()
            print("  [m] Created unique index ix_users_uid")

    db = SessionLocal()
    try:
        # ── Admin user (legacy — TODO: remove after mike.k confirmed working) ─
        # SPEC requires no non-name users. Kept for backward compat during migration.
        admin, created = _get_or_create(
            db, User,
            lookup_kwargs={"username": "admin"},
            create_kwargs={
                "email": "admin@localhost",
                "hashed_password": pwd_context.hash("admin"),
                "role": "admin",
                "is_active": True,
                "uid": uuid.uuid4().hex[:8],
            },
        )
        if created:
            print("  [+] admin user created")
        else:
            print("  [=] admin user already exists")

        # ── mike.k — Mike King — superuser ───────────────────────────────────
        mike, created = _get_or_create(
            db, User,
            lookup_kwargs={"username": "mike.k"},
            create_kwargs={
                "email": "mike.king@cdags.local",
                "hashed_password": pwd_context.hash("Admin1234!"),
                "role": "superuser",
                "is_active": True,
                "corporate_id": None,
                "uid": uuid.uuid4().hex[:8],
            },
        )
        if created:
            print("  [+] mike.k (superuser) created")
        else:
            print("  [=] mike.k already exists")

        # ── Expert Agents ───────────────────────────────────────────────────
        expert_agent_defs = [
            ("UI Color Palate Manager",                  "ui_color_palate_manager",                  "#334155"),
            ("OT Plant Data Manager",                    "ot_plant_data_manager",                    "#1e3a8a"),
            ("OT Plant Asset Register Manager",          "ot_plant_asset_register_manager",          "#0f766e"),
            ("OT Plant Asset Risk Register Manager",     "ot_plant_asset_risk_register_manager",     "#15803d"),
            ("OT Plant Change Management Manager",       "ot_plant_change_management_manager",       "#991b1b"),
            ("OT Plant Logging & Monitoring Manager",    "ot_plant_logging_monitoring_manager",      "#b45309"),
            ("OT Plant Security Incident Manager",       "ot_plant_security_incident_manager",       "#4338ca"),
            ("OT Plant Analytics & Report Manager",      "ot_plant_analytics_report_manager",        "#0369a1"),
        ]

        expert_agents: dict[str, ExpertAgent] = {}
        for name, code_name, color in expert_agent_defs:
            # Look up by code_name first; fall back to name for rows seeded before code_name existed.
            agent = db.query(ExpertAgent).filter_by(code_name=code_name).first() \
                 or db.query(ExpertAgent).filter_by(name=name).first()
            if agent:
                if not agent.code_name:
                    agent.code_name = code_name  # back-fill missing code_name
                created = False
            else:
                agent = ExpertAgent(
                    name=name,
                    code_name=code_name,
                    description=f"Domain expert for handling {name.replace(' Manager', '')}",
                    color_theme=color,
                    is_active=True,
                )
                db.add(agent)
                created = True
            expert_agents[code_name] = agent
            print(f"  {'[+]' if created else '[=]'} ExpertAgent: {name}")

        db.flush()  # populate PKs before building sub-agent mappings

        # ── Sub-Agents ──────────────────────────────────────────────────────
        sub_agent_defs = [
            ("Email Agent",               "email_agent",               "CAG", "Sends email notifications on behalf of Expert Agents"),
            ("Alert Notification Agent",  "alert_notification_agent",  "CAG", "Broadcasts real-time alerts to configured channels"),
            ("Trouble Ticket Agent",      "trouble_ticket_agent",      "CAG", "Creates and tracks trouble tickets in external systems"),
            ("Modbus Protocol Agent",     "modbus_protocol_agent",     "SAG", "Reads and writes OT device registers via Modbus TCP/RTU"),
            ("Safety Compliance Agent",   "safety_compliance_agent",   "SAG", "Validates asset state against safety compliance rules"),
        ]

        sub_agents: dict[str, SubAgent] = {}
        for name, code_name, group_type, description in sub_agent_defs:
            agent, created = _get_or_create(
                db, SubAgent,
                lookup_kwargs={"code_name": code_name},
                create_kwargs={
                    "name": name,
                    "description": description,
                    "group_type": group_type,
                },
            )
            sub_agents[code_name] = agent
            print(f"  {'[+]' if created else '[=]'} SubAgent ({group_type}): {name}")

        db.flush()

        # ── SAG Mappings ─────────────────────────────────────────────────────
        # CAG sub-agents are implicitly available to all — no mapping rows needed.
        # SAG sub-agents require explicit authorization entries.
        sag_mappings = [
            ("ot_plant_data_manager",           "modbus_protocol_agent"),
            ("ot_plant_asset_register_manager", "safety_compliance_agent"),
        ]

        for expert_code, sub_code in sag_mappings:
            expert = expert_agents[expert_code]
            sub = sub_agents[sub_code]
            if sub not in expert.specific_sub_agents:
                expert.specific_sub_agents.append(sub)
                print(f"  [+] SAG mapping: {expert_code} → {sub_code}")
            else:
                print(f"  [=] SAG mapping already exists: {expert_code} → {sub_code}")

        # ── Seed log entry (one per run, idempotent) ────────────────────────
        existing_seed_log = db.query(SystemLog).filter(
            SystemLog.source == "SYSTEM",
            SystemLog.message == "Database seed completed.",
        ).first()
        if not existing_seed_log:
            db.add(SystemLog(
                level="INFO",
                source="SYSTEM",
                message="Database seed completed.",
                metadata_json=json.dumps({
                    "expert_agents": len(expert_agent_defs),
                    "sub_agents": len(sub_agent_defs),
                    "sag_mappings": len(sag_mappings),
                }),
            ))

        db.commit()
        print("\nSeed complete.")

    except Exception as e:
        db.rollback()
        print(f"Seed error: {e}")
        raise

    finally:
        db.close()


if __name__ == "__main__":
    seed_database()
