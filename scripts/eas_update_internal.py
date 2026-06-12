#!/usr/bin/env python3
"""Publish an Expo EAS Update to the internal update branch.

This only publishes JavaScript/assets OTA updates. It does not create a new
native binary, so the installed app must have been built with a matching EAS
Update channel/runtime version.
"""

from __future__ import annotations

import argparse
import json
import os
import shlex
import shutil
import subprocess
import sys
from datetime import datetime
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
APP_JSON = ROOT / "app.json"
EAS_JSON = ROOT / "eas.json"


def load_json(path: Path) -> dict:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError:
        raise SystemExit(f"Missing required file: {path}")
    except json.JSONDecodeError as exc:
        raise SystemExit(f"Invalid JSON in {path}: {exc}")


def resolve_eas_command() -> list[str]:
    eas = shutil.which("eas")
    if eas:
        return [eas]

    npx = shutil.which("npx")
    if npx:
        return [npx, "eas-cli"]

    raise SystemExit(
        "Could not find 'eas' or 'npx' on PATH. Install Node.js and EAS CLI, "
        "then run: npm install -g eas-cli"
    )


def validate_config(branch: str) -> None:
    app = load_json(APP_JSON)
    eas = load_json(EAS_JSON)

    expo = app.get("expo", {})
    project_id = (
        expo.get("extra", {})
        .get("eas", {})
        .get("projectId")
    )
    updates_url = expo.get("updates", {}).get("url")
    runtime_version = expo.get("runtimeVersion")
    build_profiles = eas.get("build", {})
    matching_channels = [
        name
        for name, profile in build_profiles.items()
        if isinstance(profile, dict) and profile.get("channel") == branch
    ]

    errors: list[str] = []
    if not project_id:
        errors.append("app.json: expo.extra.eas.projectId is missing")
    if not updates_url:
        errors.append("app.json: expo.updates.url is missing")
    if not runtime_version:
        errors.append("app.json: expo.runtimeVersion is missing")
    if not matching_channels:
        errors.append(f"eas.json: no build profile uses channel '{branch}'")

    if errors:
        raise SystemExit(
            "EAS Update config is incomplete:\n- "
            + "\n- ".join(errors)
            + "\nRun 'eas update:configure' or update app.json/eas.json first."
        )


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Publish an Expo OTA update to the internal EAS branch."
    )
    parser.add_argument(
        "message",
        nargs="?",
        default=None,
        help="Update message. Defaults to an internal timestamp message.",
    )
    parser.add_argument(
        "--branch",
        default="internal",
        help="EAS Update branch/channel to publish to. Default: internal",
    )
    parser.add_argument(
        "--platform",
        choices=("all", "android", "ios"),
        default="all",
        help="Target platform for the update. Default: all",
    )
    parser.add_argument(
        "--interactive",
        action="store_true",
        help="Allow EAS CLI prompts. Default is non-interactive.",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Print the command without executing it.",
    )
    parser.add_argument(
        "--skip-config-check",
        action="store_true",
        help="Skip local app.json/eas.json EAS Update validation.",
    )
    return parser


def main() -> int:
    args = build_parser().parse_args()

    if not args.skip_config_check:
        validate_config(args.branch)

    message = args.message or f"internal update {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}"
    cmd = [
        *resolve_eas_command(),
        "update",
        "--branch",
        args.branch,
        "--platform",
        args.platform,
        "--message",
        message,
    ]
    if not args.interactive:
        cmd.append("--non-interactive")

    printable = " ".join(shlex.quote(part) for part in cmd)
    print(f"Publishing EAS Update from {ROOT}")
    print(f"Command: {printable}")

    if args.dry_run:
        return 0

    env = os.environ.copy()
    if not args.interactive:
        env.setdefault("CI", "1")

    completed = subprocess.run(cmd, cwd=ROOT, env=env, check=False)
    return completed.returncode


if __name__ == "__main__":
    raise SystemExit(main())
