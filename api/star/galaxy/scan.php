<?php
require_once __DIR__ . '/../bootstrap.php';
require_once __DIR__ . '/../config.php';
method('POST');

$jwt      = auth();
$playerId = (int)$jwt['sub'];
$b        = body();
$systemId = (int)($b['systemId'] ?? 0);

if (!$systemId) fail('systemId required');

$db = getDB();

// Resolve any completed scans first
resolve_system_contacts($db, $playerId);

// Check star_map >= 3
$smRow = $db->prepare("SELECT level FROM hs_global_research WHERE player_id=? AND building_key='star_map'");
$smRow->execute([$playerId]);
$smLevel = (int)($smRow->fetchColumn() ?: 0);
if ($smLevel < 3) fail('Requires Star Map Lv3', 403);

// Check target system exists
$sysRow = $db->prepare('SELECT id, x, y FROM hs_star_systems WHERE id=?');
$sysRow->execute([$systemId]);
$targetSys = $sysRow->fetch();
if (!$targetSys) fail('System not found', 404);

// Check not already scanning (one at a time)
$scanning = $db->prepare("SELECT COUNT(*) FROM hs_system_contacts WHERE player_id=? AND scan_state='scanning'");
$scanning->execute([$playerId]);
if ((int)$scanning->fetchColumn() > 0) fail('A scan is already in progress', 409);

// Check not already scanned
$existing = $db->prepare('SELECT scan_state FROM hs_system_contacts WHERE player_id=? AND system_id=?');
$existing->execute([$playerId, $systemId]);
$contact = $existing->fetch();
if ($contact && $contact['scan_state'] === 'scanned') fail('System already scanned', 409);

// Get home system position
$homeRow = $db->prepare(
    'SELECT s.x, s.y FROM hs_planet_ownership po
     JOIN hs_planets p ON p.id = po.planet_id
     JOIN hs_star_systems s ON s.id = p.system_id
     WHERE po.player_id=? AND po.is_home=1 LIMIT 1'
);
$homeRow->execute([$playerId]);
$home = $homeRow->fetch();
if (!$home) fail('Home system not found', 500);

// Duration: max(7200, dist × 180) seconds
$dist     = sqrt(pow((float)$targetSys['x'] - (float)$home['x'], 2) + pow((float)$targetSys['y'] - (float)$home['y'], 2));
$duration = max(7200, (int)round($dist * 180));

$db->prepare(
    "INSERT INTO hs_system_contacts (player_id, system_id, scan_state, scan_ends_at)
     VALUES (?,?,'scanning', DATE_ADD(NOW(), INTERVAL ? SECOND))
     ON DUPLICATE KEY UPDATE scan_state='scanning', scan_ends_at=DATE_ADD(NOW(), INTERVAL ? SECOND)"
)->execute([$playerId, $systemId, $duration, $duration]);

$endsAtRow = $db->prepare('SELECT scan_ends_at FROM hs_system_contacts WHERE player_id=? AND system_id=?');
$endsAtRow->execute([$playerId, $systemId]);
$scanEndsAt = $endsAtRow->fetchColumn();

ok(['systemId' => $systemId, 'scanEndsAt' => strtotime($scanEndsAt) * 1000]);
