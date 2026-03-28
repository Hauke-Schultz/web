CREATE TABLE IF NOT EXISTS rsvps (
  guest_id        VARCHAR(36)  NOT NULL PRIMARY KEY,
  name            VARCHAR(50)  NOT NULL,
  status          ENUM('pending','accepted','declined') NOT NULL DEFAULT 'pending',
  number_of_guests TINYINT UNSIGNED NOT NULL DEFAULT 1,
  coming_by_car   TINYINT(1)   NOT NULL DEFAULT 0,
  needs_parking   TINYINT(1)   NOT NULL DEFAULT 0,
  needs_hotel_room TINYINT(1)  NOT NULL DEFAULT 0,
  number_of_rooms TINYINT UNSIGNED NOT NULL DEFAULT 1,
  food_preferences JSON        NOT NULL,
  remarks         TEXT         NOT NULL,
  last_updated    DATETIME     NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS highscores (
  player_id  VARCHAR(36) NOT NULL PRIMARY KEY,
  name       VARCHAR(20) NOT NULL,
  level      INT UNSIGNED NOT NULL DEFAULT 0,
  game_date  DATE        NOT NULL,
  emoji      VARCHAR(50) NOT NULL DEFAULT '',
  status     ENUM('normal','underReview','disqualified') NOT NULL DEFAULT 'normal',
  `rank`     SMALLINT UNSIGNED NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
