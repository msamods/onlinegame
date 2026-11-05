-- MariaDB / MySQL Initialization Schema
-- Character set: utf8mb4, Collation: utf8mb4_unicode_ci

CREATE DATABASE IF NOT EXISTS `openworld_game` 
CHARACTER SET utf8mb4 
COLLATE utf8mb4_unicode_ci;

USE `openworld_game`;

-- 1. Users Table
CREATE TABLE IF NOT EXISTS `users` (
  `id` VARCHAR(36) NOT NULL,
  `username` VARCHAR(50) NOT NULL UNIQUE,
  `password_hash` VARCHAR(255) NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `last_login` DATETIME(3) NULL,
  `account_status` VARCHAR(20) NOT NULL DEFAULT 'active',
  PRIMARY KEY (`id`),
  INDEX `idx_users_username` (`username`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Player Profiles Table
CREATE TABLE IF NOT EXISTS `player_profiles` (
  `id` VARCHAR(36) NOT NULL,
  `user_id` VARCHAR(36) NOT NULL UNIQUE,
  `selected_character` VARCHAR(50) NOT NULL DEFAULT 'ranger',
  `character_color` VARCHAR(20) NOT NULL DEFAULT '#2e7d32',
  `level` INT NOT NULL DEFAULT 1,
  `experience` INT NOT NULL DEFAULT 0,
  `coins` INT NOT NULL DEFAULT 100,
  PRIMARY KEY (`id`),
  CONSTRAINT `fk_profile_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Player Statistics Table
CREATE TABLE IF NOT EXISTS `player_statistics` (
  `id` VARCHAR(36) NOT NULL,
  `user_id` VARCHAR(36) NOT NULL UNIQUE,
  `kills` INT NOT NULL DEFAULT 0,
  `deaths` INT NOT NULL DEFAULT 0,
  `matches_played` INT NOT NULL DEFAULT 0,
  `matches_won` INT NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  CONSTRAINT `fk_stats_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Player Inventory Table
CREATE TABLE IF NOT EXISTS `player_inventory` (
  `id` VARCHAR(36) NOT NULL,
  `user_id` VARCHAR(36) NOT NULL,
  `item_id` VARCHAR(50) NOT NULL,
  `quantity` INT NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_user_item` (`user_id`, `item_id`),
  CONSTRAINT `fk_inventory_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. Match History Table
CREATE TABLE IF NOT EXISTS `match_history` (
  `id` VARCHAR(36) NOT NULL,
  `user_id` VARCHAR(36) NOT NULL,
  `room_id` VARCHAR(50) NOT NULL,
  `kills` INT NOT NULL DEFAULT 0,
  `deaths` INT NOT NULL DEFAULT 0,
  `result` VARCHAR(20) NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `idx_match_user` (`user_id`),
  CONSTRAINT `fk_match_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. Game Rooms Table
CREATE TABLE IF NOT EXISTS `game_rooms` (
  `id` VARCHAR(36) NOT NULL,
  `room_code` VARCHAR(20) NOT NULL UNIQUE,
  `room_name` VARCHAR(100) NOT NULL,
  `room_type` VARCHAR(30) NOT NULL DEFAULT 'deathmatch',
  `map_name` VARCHAR(50) NOT NULL DEFAULT 'Forest Island',
  `maximum_players` INT NOT NULL DEFAULT 16,
  `created_by` VARCHAR(36) NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `idx_room_code` (`room_code`),
  CONSTRAINT `fk_room_creator` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 7. Friends Table
CREATE TABLE IF NOT EXISTS `friends` (
  `id` VARCHAR(36) NOT NULL,
  `user_id` VARCHAR(36) NOT NULL,
  `friend_user_id` VARCHAR(36) NOT NULL,
  `status` VARCHAR(20) NOT NULL DEFAULT 'accepted',
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_user_friend` (`user_id`, `friend_user_id`),
  INDEX `idx_friends_user` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 8. Player Sessions Table
CREATE TABLE IF NOT EXISTS `player_sessions` (
  `id` VARCHAR(36) NOT NULL,
  `user_id` VARCHAR(36) NOT NULL,
  `session_token_hash` VARCHAR(255) NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `expires_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  INDEX `idx_session_hash` (`session_token_hash`),
  CONSTRAINT `fk_session_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

