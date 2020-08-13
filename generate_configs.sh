#!/bin/sh

# Скрипт генерирует конфигурационные файлы сервисов и модулей
# из шаблонов Mustache,
# принимая на вход shell-скрипт с параметрами
# в текущей или указанной директории

E_BADARGS=85
if [ $# -ne 1 -a $# -ne 2 ]
then
  echo "Usage: $0 /path/to/config.sh /search/dir"
  exit $E_BADARGS
fi

INPUT_CONFIG="$1"
SEARCH_DIR=${2:-./}
BASE_DIR="$PWD"

to_json() {
  local CAM_IDX=$1
  local value
  echo "{"
  while IFS= read -r param
  do
    [ "${param%%#*}" = "" ] && continue   # skip comments
    param="${param%%=*}"
    param="${param%%\[*\]}"
    if [ "$CAM_IDX" != "" ]
    then
      iparam="$param[$CAM_IDX]"
      [ "${!iparam}" != "" ] && value="${!iparam}" || value="${!param}"
    else
      value="${!param}"
    fi
    [ "$param" != "" ] && {
      echo -n "\"$param\": "
      [[ "$value" = "true" || "$value" = "false" ]] && echo -nE "$value" || echo -nE "\"$value\""
      echo ","
    }
  done < "$INPUT_CONFIG"
  echo "\"CAM_IDX\": \"$CAM_IDX\"",
  echo "\"CAM_ID\": \"${VA_CAM_ID[$CAM_IDX]}\"",
  cams
  echo "}"
}

cams() {
  echo "\"CAMS\": ["
  for ((i=1; i<=${#VA_CAM_ID[*]}; i++)) {
    [ -z ${VA_CAM_ID[$i]} ] && continue
    echo "{ \"IDX\": $i, \"ID\": \"${VA_CAM_ID[$i]}\", \"URL\": \"${VA_STREAM_URL[$i]}\", \"COMMA\":" `[ $i -lt ${#VA_CAM_ID[*]} ] && echo "\",\"" || echo "\"\""` "}"
    [ $i -lt ${#VA_CAM_ID[*]} ] && echo ","
  }
  echo "]"
}

generate() {
  local TEMPLATE=$(basename "$1")
  local CAM_IDX=$2
  local CAM_ID=$3
  local TEMPLATE_PREFIX=$(basename "$TEMPLATE" .mustache)
  local CONFIG_PREFIX=${TEMPLATE_PREFIX%.*}
  local CONFIG_EXTENSION=${TEMPLATE_PREFIX#$CONFIG_PREFIX}
  local CONFIG_NAME="${CONFIG_PREFIX/0/_$CAM_ID}$CONFIG_EXTENSION"
  local DATA=$(to_json $CAM_IDX | uniq)
  #echo "$DATA"
  #echo "$CONFIG_NAME"
  #echo "$DATA" | mustache - "$TEMPLATE"
  echo "$DATA" | mustache - "$TEMPLATE" > "$CONFIG_NAME"
}

generate_by_cam() {
  local result=0
  for ((i=1; i<=${#VA_CAM_ID[*]}; i++)) {
    generate "$1" $i ${VA_CAM_ID[$i]}
    [ $? -ne 0 ] && result=$?
  }
  return $result
}

source "$INPUT_CONFIG"
for t in $(find "$SEARCH_DIR" -name "*.mustache" -type f)
do
  echo -n "Processing $t ... "
  TEMPLATE_NAME=$(basename "$t")
  cd $(dirname "$t") && \
  ([ "${TEMPLATE_NAME/0/}" != "$TEMPLATE_NAME" ] && \
  generate_by_cam "$t" || generate "$t") && \
  cd "$BASE_DIR"
  [ $? -eq 0 ] && echo "OK" || echo "FAIL"
done
