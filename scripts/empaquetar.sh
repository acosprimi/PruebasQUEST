#!/bin/bash
# Genera EnglishQuest-IA1-Optimizado-V2.zip con carpeta raíz EnglishQuest/
set -e
SRC=/home/user/sandbox
OUT=$SRC/EnglishQuest-IA1-Optimizado-V2.zip
rm -f $OUT
rm -rf /tmp/zipstage && mkdir -p /tmp/zipstage/EnglishQuest
cd $SRC
tar --exclude=.git --exclude=node_modules --exclude=.nuxt --exclude=.output --exclude=dist --exclude='*.zip' --exclude=MEMORIA_PROYECTO.md -cf - . | tar -xf - -C /tmp/zipstage/EnglishQuest
cd /tmp/zipstage && zip -qr $OUT EnglishQuest
unzip -tq $OUT | tail -1
echo "mp3 en zip: $(unzip -l $OUT | grep -c '\.mp3')"
ls -la $OUT
