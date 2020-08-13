USE staff;

CREATE TABLE IF NOT EXISTS `persons` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(30) NOT NULL,
  `patronymic` varchar(30) NOT NULL DEFAULT '',
  `surname` varchar(30) NOT NULL DEFAULT '',
  `external_id` varchar(100),
  `pass_num` varchar(100),
  `phone` varchar(20),
  `email` varchar(100),
  `file_name` varchar(100),
  `face_id` varchar(100),
  `estimation` text,
  PRIMARY KEY (`id`),
  UNIQUE KEY `external_id` (`external_id`),
  UNIQUE KEY `file_name` (`file_name`),
  UNIQUE KEY `pass_num` (`pass_num`)
);

CREATE TABLE IF NOT EXISTS `mailing` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `email` varchar(100) NOT NULL,
  `subscriber` varchar(100),
  `event_ids` text DEFAULT '',
  `zone_ids` text DEFAULT '',
  `persons` text DEFAULT '',
  PRIMARY KEY (`id`),
  UNIQUE KEY `email` (`email`)
);
