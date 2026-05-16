<?php
require_once __DIR__ . '/../bootstrap.php';
method('POST');

$jwt        = auth();
$playerId   = (int)$jwt['sub'];
$b          = body();
$systemId   = (int)($b['systemId']    ?? 0);
$messageKeys = $b['messageKeys'] ?? [];

if (!$systemId) fail('systemId required');
if (!is_array($messageKeys) || count($messageKeys) === 0) fail('messageKeys required');
if (count($messageKeys) > 5) fail('Max 5 emojis per message');

$normalise   = fn(string $s) => preg_replace('/[\x{FE00}-\x{FE0F}]/u', '', $s);
$allowedBase = array_map($normalise, [
  '👋','🤝','✌️','🫡','👍','👎','🖖',
  '👏','🙏','✋','🫶','🤜','🤛','💪',
  '😊','🥰','😘','💋','😂','😭',
  '🤯','😤','😱','🤔','😎','🤩','😇',
  '❤️','💛','💚','🖤','🎉','📢','🎵',
  '💘','🔥','💫','🙈','🙉','🙊','☎️',
  '💡','💊','🏆️','🎁',
  '🌟','🕊️','💎','🛸','👽️',
  '🚀','💰','🌈','🌿','🪐',
  '⚠️','🛑','☠️','⚔️','🛡️','💯',
  '💨','💦','💥','🧠','🦄','🦖',
  '🍆','🍌','🍑','🥦','🥒','🧊',
  '🌍️','🌋','🌊','☃️','🔥','⚡️',
  '☄️',
  '😶‍🌫️','💩','😡','🤬','🤡','🐀','🦠',
  '🗑️','💣','😈','🤮','⚠️','⛔️','☢️',
  '❗️','⁉️','❓️','✅️','🆗','🚩','🔎',
]);
foreach ($messageKeys as $key) {
    if (!in_array($normalise((string)$key), $allowedBase, true)) fail('Invalid emoji');
}

$messageKey = implode(' ', $messageKeys);

$db = getDB();

// Check interstellar_comm >= 1
$icRow = $db->prepare("SELECT level FROM hs_global_research WHERE player_id=? AND building_key='interstellar_comm'");
$icRow->execute([$playerId]);
$icLevel = (int)($icRow->fetchColumn() ?: 0);
if ($icLevel < 1) fail('Requires Interstellar Comm Lv1', 403);

// Check system is scanned
$contactRow = $db->prepare("SELECT scan_state FROM hs_system_contacts WHERE player_id=? AND system_id=?");
$contactRow->execute([$playerId, $systemId]);
$contact = $contactRow->fetch();
if (!$contact || $contact['scan_state'] !== 'scanned') fail('System not scanned', 403);

// Home system position
$homeRow = $db->prepare(
    'SELECT s.x, s.y FROM hs_planet_ownership po
     JOIN hs_planets p ON p.id = po.planet_id
     JOIN hs_star_systems s ON s.id = p.system_id
     WHERE po.player_id=? AND po.is_home=1 LIMIT 1'
);
$homeRow->execute([$playerId]);
$home = $homeRow->fetch();

$targetRow = $db->prepare('SELECT x, y FROM hs_star_systems WHERE id=?');
$targetRow->execute([$systemId]);
$target = $targetRow->fetch();

if (!$home || !$target) fail('System position unavailable', 500);

$dist      = sqrt(pow((float)$target['x'] - (float)$home['x'], 2) + pow((float)$target['y'] - (float)$home['y'], 2));
$factor    = $icLevel >= 2 ? 0.5 : 1.0;
$travelSec = max(10, (int)round($dist * $factor));

$db->prepare(
    "INSERT INTO hs_comm_log (player_id, system_id, direction, message_key, travel_ends_at)
     VALUES (?,?,'sent',?, DATE_ADD(NOW(), INTERVAL ? SECOND))"
)->execute([$playerId, $systemId, $messageKey, $travelSec]);

$msgId     = (int)$db->lastInsertId();
$endsAtRow = $db->prepare('SELECT travel_ends_at FROM hs_comm_log WHERE id=?');
$endsAtRow->execute([$msgId]);
$endsAtVal = $endsAtRow->fetchColumn();

// Keep only last 10 rows per (player_id, system_id)
$db->prepare(
    "DELETE FROM hs_comm_log
     WHERE player_id = ? AND system_id = ?
     AND id NOT IN (
       SELECT id FROM (
         SELECT id FROM hs_comm_log
         WHERE player_id = ? AND system_id = ?
         ORDER BY created_at DESC
         LIMIT 10
       ) AS recent
     )"
)->execute([$playerId, $systemId, $playerId, $systemId]);

ok(['messageId' => $msgId, 'travelEndsAt' => strtotime($endsAtVal) * 1000]);
