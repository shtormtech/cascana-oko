USE stats;

CREATE TABLE IF NOT EXISTS `events` (
  `id` smallint(5) unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(15) NOT NULL,
  `description` tinytext,
  PRIMARY KEY (`id`),
  UNIQUE KEY `name` (`name`)
);

CREATE TABLE IF NOT EXISTS `services` (
  `id` tinyint(3) unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(15) NOT NULL,
  `description` tinytext,
  PRIMARY KEY (`id`),
  UNIQUE KEY `name` (`name`)
);

CREATE TABLE IF NOT EXISTS `zones` (
  `id` varchar(30) NOT NULL DEFAULT '',
  `description` tinytext,
  PRIMARY KEY (`id`)
);

CREATE TABLE IF NOT EXISTS `cameras` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `camera_id` varchar(15) NOT NULL,
  `zone_id` varchar(30) NOT NULL,
  `description` tinytext,
  PRIMARY KEY (`id`),
  KEY `fk_zone_id` (`zone_id`),
  CONSTRAINT `fk_zone_id` FOREIGN KEY (`zone_id`) REFERENCES `zones` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS `va` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `created` timestamp(3) NOT NULL DEFAULT current_timestamp(3) ON UPDATE current_timestamp(3),
  `host` varchar(30),
  `service_id` tinyint(3) unsigned,
  `action_module` varchar(15),
  `camera_id` varchar(15),
  `event_id` smallint(5) unsigned NOT NULL,
  `event_time` datetime(3),
  `photo_size` smallint(5) unsigned COMMENT 'Side of a square in pixels',
  `file_size` int(10) unsigned COMMENT 'File size in bytes',
  `file_name` varchar(100),
  `duration` int(10) unsigned COMMENT 'Event duration in milliseconds',
  `quantity` smallint(5) unsigned COMMENT 'Quantity of objects if any',
  `service_response` text,
  `external_id` varchar(100),
  `fio` varchar(100),
  PRIMARY KEY (`id`),
  KEY `fk_service_id` (`service_id`),
  KEY `fk_event_id` (`event_id`),
  CONSTRAINT `fk_event_id` FOREIGN KEY (`event_id`) REFERENCES `events` (`id`),
  CONSTRAINT `fk_service_id` FOREIGN KEY (`service_id`) REFERENCES `services` (`id`)
);
