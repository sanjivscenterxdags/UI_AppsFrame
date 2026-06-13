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

    db = SessionLocal()
    try:
        # ── Admin user ──────────────────────────────────────────────────────
        admin, created = _get_or_create(
            db, User,
            lookup_kwargs={"username": "admin"},
            create_kwargs={
                "email": "admin@localhost",
                "hashed_password": pwd_context.hash("admin"),
                "role": "admin",
            },
        )
        if created:
            print("  [+] admin user created")
        else:
            print("  [=] admin user already exists")

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

        # ── Seed log entry ──────────────────────────────────────────────────
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
