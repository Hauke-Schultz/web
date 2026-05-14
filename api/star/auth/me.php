<?php
require_once __DIR__ . '/../bootstrap.php';
method('GET');

$jwt    = auth();
$db     = getDB();
$stmt   = $db->prepare(
    'SELECT id, username, email, portrait, disposition FROM hs_players WHERE id=?'
);
$stmt->execute([$jwt['sub']]);
$player = $stmt->fetch();
if (!$player) fail('Player not found', 404);

$home = $db->prepare(
    'SELECT planet_id FROM hs_planet_ownership WHERE player_id=? AND is_home=1'
);
$home->execute([$jwt['sub']]);
$homePlanetId = (int)($home->fetchColumn() ?: 0);

$db->prepare('UPDATE hs_players SET last_seen_at=NOW() WHERE id=?')->execute([$jwt['sub']]);

ok(['player' => $player, 'homePlanetId' => $homePlanetId]);
