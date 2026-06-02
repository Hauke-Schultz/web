<?php
require_once __DIR__ . '/../bootstrap.php';
require_once __DIR__ . '/../config.php';
method('GET');

$jwt      = auth();
$playerId = (int)$jwt['sub'];
$planetId = (int)($_GET['planet_id'] ?? 0);
if (!$planetId) fail('planet_id required');

$db = getDB();

$own = $db->prepare(
    'SELECT p.type FROM hs_planet_ownership po
     JOIN hs_planets p ON p.id = po.planet_id
     WHERE po.planet_id=? AND po.player_id=?'
);
$own->execute([$planetId, $playerId]);
$planet = $own->fetch();
if (!$planet) fail('Planet not found or not owned', 404);
$planetType = $planet['type'];

// Farm must be fully built
$farmStmt = $db->prepare(
    "SELECT level FROM hs_buildings
     WHERE planet_id=? AND player_id=? AND building_key='farm' AND build_ends_at IS NULL"
);
$farmStmt->execute([$planetId, $playerId]);
$farmLevel = (int)($farmStmt->fetchColumn() ?: 0);

if ($farmLevel === 0) {
    ok(['farmLevel' => 0, 'cells' => null]);
}

// Load or create agriculture row
$agriStmt = $db->prepare('SELECT * FROM hs_agriculture WHERE planet_id=? AND player_id=?');
$agriStmt->execute([$planetId, $playerId]);
$agri = $agriStmt->fetch();

if (!$agri) {
    $db->prepare('INSERT INTO hs_agriculture (planet_id, player_id) VALUES (?,?)')->execute([$planetId, $playerId]);
    $agri = ['current_grid' => null];
}

$cells = $agri['current_grid'] ? json_decode($agri['current_grid'], true) : null;

// Generate grid on first use
if ($cells === null) {
    $cells = generate_harvest_grid($farmLevel, $planetType);
    $db->prepare('UPDATE hs_agriculture SET current_grid=? WHERE planet_id=? AND player_id=?')
       ->execute([json_encode($cells, JSON_UNESCAPED_UNICODE), $planetId, $playerId]);
}

// Add computed `ready` flag to each cell
$nowMs = (int)(microtime(true) * 1000);
foreach ($cells as &$cell) {
    $cell['ready'] = $cell['growsAt'] <= $nowMs;
}
unset($cell);

ok(['farmLevel' => $farmLevel, 'cells' => $cells]);
