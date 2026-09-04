<?php
require_once __DIR__ . '/../bootstrap.php';
method('POST');

$jwt      = auth();
$playerId = (int)$jwt['sub'];
$b        = body();

$portrait = array_key_exists('portrait', $b) ? $b['portrait']              : null;
$username = array_key_exists('username', $b) ? trim((string)$b['username']) : null;
$locale   = array_key_exists('locale',   $b) ? $b['locale']                : null;

// `disposition` is deliberately NOT read here, and a client that still sends it
// is ignored rather than refused — an old tab reloading its profile must not
// start failing. It is not a preference any more: friendly is the one rung that
// cannot be raided, so a settable disposition was a switch labelled "I am
// invulnerable". It is climbed by what you send out — escalate_disposition()
// in bootstrap.php, called from mission/spy.php and mission/raid.php.
$allowed_portraits = ['👨‍🚀','👽️','👾','🤖','🤠','🧠','💀','👻','🧜‍♂️','🧟','🧌','☠️','🥵','🥶','😈','🕷️','🦊','🦄','🌞','⚓️'];

$db = getDB();
ensure_player_locale($db);

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
// The language belongs to the account, not to the browser: the client applies
// whatever comes back here on every load, so a device that has never seen this
// player still reads in their language.
if ($locale !== null) {
    if (!in_array($locale, PLAYER_LOCALES, true)) fail('Invalid locale');
    $fields[] = 'locale = ?';
    $params[] = $locale;
}

if (empty($fields)) fail('Nothing to update');

$params[] = $playerId;
$db->prepare('UPDATE hs_players SET ' . implode(', ', $fields) . ' WHERE id = ?')->execute($params);

$row = $db->prepare('SELECT id, username, email, portrait, disposition, locale FROM hs_players WHERE id = ?');
$row->execute([$playerId]);

ok(['player' => $row->fetch()]);
