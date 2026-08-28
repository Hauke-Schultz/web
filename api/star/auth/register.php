<?php
require_once __DIR__ . '/../bootstrap.php';
require_once __DIR__ . '/../config.php';
method('POST');

$b        = body();
$username = trim($b['username'] ?? '');
$email    = strtolower(trim($b['email'] ?? ''));
$password = $b['password'] ?? '';
$portrait = $b['portrait']    ?? '👨‍🚀';
$disposition = $b['disposition'] ?? 'neutral';

if (strlen($username) < 2 || strlen($username) > 64) fail('Username must be 2–64 characters');
if (!filter_var($email, FILTER_VALIDATE_EMAIL))        fail('Invalid email');
if (strlen($password) < 6)                             fail('Password must be at least 6 characters');
if (!in_array($disposition, ['friendly','neutral','hostile'], true)) $disposition = 'neutral';

$db = getDB();
ensure_player_locale($db);
check_rate_limit($db, 'register', 5, 3600); // 5 attempts per hour

// Check uniqueness
$exists = $db->prepare('SELECT id FROM hs_players WHERE username=? OR email=?');
$exists->execute([$username, $email]);
if ($exists->fetch()) fail('Username or email already taken', 409);

// Create player
$hash = password_hash($password, PASSWORD_BCRYPT);
$db->prepare(
    'INSERT INTO hs_players (username, email, password_hash, portrait, disposition)
     VALUES (?,?,?,?,?)'
)->execute([$username, $email, $hash, $portrait, $disposition]);
$playerId = (int)$db->lastInsertId();

// Create a new star system and pick a home planet within it
$newSystem  = create_player_system($db);
$homePlanet = ['planet_id' => $newSystem['planetId']];

$db->prepare(
    'INSERT INTO hs_planet_ownership (planet_id, player_id, is_home, colonized_at)
     VALUES (?,?,1,NOW())'
)->execute([$homePlanet['planet_id'], $playerId]);

// Initialize planet state, global research, and home system scan state
init_planet($db, $homePlanet['planet_id'], $playerId, true);
init_global_research($db, $playerId);
init_system_contacts($db, $playerId, $newSystem['systemId']);

// Issue token
$exp     = time() + 7 * 86400;
$payload = ['sub' => $playerId, 'exp' => $exp];
$token   = jwt_sign($payload, jwt_secret());

$db->prepare(
    'INSERT INTO hs_sessions (player_id, token_hash, expires_at)
     VALUES (?, ?, FROM_UNIXTIME(?))'
)->execute([$playerId, hash('sha256', $token), $exp]);

$player = $db->prepare('SELECT id, username, email, portrait, disposition, locale FROM hs_players WHERE id=?');
$player->execute([$playerId]);

ok(['token' => $token, 'player' => $player->fetch(), 'homePlanetId' => $homePlanet['planet_id']], 201);
