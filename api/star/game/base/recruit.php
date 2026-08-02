<?php
require_once __DIR__ . '/../../bootstrap.php';
require_once __DIR__ . '/../../config.php';
method('POST');

$jwt      = auth();
$playerId = (int)$jwt['sub'];
$b        = body();
$planetId = (int)($b['planetId'] ?? 0);
if (!$planetId) fail('planetId required');

$db = getDB();

// Verify ownership
$own = $db->prepare(
    'SELECT p.type FROM hs_planet_ownership po JOIN hs_planets p ON p.id=po.planet_id
     WHERE po.planet_id=? AND po.player_id=?'
);
$own->execute([$planetId, $playerId]);
$planet = $own->fetch();
if (!$planet) fail('Planet not found or not owned', 404);

resolve_timers($db, $planetId, $playerId);
compute_resources($db, $planetId, $playerId, $planet['type']);

ensure_recruit_pool($db, $planetId, $playerId);

// Compute the live pool, then move one recruit into the population if available.
$row = $db->prepare(
    'SELECT pool, TIMESTAMPDIFF(SECOND, pool_updated_at, NOW()) AS elapsed
     FROM hs_recruit_pool WHERE planet_id=? AND player_id=?'
);
$row->execute([$planetId, $playerId]);
$r    = $row->fetch();
$live = min(RECRUIT_POOL_MAX, (float)$r['pool'] + recruit_growth_per_hour() * ((int)$r['elapsed'] / 3600.0));

$gained = 0;
if ($live >= 1) {
    $newPool = $live - 1;
    $db->prepare(
        'UPDATE hs_recruit_pool SET pool=?, pool_updated_at=NOW()
         WHERE planet_id=? AND player_id=?'
    )->execute([$newPool, $planetId, $playerId]);
    $db->prepare(
        'UPDATE hs_planet_resources SET population = population + 1
         WHERE planet_id=? AND player_id=?'
    )->execute([$planetId, $playerId]);
    $gained = 1;
}

$popRow = $db->prepare('SELECT population FROM hs_planet_resources WHERE planet_id=? AND player_id=?');
$popRow->execute([$planetId, $playerId]);
$pop = (float)$popRow->fetchColumn();

ok(array_merge(recruit_state($db, $planetId, $playerId), [
    'population' => $pop,
    'gained'     => $gained,
]));
