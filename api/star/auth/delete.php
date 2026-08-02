<?php
require_once __DIR__ . '/../bootstrap.php';
method('DELETE', 'POST');

$jwt      = auth();
$playerId = (int)$jwt['sub'];
$db       = getDB();

// Delete all player data in dependency order
$tables = [
    'hs_comm_log',
    'hs_system_contacts',
    'hs_conversion_queues',
    'hs_units',
    'hs_power_battery',
    'hs_recruit_pool',
    'hs_missions',
    'hs_global_research',
    'hs_buildings',
    'hs_planet_slots',
    'hs_planet_resources',
    'hs_planet_ownership',
    'hs_sessions',
];
foreach ($tables as $table) {
    $db->prepare("DELETE FROM $table WHERE player_id = ?")->execute([$playerId]);
}
$db->prepare('DELETE FROM hs_players WHERE id = ?')->execute([$playerId]);

ok(null, 200);
