<?php
require_once __DIR__ . '/../bootstrap.php';
method('GET');

$jwt      = auth();
$playerId = (int)$jwt['sub'];
$db       = getDB();

resolve_system_contacts($db, $playerId);

$rows = $db->prepare('SELECT system_id, scan_state, scan_ends_at FROM hs_system_contacts WHERE player_id=?');
$rows->execute([$playerId]);

$result = [];
foreach ($rows->fetchAll() as $row) {
    $result[(string)(int)$row['system_id']] = [
        'scanState'  => $row['scan_state'],
        'scanEndsAt' => $row['scan_ends_at'] ? strtotime($row['scan_ends_at']) * 1000 : null,
    ];
}

ok($result);
