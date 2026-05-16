<?php
require_once __DIR__ . '/../bootstrap.php';
method('GET');

$jwt      = auth();
$playerId = (int)$jwt['sub'];
$db       = getDB();

resolve_system_contacts($db, $playerId);

// Our home system id
$homeRow = $db->prepare(
    'SELECT s.id FROM hs_star_systems s
     JOIN hs_planets p ON p.system_id = s.id
     JOIN hs_planet_ownership po ON po.planet_id = p.id
     WHERE po.player_id = ? AND po.is_home = 1 LIMIT 1'
);
$homeRow->execute([$playerId]);
$homeSystemId = (int)($homeRow->fetchColumn() ?: 0);

// Which scanned systems have at least one planet owner that has also scanned us back
$mutualRows = $db->prepare(
    'SELECT DISTINCT sc.system_id
     FROM hs_system_contacts sc
     JOIN hs_planets p  ON p.system_id  = sc.system_id
     JOIN hs_planet_ownership po ON po.planet_id = p.id AND po.player_id != ?
     JOIN hs_system_contacts sc2 ON sc2.player_id = po.player_id
                                 AND sc2.system_id = ?
                                 AND sc2.scan_state = \'scanned\'
     WHERE sc.player_id = ? AND sc.scan_state = \'scanned\''
);
$mutualRows->execute([$playerId, $homeSystemId, $playerId]);
$mutualIds = array_flip(array_map('intval', $mutualRows->fetchAll(PDO::FETCH_COLUMN)));

// Which systems (that we haven't scanned) have owners who have already scanned our home system
$theyScannedUsRows = $db->prepare(
    'SELECT DISTINCT p.system_id
     FROM hs_planets p
     JOIN hs_planet_ownership po ON po.planet_id = p.id AND po.player_id != ?
     JOIN hs_system_contacts sc  ON sc.player_id = po.player_id
                                 AND sc.system_id = ?
                                 AND sc.scan_state = \'scanned\'
     WHERE p.system_id NOT IN (
         SELECT system_id FROM hs_system_contacts
         WHERE player_id = ? AND scan_state IN (\'scanned\',\'scanning\')
     )'
);
$theyScannedUsRows->execute([$playerId, $homeSystemId, $playerId]);
$theyScannedUsIds = array_values(array_map('intval', $theyScannedUsRows->fetchAll(PDO::FETCH_COLUMN)));

$rows = $db->prepare('SELECT system_id, scan_state, scan_ends_at FROM hs_system_contacts WHERE player_id=?');
$rows->execute([$playerId]);

$contacts = [];
foreach ($rows->fetchAll() as $row) {
    $sysId = (int)$row['system_id'];
    $contacts[(string)$sysId] = [
        'scanState'  => $row['scan_state'],
        'scanEndsAt' => $row['scan_ends_at'] ? strtotime($row['scan_ends_at']) * 1000 : null,
        'mutualScan' => isset($mutualIds[$sysId]),
    ];
}

ok(['contacts' => $contacts, 'theyScannedMe' => $theyScannedUsIds]);
