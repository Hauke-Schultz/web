<?php
/**
 * Einmaliges Setup-Script:
 * - Legt die MySQL-Tabellen an (falls nicht vorhanden)
 * - Importiert das Backup aus party-backup-*.json
 *
 * Aufruf: http://localhost:8000/api/setup.php
 * Danach dieses Script löschen oder umbenennen!
 */

header('Content-Type: text/plain; charset=utf-8');

require_once __DIR__ . '/db.php';

$db = getDB();

// ── Tabellen anlegen ──────────────────────────────────────────────────────────

$db->exec("
CREATE TABLE IF NOT EXISTS rsvps (
  guest_id         VARCHAR(36)  NOT NULL PRIMARY KEY,
  name             VARCHAR(50)  NOT NULL,
  status           ENUM('pending','accepted','declined') NOT NULL DEFAULT 'pending',
  number_of_guests TINYINT UNSIGNED NOT NULL DEFAULT 1,
  coming_by_car    TINYINT(1)   NOT NULL DEFAULT 0,
  needs_parking    TINYINT(1)   NOT NULL DEFAULT 0,
  needs_hotel_room TINYINT(1)   NOT NULL DEFAULT 0,
  number_of_rooms  TINYINT UNSIGNED NOT NULL DEFAULT 1,
  food_preferences JSON         NOT NULL,
  remarks          TEXT         NOT NULL,
  last_updated     DATETIME     NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
");
echo "✓ Tabelle rsvps OK\n";

$db->exec("
CREATE TABLE IF NOT EXISTS highscores (
  player_id VARCHAR(36) NOT NULL PRIMARY KEY,
  name      VARCHAR(20) NOT NULL,
  level     INT UNSIGNED NOT NULL DEFAULT 0,
  game_date DATE        NOT NULL,
  emoji     VARCHAR(50) NOT NULL DEFAULT '',
  status    ENUM('normal','underReview','disqualified') NOT NULL DEFAULT 'normal',
  `rank`    SMALLINT UNSIGNED NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
");
echo "✓ Tabelle highscores OK\n\n";

// ── Backup-Datei laden ────────────────────────────────────────────────────────

$backupFile = null;
foreach (glob(__DIR__ . '/party-backup-*.json') as $f) {
    $backupFile = $f;
}

if (!$backupFile) {
    echo "✗ Keine party-backup-*.json gefunden – nur Tabellen angelegt.\n";
    exit();
}

echo "Lade Backup: " . basename($backupFile) . "\n\n";
$backup = json_decode(file_get_contents($backupFile), true);

// ── RSVPs importieren ─────────────────────────────────────────────────────────

$stmtRsvp = $db->prepare("
    INSERT INTO rsvps
        (guest_id, name, status, number_of_guests, coming_by_car, needs_parking,
         needs_hotel_room, number_of_rooms, food_preferences, remarks, last_updated)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
        name             = VALUES(name),
        status           = VALUES(status),
        number_of_guests = VALUES(number_of_guests),
        coming_by_car    = VALUES(coming_by_car),
        needs_parking    = VALUES(needs_parking),
        needs_hotel_room = VALUES(needs_hotel_room),
        number_of_rooms  = VALUES(number_of_rooms),
        food_preferences = VALUES(food_preferences),
        remarks          = VALUES(remarks),
        last_updated     = VALUES(last_updated)
");

$rsvpCount = 0;
foreach ($backup['rsvps'] ?? [] as $r) {
    $prefs = $r['foodPreferences'] ?? ($r['foodPreference'] ? [$r['foodPreference']] : []);
    $stmtRsvp->execute([
        $r['guestId'],
        $r['name'],
        $r['status'],
        $r['numberOfGuests'] ?? 1,
        (int)($r['comingByCar'] ?? false),
        (int)($r['needsParking'] ?? false),
        (int)($r['needsHotelRoom'] ?? false),
        $r['numberOfRooms'] ?? 1,
        json_encode($prefs, JSON_UNESCAPED_UNICODE),
        $r['remarks'] ?? '',
        date('Y-m-d H:i:s', strtotime($r['lastUpdated'] ?? 'now')),
    ]);
    $rsvpCount++;
}
echo "✓ $rsvpCount RSVPs importiert\n";

// ── Highscores importieren ────────────────────────────────────────────────────

$stmtHs = $db->prepare("
    INSERT INTO highscores (player_id, name, level, game_date, emoji, status, `rank`)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
        name      = VALUES(name),
        level     = VALUES(level),
        game_date = VALUES(game_date),
        emoji     = VALUES(emoji),
        status    = VALUES(status),
        `rank`    = VALUES(`rank`)
");

$hsCount = 0;
foreach ($backup['highscores'] ?? [] as $h) {
    $stmtHs->execute([
        $h['playerId'],
        $h['name'],
        $h['level'],
        $h['date'] ?? date('Y-m-d'),
        $h['emoji'] ?? '',
        $h['status'] ?? 'normal',
        $h['rank'] ?? 0,
    ]);
    $hsCount++;
}
echo "✓ $hsCount Highscores importiert\n\n";
echo "Setup abgeschlossen! Bitte setup.php löschen oder umbenennen.\n";
