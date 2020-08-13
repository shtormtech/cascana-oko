USE stats;

DELETE FROM events;
ALTER TABLE events AUTO_INCREMENT=1;
INSERT INTO events (name, description)
       VALUES ('image_recieved', 'Получено изображение');
INSERT INTO events (name, description)
       VALUES ('face_detected', 'На изображении обнаружено лицо');
INSERT INTO events (name, description)
       VALUES ('face_caught', 'Лицо вырезано из изображения');
INSERT INTO events (name, description)
       VALUES ('face_processed', 'Лицо обработано сервисом распознавания');
INSERT INTO events (name, description)
       VALUES ('face_failed', 'Сервис распознавания не смог обработать данные лица');
INSERT INTO events (name, description)
       VALUES ('face_true', 'Лицо прошло проверку');
INSERT INTO events (name, description)
       VALUES ('face_false', 'Лицо НЕ прошло проверку');
INSERT INTO events (name, description)
       VALUES ('face_ok', 'Лицо идентифицировано');

DELETE FROM services;
ALTER TABLE services AUTO_INCREMENT=1;
INSERT INTO services (name, description)
       VALUES ('mailru', 'Mail.ru Vision Cloud');
INSERT INTO services (name, description)
       VALUES ('kryptonite', 'Kryptonite Service');
INSERT INTO services (name, description)
       VALUES ('raw', 'No Processing');
