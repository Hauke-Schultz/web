<?php
require_once __DIR__ . '/../bootstrap.php';
method('GET');

$jwt      = auth();
$playerId = (int)$jwt['sub'];
$db       = getDB();

$rows = $db->prepare(
    'SELECT m.id, m.type, m.from_planet_id, m.to_planet_id, m.ends_at,
            fp.name AS from_name, tp.name AS to_name
     FROM hs_missions m
     LEFT JOIN hs_planets fp ON fp.id = m.from_planet_id
     LEFT JOIN hs_planets tp ON tp.id = m.to_planet_id
     WHERE m.player_id=? AND m.status=\'in_flight\'
     ORDER BY m.ends_at ASC'
);
$rows->execute([$playerId]);

$missions = [];
foreach ($rows->fetchAll() as $m) {
    $missions[] = [
        'id'           => (int)$m['id'],
        'type'         => $m['type'],
        'fromPlanetId' => (int)$m['from_planet_id'],
        'toPlanetId'   => (int)$m['to_planet_id'],
        'fromName'     => $m['from_name'],
        'toName'       => $m['to_name'],
        'endsAt'       => strtotime($m['ends_at']) * 1000,
    ];
}

ok($missions);
