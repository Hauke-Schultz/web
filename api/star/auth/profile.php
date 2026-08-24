<?php
require_once __DIR__ . '/../bootstrap.php';
method('POST');

$jwt      = auth();
$playerId = (int)$jwt['sub'];
$b        = body();

$portrait    = array_key_exists('portrait',    $b) ? $b['portrait']                  : null;
$username    = array_key_exists('username',    $b) ? trim((string)$b['username'])     : null;
$disposition = array_key_exists('disposition', $b) ? $b['disposition']               : null;

$allowed_portraits   = ['👨‍🚀','👽️','👾','🤖','🤠','🧠','💀','👻','🧜‍♂️','🧟','🧌','☠️','🥵','🥶','😈','🕷️','🦊','🦄','🌞','⚓️'];
$allowed_dispositions = ['friendly','neutral','hostile'];

$db = getDB();

// Salvage artefacts unlock extra avatars, and the picker offers them the moment
// the find is in the cabinet — so the whitelist has to know about them as well.
// Without this the choice looked saved, survived until the next reload and then
// quietly reverted to the old portrait, which is the worst of both.
// Only consulted when the pick is not one of the fixed twenty: an ordinary
// portrait change must not cost a query.
function salvage_portraits(PDO $db, int $playerId): array {
    $out = [];
    ensure_salvage($db, $playerId);
    foreach (salvage_owned_finds($db, $playerId) as $key) {
        $effect = SALVAGE_FINDS[$key]['effect'] ?? null;
        if (($effect['type'] ?? null) === 'portrait') $out[] = $effect['portrait'];
    }
    return $out;
}

$fields = [];
$params = [];

if ($portrait !== null) {
    if (!in_array($portrait, $allowed_portraits, true)
        && !in_array($portrait, salvage_portraits($db, $playerId), true)) fail('Invalid portrait');
    $fields[] = 'portrait = ?';
    $params[] = $portrait;
}
if ($username !== null) {
    if (mb_strlen($username) < 1 || mb_strlen($username) > 12) fail('Username must be 1–12 characters');
    $fields[] = 'username = ?';
    $params[] = $username;
}
if ($disposition !== null) {
    if (!in_array($disposition, $allowed_dispositions, true)) fail('Invalid disposition');
    $fields[] = 'disposition = ?';
    $params[] = $disposition;
}

if (empty($fields)) fail('Nothing to update');

$params[] = $playerId;
$db->prepare('UPDATE hs_players SET ' . implode(', ', $fields) . ' WHERE id = ?')->execute($params);

$row = $db->prepare('SELECT id, username, email, portrait, disposition FROM hs_players WHERE id = ?');
$row->execute([$playerId]);

ok(['player' => $row->fetch()]);
