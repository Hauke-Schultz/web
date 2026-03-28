<?php
/**
 * Datenbankverbindung via PDO
 *
 * Priorität der Credentials:
 *  1. api/db.config.php  (für Strato-Deployment, gitignored)
 *  2. Umgebungsvariablen (für Docker-Deployment)
 */
function getDB(): PDO {
    static $pdo = null;
    if ($pdo !== null) return $pdo;

    $configFile = __DIR__ . '/db.config.php';
    if (file_exists($configFile)) {
        require_once $configFile;
    }

    $host = defined('DB_HOST') ? DB_HOST : (getenv('DB_HOST') ?: 'localhost');
    $port = defined('DB_PORT') ? DB_PORT : (getenv('DB_PORT') ?: '3306');
    $name = defined('DB_NAME') ? DB_NAME : (getenv('DB_NAME') ?: 'myapp');
    $user = defined('DB_USER') ? DB_USER : (getenv('DB_USER') ?: 'appuser');
    $pass = defined('DB_PASS') ? DB_PASS : (getenv('DB_PASS') ?: 'secret');

    $dsn = "mysql:host=$host;port=$port;dbname=$name;charset=utf8mb4";
    $pdo = new PDO($dsn, $user, $pass, [
        PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES   => false,
    ]);

    return $pdo;
}
