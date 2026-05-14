<?php
require_once __DIR__ . '/../bootstrap.php';
method('POST');

$header = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
if (str_starts_with($header, 'Bearer ')) {
    $token = substr($header, 7);
    $db    = getDB();
    $db->prepare('DELETE FROM hs_sessions WHERE token_hash=?')
       ->execute([hash('sha256', $token)]);
}

ok();
