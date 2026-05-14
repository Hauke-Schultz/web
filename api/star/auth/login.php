<?php
require_once __DIR__ . '/../bootstrap.php';
method('POST');

$b        = body();
$email    = strtolower(trim($b['email'] ?? ''));
$password = $b['password'] ?? '';

if (!$email || !$password) fail('Email and password required');

$db   = getDB();
$stmt = $db->prepare('SELECT * FROM hs_players WHERE email=?');
$stmt->execute([$email]);
$player = $stmt->fetch();

if (!$player || !password_verify($password, $player['password_hash'])) {
    fail('Invalid credentials', 401);
}

$playerId = (int)$player['id'];
$exp      = time() + 7 * 86400;
$payload  = ['sub' => $playerId, 'exp' => $exp];
$token    = jwt_sign($payload, jwt_secret());

$db->prepare(
    'INSERT INTO hs_sessions (player_id, token_hash, expires_at)
     VALUES (?, ?, FROM_UNIXTIME(?))'
)->execute([$playerId, hash('sha256', $token), $exp]);

$db->prepare('UPDATE hs_players SET last_seen_at=NOW() WHERE id=?')->execute([$playerId]);

$home = $db->prepare(
    'SELECT planet_id FROM hs_planet_ownership WHERE player_id=? AND is_home=1'
);
$home->execute([$playerId]);
$homePlanetId = (int)($home->fetchColumn() ?: 0);

ok([
    'token'        => $token,
    'player'       => [
        'id'          => $playerId,
        'username'    => $player['username'],
        'email'       => $player['email'],
        'portrait'    => $player['portrait'],
        'disposition' => $player['disposition'],
    ],
    'homePlanetId' => $homePlanetId,
]);
