<?php
require_once __DIR__ . '/../../bootstrap.php';
require_once __DIR__ . '/../../config.php';
method('POST');

$jwt      = auth();
$playerId = (int)$jwt['sub'];
$b        = body();
$hit      = !empty($b['hit']);
// Anything that is not the exact string falls back to the ordinary table, so a
// malformed or missing zone can only ever cost the player, never pay them.
$zone     = ($b['zone'] ?? null) === 'perfect' ? 'perfect' : 'good';
// Only ever used to land a Fundstück that pays in planet stock. Scrap and the
// hold are player-wide and do not care where you fished from.
$planetId = (int)($b['planetId'] ?? 0);

$db = getDB();

ensure_salvage($db, $playerId);

// An artefact gift has to go somewhere real. The client names the planet it is
// fishing from; ownership is checked here, and a missing or foreign one falls
// back to the home planet rather than dropping a once-per-player reward.
if ($planetId) {
    $own = $db->prepare('SELECT 1 FROM hs_planet_ownership WHERE planet_id=? AND player_id=?');
    $own->execute([$planetId, $playerId]);
    if (!$own->fetch()) $planetId = 0;
}
if (!$planetId) {
    $home = $db->prepare('SELECT planet_id FROM hs_planet_ownership WHERE player_id=? AND is_home=1 LIMIT 1');
    $home->execute([$playerId]);
    $planetId = (int)$home->fetchColumn();
}

// The server never hears about a cast until it is reported, so `last_catch_at`
// is the only thing standing between a script and the find table. It is not a
// verification of the timing — that is impossible from here — just a floor on
// how fast reports may arrive.
$row = $db->prepare(
    'SELECT hold,
            TIMESTAMPDIFF(SECOND, hold_updated_at, NOW()) AS elapsed,
            COALESCE(TIMESTAMPDIFF(SECOND, last_catch_at, NOW()), 999999) AS since
     FROM hs_salvage WHERE player_id=?'
);
$row->execute([$playerId]);
$r = $row->fetch();
if (!$r) fail('Salvage state missing', 500);

if ((int)$r['since'] < SALVAGE_MIN_CAST_SECONDS) fail('Cast reported too fast', 429);

// Refill first, exactly as salvage_state() would compute it — the hold this
// catch draws from has to be the one the panel was showing. The ceiling is the
// player's own: every `hold` artefact in the cabinet raised it for good.
$holdMax = salvage_hold_max(salvage_owned_finds($db, $playerId));
$hold = min(
    $holdMax,
    (float)$r['hold'] + SALVAGE_HOLD_PER_HOUR * (max(0, (int)$r['elapsed']) / 3600.0)
);

$catch  = null;
$gained = 0;
$find   = null;

if ($hit) {
    // Rolled here, never sent by the client: what bites is the one part of this
    // the browser must not get to choose.
    $catch = salvage_roll_catch($zone);
    $worth = (int)SALVAGE_CATCHES[$catch]['scrap'];

    // The hold caps the currency and nothing else. A partly full hold pays what
    // still fits, an empty one pays nothing and the catch goes back over the
    // side — the cast itself always stays allowed.
    $gained = (int)min($worth, floor(max(0.0, $hold)));
    $hold  -= $gained;

    // Rolled whether or not the hold had room. That is the point of finds: they
    // are the reason to keep playing past the ceiling, and being unique is what
    // makes letting them past it safe.
    $find = salvage_roll_find($db, $playerId);
}

// `last_catch_at` moves on every report, hit or miss — the floor is on reports,
// not on successes, or skipping the misses would sidestep it.
$db->prepare(
    'UPDATE hs_salvage
        SET scrap = scrap + ?, hold = ?, hold_updated_at = NOW(), last_catch_at = NOW()
      WHERE player_id=?'
)->execute([$gained, $hold, $playerId]);

// Record first, pay out second: the hold bonus works out the new ceiling from
// the cabinet, so the entry has to be in there before it counts itself. The
// INSERT IGNORE also means a race can never pay the same artefact twice —
// `grant` only runs on the row that actually inserted.
$grant = null;
if ($find !== null) {
    $ins = $db->prepare(
        'INSERT IGNORE INTO hs_salvage_finds (player_id, find_key, found_at) VALUES (?,?,NOW())'
    );
    $ins->execute([$playerId, $find]);
    if ($ins->rowCount() > 0) {
        $grant = salvage_apply_find($db, $playerId, $planetId ?: null, $find);
    } else {
        $find = null;
    }
}

ok([
    'hit'     => $hit,
    'zone'    => $hit ? $zone : null,
    // The key alone would force the panel to mirror the icon table; sending it
    // along keeps the two from drifting. `worth` is what the catch was worth,
    // `gained` what the hold actually had room for — the gap between them is
    // the "thrown back" message.
    'catch'   => $catch === null ? null : [
        'key'   => $catch,
        'icon'  => SALVAGE_CATCHES[$catch]['icon'],
        'worth' => (int)SALVAGE_CATCHES[$catch]['scrap'],
    ],
    'gained'  => $gained,
    // The artefact, if one came up: its key and icon for the line, and `grant`
    // — what was ACTUALLY paid out, which a capped store can cut short.
    'find'    => $find === null ? null : [
        'key'   => $find,
        'icon'  => SALVAGE_FINDS[$find]['icon'],
        'grant' => $grant,
    ],
    'salvage' => salvage_state($db, $playerId),
]);
