# Добавляйте к имени шаблона ноль (template0.json.mustache),
# если требуется сгенерировать файл на каждую камеру
# В квадратных скобках указан индекс камеры
# Рекомендуется все строковые значения заключать в кавычки
# Логические значения писать строго без кавычек

# Конфигурация системы
VA_DETECTOR_SERVICE=true
VA_MARIADB_SERVICE=true
VA_PHOTO_SERVICE=true
VA_CONFIG_SERVICE=true
VA_MAILRU_UI=false
VA_GALLERY_UI=false
VA_CONFIG_UI=true
VA_UI=true
FFSERVER=true
VA_DETECT_MODULE="face_detect"
VA_PROCESS_MODULE="raw"
VA_ACTION_MODULE="log"
VA_OPT_MODULES="\\\"monitor\\\",\\\"archive\\\",\\\"stat\\\""

# Идентификаторы камер
VA_CAM_ID[1]="cam1"

# Видеопотоки с камер
FFMPEG_OPTIONS="-v error -re -stream_loop 100 -y -an"
VA_STREAM_URL[1]="${PWD}/video_sources/conference.mp4"
VA_FREQ[1]=1

# Модуль мониторинга
VA_MONITOR_PORT[1]=8101
VA_VIDEO_HOST="localhost"
VA_VIDEO_PORT=8079

# Модуль приемник
VA_RECEIVER_PORT[1]=8111
VA_RECEIVER_IPWL="127.0.0.1 192.168.1.*"

# Фото-сервисы
VA_GALLERY_HOST="localhost"
VA_GALLERY_PORT=8183
VA_GALLERY_USER="va"
VA_GALLERY_PWD="face_321"
VA_PHOTOSVC_HOST="localhost"
VA_PHOTOSVC_PORT="8184"
VA_PHOTOSVC_IPWL="127.0.0.1 192.168.1.*"
VA_PHOTO_BASE_DIR="${HOME}/va_files/photo"
VA_PHOTO_ORIG_DIR="${HOME}/va_files/orig"
VA_PHOTO_ARCHIVE_DIR="${HOME}/va_files/archive"

# Сервис БД (обращение к БД происходит через веб-сервис)
VA_DBSVC_HOST="localhost"
VA_DBSVC_PORT=8087
VA_DBSVC_IPWL="127.0.0.1 192.168.1.*"
VA_DB_PORT=3306
VA_DB_USER="va"
VA_DB_PWD="face_321"

# Сервисы уведомлений
# Обращение к серверу ejabberd происходит через чат-бот (не включен в проект)
VA_EJABBERD_URL=
VA_SMTP_HOST=
VA_SMTP_PORT=25

# Пользовательские интерфейсы
VA_UI_PORT=8088
VA_UI_USER="va"
VA_UI_PWD="face_321"

VA_CONFIG_UI_PORT=8089
VA_CONFIG_UI_USER="admin"
VA_CONFIG_UI_PWD="face_321"
VA_CONFIGSVC_PORT=8086
VA_CONFIGSVC_IPWL="127.0.0.1 192.168.1.*"
# Двойные кавычки указываются через 3 слэша
VA_HOSTS="\\\"localhost\\\""

VA_VISION_UI_PORT=8080
VA_VISION_UI_USER="va"
VA_VISION_UI_PWD="face_321"

# Параметры сервиса Mail.Ru Vision
# Необходима регистрация в облаке Mail.ru
VISION_BASE_URL=
VISION_TOKEN=
VISION_SPACE=

# Параметры сервиса компании Криптонит
KRYPTONITE_BASE_URL=
KRYPTONITE_USER=
KRYPTONITE_PWD=

# Параметры менеджера сервисов
PM_CLUSTER_SIZE=2
PM_LOG_DIR="${HOME}/va_logs"
