#!/bin/bash

E_BADARGS=85
if [ $# -ne 2 ]
then
  echo "Usage: $0 /source /destination"
  exit $E_BADARGS
fi

move() {
  local DIR="$1"
  DATES=$(ls -1 "$DIR" | egrep -o ^[[:digit:]]{8} | uniq | grep -v `date +%Y%m%d`)
  for date in $DATES
  do
    target="$DEST_DIR"/$date/$(basename "$DIR")
    mkdir -p "$target"
    mv -n "$DIR"/$date* "$target"
  done
}

SRC_DIR="$1"
DEST_DIR="$2"
for subdir in $SRC_DIR/*
do
  if [ -d "$subdir" ]
  then
    move "$subdir"
  fi
done
exit
