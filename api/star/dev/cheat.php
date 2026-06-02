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

        // Compute storage caps from active buildings
        $bRows = $db->prepare(
            'SELECT building_key, level FROM hs_buildings
             WHERE planet_id=? AND player_id=? AND level>0 AND build_ends_at IS NULL'
        );
        $bRows->execute([$planetId, $playerId]);
        $caps = [];
        foreach ($bRows->fetchAll() as $row) {
            $def = level_def($row['building_key'], (int)$row['level']);
            if (!$def) continue;
            foreach (($def['storageCapacity'] ?? []) as $res => $cap) {
                $caps[$res] = ($caps[$res] ?? 0) + $cap;
            }
        }

        if (empty($caps)) ok(['action' => 'max_resources', 'note' => 'no storage caps']);

        $sets = array_map(fn($r) => "$r = ?", array_keys($caps));
        $db->prepare(
            'UPDATE hs_planet_resources SET ' . implode(', ', $sets) .
            ', resources_computed_at = NOW() WHERE planet_id=? AND player_id=?'
        )->execute([...array_values($caps), $planetId, $playerId]);

        ok(['action' => 'max_resources', 'caps' => $caps]);

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

    case 'complete_scanning':
        $db->prepare(
            "UPDATE hs_system_contacts SET scan_ends_at = DATE_SUB(NOW(), INTERVAL 1 SECOND)
             WHERE player_id=? AND scan_state='scanning' AND scan_ends_at IS NOT NULL"
        )->execute([$playerId]);
        resolve_system_contacts($db, $playerId);
        ok(['action' => 'complete_scanning']);

    case 'ready_farm':
        if (!$planetId) fail('planetId required');
        $own = $db->prepare('SELECT 1 FROM hs_planet_ownership WHERE planet_id=? AND player_id=?');
        $own->execute([$planetId, $playerId]);
        if (!$own->fetch()) fail('Planet not owned', 403);

        $agriStmt = $db->prepare('SELECT current_grid FROM hs_agriculture WHERE planet_id=? AND player_id=?');
        $agriStmt->execute([$planetId, $playerId]);
        $agri = $agriStmt->fetch();
        if (!$agri || !$agri['current_grid']) fail('No farm grid yet — open the agriculture tile first');

        $cells = json_decode($agri['current_grid'], true);
        $past  = (time() - 10) * 1000;
        foreach ($cells as &$cell) {
            $cell['plantedAt'] = $past - 3600000;
            $cell['growsAt']   = $past;
        }
        unset($cell);

        $db->prepare(
            'UPDATE hs_agriculture SET current_grid=? WHERE planet_id=? AND player_id=?'
        )->execute([json_encode($cells, JSON_UNESCAPED_UNICODE), $planetId, $playerId]);
        ok(['action' => 'ready_farm']);

    default:
        fail('Unknown action');
}
