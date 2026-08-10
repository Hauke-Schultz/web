<?php
require_once __DIR__ . '/../../bootstrap.php';
require_once __DIR__ . '/../../config.php';
method('POST');

$jwt      = auth();
$playerId = (int)$jwt['sub'];
$b        = body();
$planetId = (int)($b['planetId'] ?? 0);
$choiceKey = trim($b['choice'] ?? '');
if (!$planetId)  fail('planetId required');
if ($choiceKey === '') fail('choice required');

$db = getDB();

// Verify ownership
$own = $db->prepare(
    'SELECT p.type FROM hs_planet_ownership po JOIN hs_planets p ON p.id=po.planet_id
     WHERE po.planet_id=? AND po.player_id=?'
);
$own->execute([$planetId, $playerId]);
$planet = $own->fetch();
if (!$planet) fail('Planet not found or not owned', 404);

// Settle everything pending first: the choice may cost resources, and the cost
// has to be checked against the up-to-date stock.
resolve_timers($db, $planetId, $playerId);
compute_resources($db, $planetId, $playerId, $planet['type']);

ensure_anomaly_table($db);

// Re-read the open anomaly from the DB rather than trusting the client — an
// expired or already-answered one must not pay out a second time.
$row = open_anomaly_row($db, $planetId, $playerId);
if (!$row) fail('No open anomaly on this planet');

$choices = json_decode($row['choices'], true) ?: [];
$choice  = null;
foreach ($choices as $c) {
    if (($c['key'] ?? null) === $choiceKey) { $choice = $c; break; }
}
if (!$choice) fail('Unknown choice');

// Claim the row before paying out. A second request now finds nothing open and
// bails above, so a double click cannot collect twice.
$claim = $db->prepare(
    'UPDATE hs_anomalies SET resolved_at=NOW(), resolved_choice=?
     WHERE id=? AND resolved_at IS NULL'
);
$claim->execute([$choiceKey, (int)$row['id']]);
if ($claim->rowCount() === 0) fail('Anomaly already resolved');

$missing = apply_anomaly_choice($db, $planetId, $playerId, $choice);
if ($missing !== null) {
    // Could not pay — hand the anomaly back so the other option stays open.
    $db->prepare(
        'UPDATE hs_anomalies SET resolved_at=NULL, resolved_choice=NULL WHERE id=?'
    )->execute([(int)$row['id']]);
    fail('Not enough ' . $missing);
}

$resources = $db->prepare('SELECT * FROM hs_planet_resources WHERE planet_id=? AND player_id=?');
$resources->execute([$planetId, $playerId]);
$res = $resources->fetch();
unset($res['planet_id'], $res['player_id'], $res['resources_computed_at']);

ok([
    'type'      => $row['type'],
    'choice'    => $choiceKey,
    'applied'   => $choice,
    'resources' => $res,
    'battery'   => battery_state($db, $planetId, $playerId),
    // Answering does not immediately re-roll: the next one is due after the
    // normal interval, so this is null right after a resolve.
    'anomaly'   => anomaly_state($db, $planetId, $playerId, $planet['type']),
]);
