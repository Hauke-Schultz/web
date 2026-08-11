<?php
require_once __DIR__ . '/../bootstrap.php';
require_once __DIR__ . '/../config.php';
method('POST');

$jwt      = auth();
$playerId = (int)$jwt['sub'];
$body     = body();
$action   = trim($body['action'] ?? '');
$planetId = (int)($body['planetId'] ?? 0);

$db = getDB();

switch ($action) {

    case 'complete_buildings':
        if (!$planetId) fail('planetId required');
        $own = $db->prepare('SELECT 1 FROM hs_planet_ownership WHERE planet_id=? AND player_id=?');
        $own->execute([$planetId, $playerId]);
        if (!$own->fetch()) fail('Planet not owned', 403);

        $db->prepare(
            "UPDATE hs_buildings SET build_ends_at = DATE_SUB(NOW(), INTERVAL 1 SECOND)
             WHERE planet_id=? AND player_id=? AND build_ends_at IS NOT NULL"
        )->execute([$planetId, $playerId]);

        resolve_buildings($db, $planetId, $playerId);
        ok(['action' => 'complete_buildings']);

    case 'drain_battery':
        if (!$planetId) fail('planetId required');
        $own = $db->prepare('SELECT 1 FROM hs_planet_ownership WHERE planet_id=? AND player_id=?');
        $own->execute([$planetId, $playerId]);
        if (!$own->fetch()) fail('Planet not owned', 403);

        ensure_power_battery($db, $planetId, $playerId);
        $db->prepare(
            'UPDATE hs_power_battery SET charge=0, charge_updated_at=NOW()
             WHERE planet_id=? AND player_id=?'
        )->execute([$planetId, $playerId]);
        ok(['action' => 'drain_battery']);

    case 'add_population':
        if (!$planetId) fail('planetId required');
        $own = $db->prepare('SELECT 1 FROM hs_planet_ownership WHERE planet_id=? AND player_id=?');
        $own->execute([$planetId, $playerId]);
        if (!$own->fetch()) fail('Planet not owned', 403);

        $db->prepare(
            'UPDATE hs_planet_resources SET population = population + 1
             WHERE planet_id=? AND player_id=?'
        )->execute([$planetId, $playerId]);
        ok(['action' => 'add_population']);

    case 'complete_research':
        $db->prepare(
            "UPDATE hs_global_research SET build_ends_at = DATE_SUB(NOW(), INTERVAL 1 SECOND)
             WHERE player_id=? AND build_ends_at IS NOT NULL"
        )->execute([$playerId]);

        resolve_global_research($db, $playerId);
        ok(['action' => 'complete_research']);

    case 'max_resources':
        if (!$planetId) fail('planetId required');
        $ownRow = $db->prepare(
            'SELECT p.type FROM hs_planet_ownership po JOIN hs_planets p ON p.id=po.planet_id
             WHERE po.planet_id=? AND po.player_id=?'
        );
        $ownRow->execute([$planetId, $playerId]);
        $planet = $ownRow->fetch();
        if (!$planet) fail('Planet not owned', 403);

        $caps = planet_storage_caps($db, $planetId, $playerId);
        if (empty($caps)) ok(['action' => 'max_resources', 'note' => 'no storage caps']);

        $sets = array_map(fn($r) => "$r = ?", array_keys($caps));
        $db->prepare(
            'UPDATE hs_planet_resources SET ' . implode(', ', $sets) .
            ', resources_computed_at = NOW() WHERE planet_id=? AND player_id=?'
        )->execute([...array_values($caps), $planetId, $playerId]);

        ok(['action' => 'max_resources', 'caps' => $caps]);

    case 'complete_units':
        if (!$planetId) fail('planetId required');
        $own = $db->prepare('SELECT 1 FROM hs_planet_ownership WHERE planet_id=? AND player_id=?');
        $own->execute([$planetId, $playerId]);
        if (!$own->fetch()) fail('Planet not owned', 403);

        ensure_units_table($db);
        $db->prepare(
            "UPDATE hs_units SET build_ends_at = DATE_SUB(NOW(), INTERVAL 1 SECOND)
             WHERE planet_id=? AND player_id=? AND build_ends_at IS NOT NULL"
        )->execute([$planetId, $playerId]);

        resolve_units($db, $planetId, $playerId);
        ok(['action' => 'complete_units']);

    case 'roll_anomaly':
        if (!$planetId) fail('planetId required');
        $ownRow = $db->prepare(
            'SELECT p.type FROM hs_planet_ownership po JOIN hs_planets p ON p.id=po.planet_id
             WHERE po.planet_id=? AND po.player_id=?'
        );
        $ownRow->execute([$planetId, $playerId]);
        $planet = $ownRow->fetch();
        if (!$planet) fail('Planet not owned', 403);

        // Expire whatever is open, then roll immediately — otherwise testing an
        // anomaly means waiting out ANOMALY_INTERVAL_HOURS.
        ensure_anomaly_table($db);
        $db->prepare(
            'UPDATE hs_anomalies SET expires_at = DATE_SUB(NOW(), INTERVAL 1 SECOND)
             WHERE planet_id=? AND player_id=? AND resolved_at IS NULL'
        )->execute([$planetId, $playerId]);

        // Optional: force one specific type instead of the weighted roll.
        $forced = trim($body['anomalyType'] ?? '');
        $rolled = create_anomaly($db, $planetId, $playerId, $planet['type'], $forced ?: null);
        ok(['action' => 'roll_anomaly', 'rolled' => $rolled['type'] ?? null]);

    case 'complete_conversions':
        if (!$planetId) fail('planetId required');
        $own = $db->prepare('SELECT 1 FROM hs_planet_ownership WHERE planet_id=? AND player_id=?');
        $own->execute([$planetId, $playerId]);
        if (!$own->fetch()) fail('Planet not owned', 403);

        // resolve_conversions() finishes one item per queue and re-arms the rest
        // with a fresh duration, so a queue of N needs N passes. Capped so a long
        // queue can never spin here indefinitely.
        $left = $db->prepare('SELECT COUNT(*) FROM hs_conversion_queues WHERE planet_id=? AND player_id=?');
        $due  = $db->prepare(
            "UPDATE hs_conversion_queues SET ends_at = DATE_SUB(NOW(), INTERVAL 1 SECOND)
             WHERE planet_id=? AND player_id=?"
        );

        $passes = 0;
        while ($passes < 50) {
            $left->execute([$planetId, $playerId]);
            if (!(int)$left->fetchColumn()) break;

            $due->execute([$planetId, $playerId]);
            resolve_conversions($db, $planetId, $playerId);
            $passes++;
        }
        ok(['action' => 'complete_conversions', 'passes' => $passes]);

    case 'complete_drone_missions':
        $db->prepare(
            "UPDATE hs_missions SET ends_at = DATE_SUB(NOW(), INTERVAL 1 SECOND)
             WHERE player_id=? AND type='recon_drone' AND status='in_flight'"
        )->execute([$playerId]);
        resolve_missions($db, $playerId);
        ok(['action' => 'complete_drone_missions']);

    case 'complete_colony_missions':
        $db->prepare(
            "UPDATE hs_missions SET ends_at = DATE_SUB(NOW(), INTERVAL 1 SECOND)
             WHERE player_id=? AND type='colony_ship' AND status='in_flight'"
        )->execute([$playerId]);
        resolve_missions($db, $playerId);
        ok(['action' => 'complete_colony_missions']);

    case 'complete_cargo_missions':
        // Resolve twice: the first pass lands the outbound leg and creates the
        // return leg, the second pass brings the drone home.
        for ($i = 0; $i < 2; $i++) {
            $db->prepare(
                "UPDATE hs_missions SET ends_at = DATE_SUB(NOW(), INTERVAL 1 SECOND)
                 WHERE player_id=? AND type='cargo_drone' AND status='in_flight'"
            )->execute([$playerId]);
            resolve_missions($db, $playerId);
        }
        ok(['action' => 'complete_cargo_missions']);

    case 'complete_scanning':
        $db->prepare(
            "UPDATE hs_system_contacts SET scan_ends_at = DATE_SUB(NOW(), INTERVAL 1 SECOND)
             WHERE player_id=? AND scan_state='scanning' AND scan_ends_at IS NOT NULL"
        )->execute([$playerId]);
        resolve_system_contacts($db, $playerId);
        ok(['action' => 'complete_scanning']);

    default:
        fail('Unknown action');
}
