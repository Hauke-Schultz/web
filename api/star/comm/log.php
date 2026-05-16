<?php
require_once __DIR__ . '/../bootstrap.php';
method('GET');

$jwt      = auth();
$playerId = (int)$jwt['sub'];
$db       = getDB();

// Auto-migrate: add columns that were added after initial DB creation
$db->exec("ALTER TABLE hs_comm_log ADD COLUMN IF NOT EXISTS sent_msg_id    INT NULL");
$db->exec("ALTER TABLE hs_comm_log ADD COLUMN IF NOT EXISTS from_player_id INT NULL");

resolve_comm_deliveries($db, $playerId);

$rows = $db->prepare(
    "SELECT cl.id, cl.system_id, cl.direction, cl.message_key,
            cl.travel_ends_at, cl.created_at,
            s.name AS system_name
     FROM hs_comm_log cl
     JOIN hs_star_systems s ON s.id = cl.system_id
     WHERE cl.player_id = ?
     ORDER BY cl.created_at ASC"
);
$rows->execute([$playerId]);
$entries = $rows->fetchAll();

// Gather owners for all referenced systems
$systemIds = array_values(array_unique(array_column($entries, 'system_id')));
$owners    = [];
if (!empty($systemIds)) {
    $in       = implode(',', array_fill(0, count($systemIds), '?'));
    $ownStmt  = $db->prepare(
        "SELECT p.system_id, po.player_id, pl.username, pl.portrait
         FROM hs_planet_ownership po
         JOIN hs_planets p ON p.id = po.planet_id
         JOIN hs_players pl ON pl.id = po.player_id
         WHERE p.system_id IN ($in)"
    );
    $ownStmt->execute($systemIds);
    foreach ($ownStmt->fetchAll() as $row) {
        $sid = (int)$row['system_id'];
        $pid = (int)$row['player_id'];
        if (!isset($owners[$sid][$pid])) {
            $owners[$sid][$pid] = [
                'playerId' => $pid,
                'username' => $row['username'],
                'portrait' => $row['portrait'],
            ];
        }
    }
}

$result = [];
foreach ($entries as $e) {
    $sid      = (int)$e['system_id'];
    $result[] = [
        'id'          => (int)$e['id'],
        'direction'   => $e['direction'],
        'systemId'    => $sid,
        'systemName'  => $e['system_name'],
        'owners'      => array_values($owners[$sid] ?? []),
        'messageKey'  => $e['message_key'],
        'timestamp'   => strtotime($e['created_at']) * 1000,
        'travelEndsAt'=> $e['travel_ends_at'] ? strtotime($e['travel_ends_at']) * 1000 : null,
    ];
}

ok($result);
