<?php
require_once __DIR__ . '/../bootstrap.php';
method('POST');

$jwt      = auth();
$playerId = (int)$jwt['sub'];
$b        = body();

$portrait    = array_key_exists('portrait',    $b) ? $b['portrait']                  : null;
$username    = array_key_exists('username',    $b) ? trim((string)$b['username'])     : null;
$disposition = array_key_exists('disposition', $b) ? $b['disposition']               : null;

$allowed_portraits   = ['👨‍🚀','👩‍🚀','🧑‍🚀','🤖','👾','🧠','💀','🦾','⭐','🪐','🔭','⚡'];
$allowed_dispositions = ['friendly','neutral','hostile'];

$fields = [];
$params = [];

if ($portrait !== null) {
    if (!in_array($portrait, $allowed_portraits, true)) fail('Invalid portrait');
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
$db = getDB();
$db->prepare('UPDATE hs_players SET ' . implode(', ', $fields) . ' WHERE id = ?')->execute($params);

$row = $db->prepare('SELECT id, username, email, portrait, disposition FROM hs_players WHERE id = ?');
$row->execute([$playerId]);

ok(['player' => $row->fetch()]);
