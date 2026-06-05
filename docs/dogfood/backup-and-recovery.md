# Dogfood Backup And Recovery

The dogfood milestone stores its SQLite database in the normal Tauri
application-data directory as `taskline.sqlite3`. Automatic backups and a
recovery UI are intentionally deferred, so manually protect important dogfood
data.

## Manual Backup

1. Quit Taskline completely.
2. Find the application-data directory for identifier `dev.taskline.desktop`.
3. Copy `taskline.sqlite3` to a dated backup location.
4. Keep the original database and backup until the replacement is verified.

Do not copy a database while Taskline is running. SQLite uses WAL mode and a
live copy may omit recent transactions.

## Recovery

1. Quit Taskline.
2. Preserve the unreadable database by renaming it; never delete it first.
3. Copy a known-good backup into the application-data directory using the name
   `taskline.sqlite3`.
4. Start Taskline and verify several tasks, entries, and revisions.

The application intentionally fails to open an unreadable database rather than
silently replacing it with an empty one.
